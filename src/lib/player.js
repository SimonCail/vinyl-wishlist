// Lecteur de la platine : joue les extraits (30 s par morceau) d'un album,
// trouvés sur Deezer, morceau après morceau.
//
// Deezer ne permet pas les appels directs depuis le navigateur (CORS) : on
// passe par « JSONP » (un <script> qui appelle une fonction), qu'il accepte.
// Le son peut être coupé dans le profil (réglage gardé sur l'appareil).

import { useSyncExternalStore } from 'react'

const SOUND_KEY = 'vinyl-wishlist-sound-v1'
const CACHE_KEY = 'vinyl-wishlist-previews-v2'

let audio = null
let unlocked = false
let state = {
  enabled: readEnabled(),
  status: 'idle', // idle | loading | waiting | playing | paused | unavailable
  // waiting : prêt, attend le premier geste (le navigateur bloque le son à l'ouverture)
  album: null, // { key, title, artist, cover_url }
  tracks: [], // [{ title, preview }]
  index: 0,
}
const listeners = new Set()

function readEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}
function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
function getAudio() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
    audio.addEventListener('ended', () => next())
    // Le lien de l'extrait ne marche plus (souvent : expiré) → liens neufs
    audio.addEventListener('error', () => {
      if (audio.src && !audio.src.startsWith('data:') && ['loading', 'playing'].includes(state.status)) recover()
    })
    audio.addEventListener('pause', () => state.status === 'playing' && set({ status: 'paused' }))
    audio.addEventListener('play', () => set({ status: 'playing' }))
  }
  return audio
}

// Les navigateurs (surtout l'iPhone) n'acceptent le son qu'après un geste, et
// seulement à la FIN du geste : quand on lève le doigt (touchend), un clic ou
// une touche du clavier — pas au moment où le doigt se pose.
const SILENCE = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'

// Au premier toucher, on « débloque » le lecteur avec un son vide
// (si un vrai morceau démarre entre-temps, on ne le coupe pas).
export function unlock() {
  if (unlocked) return
  const a = getAudio()
  if (a.src && !a.src.startsWith('data:')) return
  a.src = SILENCE
  a.play()
    .then(() => {
      unlocked = true
      if (a.src === SILENCE) a.pause()
    })
    .catch(() => {}) // refusé : on réessaiera au prochain toucher
}

// Lecture refusée :
// - faute de geste → on attend le prochain toucher ;
// - lien d'extrait mort (expiré) → on redemande des liens neufs à Deezer, une fois.
let recovering = null
let refreshedFor = null
function recover() {
  if (recovering) return recovering
  const album = state.album
  if (!album) return
  if (refreshedFor === album.key) return set({ status: 'unavailable' })
  refreshedFor = album.key
  const id = requestId
  recovering = (async () => {
    let tracks = []
    try {
      tracks = await findPreviews(album, { fresh: true })
    } catch {
      tracks = []
    }
    if (id !== requestId || state.album?.key !== album.key) return
    if (!tracks.length) return set({ status: 'unavailable' })
    const index = Math.min(state.index, tracks.length - 1)
    set({ tracks, index, status: 'loading' })
    const a = getAudio()
    a.src = tracks[index].preview
    a.play()
      .then(() => {
        unlocked = true
      })
      .catch((err) => set({ status: err?.name === 'NotAllowedError' ? 'waiting' : 'unavailable' }))
  })().finally(() => {
    recovering = null
  })
  return recovering
}
const onPlayError = (err) => (err?.name === 'NotAllowedError' ? set({ status: 'waiting' }) : recover())

// Démarre le disque qui attend (appelé pendant le geste, sans délai)
function startWaiting() {
  const track = state.tracks[state.index]
  if (!track) return
  const a = getAudio()
  if (a.src !== track.preview) a.src = track.preview
  set({ status: 'loading' })
  a.play()
    .then(() => {
      unlocked = true
    })
    .catch((err) => state.status === 'loading' && onPlayError(err)) // refusé : prochain toucher, ou liens neufs
}

// Chaque geste dans l'app (doigt levé, clic, touche) :
// - si le disque de la platine attend, il démarre maintenant ;
// - sinon, tant que le lecteur n'est pas débloqué, on le débloque.
// On continue d'écouter tant que ça n'a pas marché (un geste peut être refusé,
// par exemple la fin d'un défilement). Les boutons du lecteur décident eux-mêmes.
function onGesture(e) {
  if (e.target?.closest?.('[data-player-control]')) return
  if (state.status === 'waiting' && state.tracks.length) startWaiting()
  else if (!unlocked) unlock()
}
if (typeof document !== 'undefined') {
  for (const type of ['touchend', 'pointerup', 'click', 'keydown'])
    document.addEventListener(type, onGesture, { capture: true, passive: true })
}

// --- Deezer ---
export function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = `dz_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const timer = setTimeout(() => done(new Error('timeout')), 8000)
    function done(err, data) {
      clearTimeout(timer)
      // Réponse arrivée trop tard : on la laisse tomber sans erreur
      window[cb] = () => delete window[cb]
      script.remove()
      err ? reject(err) : resolve(data)
    }
    window[cb] = (data) => done(null, data)
    script.onerror = () => done(new Error('network'))
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${cb}`
    document.head.appendChild(script)
  })
}

export const cleanTitle = (s = '') =>
  s
    .replace(/\s\(\d+\)$/, '') // « Hamza (3) »
    .replace(/\s*[([].*?(deluxe|edition|édition|remaster|anniversary|version)[^)\]]*[)\]]/gi, '')
    .trim()
