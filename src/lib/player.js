// Lecteur de la platine : joue les extraits (30 s par morceau) d'un album,
// trouvés sur Deezer, morceau après morceau.
//
// Deezer ne permet pas les appels directs depuis le navigateur (CORS) : on
// passe par « JSONP » (un <script> qui appelle une fonction), qu'il accepte.
// Le son peut être coupé dans le profil (réglage gardé sur l'appareil).

import { useSyncExternalStore } from 'react'

const SOUND_KEY = 'vinyl-wishlist-sound-v1'
const CACHE_KEY = 'vinyl-wishlist-previews-v1'

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
    audio.addEventListener('pause', () => state.status === 'playing' && set({ status: 'paused' }))
    audio.addEventListener('play', () => set({ status: 'playing' }))
  }
  return audio
}

// Les navigateurs (surtout l'iPhone) n'acceptent le son qu'après un geste :
// au premier toucher, on « débloque » le lecteur avec un son vide.
export function unlock() {
  if (unlocked) return
  unlocked = true
  const a = getAudio()
  a.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
  a.play().then(() => a.pause()).catch(() => {})
}
// Premier geste dans l'app (toucher, clic, touche) :
// - si un album attend de démarrer tout seul, il démarre maintenant ;
// - sinon on débloque simplement le lecteur pour plus tard.
// (Sauf si le geste vise un bouton du lecteur : c'est lui qui décide.)
function onFirstGesture(e) {
  if (e.target?.closest?.('[data-player-control]')) return
  document.removeEventListener('pointerdown', onFirstGesture, true)
  document.removeEventListener('keydown', onFirstGesture, true)
  if (state.status === 'waiting' && state.tracks.length) {
    unlocked = true
    playIndex(state.index)
  } else {
    unlock()
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', onFirstGesture, true)
  document.addEventListener('keydown', onFirstGesture, true)
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

// Les extraits d'un album : [{ title, preview }]
export async function findPreviews({ title, artist, deezerId }) {
  const id = deezerId ? `dz:${deezerId}` : `${norm(artist)}|${norm(title)}`
  const cache = readCache()
  if (cache[id]) return cache[id]
  // Album déjà connu sur Deezer (suggestions) : directement ses morceaux
  if (deezerId) {
    const res = await jsonp(`https://api.deezer.com/album/${deezerId}/tracks?limit=50`)
    const tracks = (res?.data || []).filter((x) => x.preview).map((x) => ({ title: x.title_short || x.title, preview: x.preview }))
    cache[id] = tracks
    writeCache(cache)
    return tracks
  }

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
  const album = list.find((x) => norm(x.artist?.name) === norm(a)) || list[0]
  let tracks = []
  if (album) {
    const res = await jsonp(`https://api.deezer.com/album/${album.id}/tracks?limit=50`)
    tracks = (res?.data || []).filter((x) => x.preview).map((x) => ({ title: x.title_short || x.title, preview: x.preview }))
  }
  cache[id] = tracks
  writeCache(cache)
  return tracks
}

// --- Commandes ---
let requestId = 0

export async function playAlbum(album, { force = false } = {}) {
  if (!album?.title || !album?.artist) return
  if (!state.enabled && !force) return
  const id = ++requestId
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
  a.play().catch(() => set({ status: 'paused' }))
}

// À l'ouverture de l'app : on lance le disque de la platine tout seul si le
// son est activé. Si le navigateur refuse (pas encore de geste), il démarre
// au premier toucher n'importe où dans l'app.
export async function autoStart(album) {
  if (!state.enabled || !album?.title || !album?.artist) return
  if (state.album?.key === album.key && state.status !== 'idle') return
  const id = ++requestId
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
  } catch {
    if (id === requestId) set({ status: 'waiting' })
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