const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}
function writeCache(cache) {
  try {
    const keys = Object.keys(cache)
    if (keys.length > 200) keys.slice(0, keys.length - 200).forEach((k) => delete cache[k])
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* plein : tant pis */
  }
}

// Les liens d'extraits Deezer expirent (« exp=… » dans l'adresse) : on garde
// le numéro de l'album longtemps, mais les liens seulement tant qu'ils sont valides.
const LINKS_TTL = 6 * 60 * 60 * 1000 // si le lien ne dit pas quand il expire
function linksExpired(entry) {
  if (!entry?.tracks?.length) return true
  for (const t of entry.tracks) {
    const m = /exp=(\d+)/.exec(t.preview)
    if (m && Number(m[1]) * 1000 < Date.now() + 5 * 60 * 1000) return true
  }
  return Date.now() - (entry.at || 0) > LINKS_TTL
}

async function tracksOf(albumId) {
  const res = await jsonp(`https://api.deezer.com/album/${albumId}/tracks?limit=50`)
  return (res?.data || []).filter((x) => x.preview).map((x) => ({ title: x.title_short || x.title, preview: x.preview }))
}

async function findAlbumId(artist, title) {
  const a = cleanTitle(artist)
  const t = cleanTitle(title)
  let found = await jsonp(
    `https://api.deezer.com/search/album?q=${encodeURIComponent(`artist:"${a}" album:"${t}"`)}&limit=5`
  )
  if (!found?.data?.length) {
    found = await jsonp(`https://api.deezer.com/search/album?q=${encodeURIComponent(`${a} ${t}`)}&limit=5`)
  }
  const list = found?.data || []
  // Le plus proche : même artiste de préférence
  return (list.find((x) => norm(x.artist?.name) === norm(a)) || list[0])?.id ?? null
}

// Les extraits d'un album : [{ title, preview }]
// fresh : ignorer les liens gardés (ils ont été refusés)
export async function findPreviews({ title, artist, deezerId }, { fresh = false } = {}) {
  const id = deezerId ? `dz:${deezerId}` : `${norm(artist)}|${norm(title)}`
  const cache = readCache()
  const entry = cache[id]
  if (entry && !fresh && !linksExpired(entry)) return entry.tracks
  const albumId = deezerId || entry?.albumId || (await findAlbumId(artist, title))
  const tracks = albumId ? await tracksOf(albumId) : []
  cache[id] = { albumId, tracks, at: Date.now() }
  writeCache(cache)
  return tracks
}

// --- Commandes ---
let requestId = 0

export async function playAlbum(album, { force = false } = {}) {
  if (!album?.title || !album?.artist) return
  if (!state.enabled && !force) return
  const id = ++requestId
  refreshedFor = null
  const a = getAudio()
  a.pause()
  set({ album, tracks: [], index: 0, status: 'loading' })
  let tracks = []
  try {
    tracks = await findPreviews(album)
  } catch {
    tracks = []
  }
  if (id !== requestId) return // un autre album a été lancé entre-temps
  if (!tracks.length) {
    set({ status: 'unavailable' })
    return
  }
  set({ tracks, index: 0 })
  playIndex(0)
}

function playIndex(i) {
  const track = state.tracks[i]
  if (!track) {
    set({ status: 'idle', index: 0 })
    return
  }
  const a = getAudio()
  a.src = track.preview
  set({ index: i, status: 'loading' })
  a.play().catch(onPlayError)
}

// À l'ouverture de l'app : on lance le disque de la platine tout seul si le
// son est activé. Si le navigateur refuse (pas encore de geste), il démarre
// au premier toucher n'importe où dans l'app.
export async function autoStart(album) {
  if (!state.enabled || !album?.title || !album?.artist) return
  if (state.album?.key === album.key && state.status !== 'idle') return
  const id = ++requestId
  refreshedFor = null
  set({ album, tracks: [], index: 0, status: 'loading' })
  let tracks = []
  try {
    tracks = await findPreviews(album)
  } catch {
    tracks = []
  }
  if (id !== requestId) return
  if (!tracks.length) return set({ status: 'unavailable' })
  set({ tracks, index: 0 })
  const a = getAudio()
  a.src = tracks[0].preview
  try {
    await a.play()
    unlocked = true
  } catch (err) {
    if (id === requestId) onPlayError(err) // pas de geste → attend un toucher ; lien mort → liens neufs
  }
}

export function next() {
  if (state.index + 1 < state.tracks.length) playIndex(state.index + 1)
  else set({ status: 'idle', index: 0 })
}

export function toggle(album) {
  const a = getAudio()
  // Autre disque que celui en cours : on le lance
  if (album && album.key !== state.album?.key) return playAlbum(album, { force: true })
  if (state.status === 'waiting') return playIndex(state.index)
  if (state.status === 'playing' || state.status === 'loading') {
    a.pause()
    set({ status: 'paused' })
  } else if (state.tracks.length) {
    if (state.status === 'idle') playIndex(0)
    else a.play().catch(() => {})
  } else if (album) {
    playAlbum(album, { force: true })
  }
}

export function stop() {
  requestId++
  if (audio) audio.pause()
  set({ status: 'idle', album: null, tracks: [], index: 0 })
}

// Arrête la musique seulement si c'est ce disque-là qui joue
// (ex. : le disque de la platine vient d'être retiré de la collection)
export function stopIfPlaying(key) {
  if (key && state.album?.key === key) stop()
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* rien */
  }
  if (!on) stop()
  set({ enabled: on })
}

// --- Pour React ---
const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function usePlayer() {
  return useSyncExternalStore(subscribe, () => state, () => state)
}