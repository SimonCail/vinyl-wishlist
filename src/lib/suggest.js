// Suggestions de disques d'après mes souhaits et ma collection.
//
// Pour comprendre mes goûts, on passe par Deezer, qui sait quels artistes se
// ressemblent et lesquels sont écoutés :
//   1. les artistes que j'ai le plus → leurs autres albums
//   2. les artistes proches de ceux-là (« Si tu aimes SCH » → Jul, Ninho…)
//   3. ce que mes amis et les membres de mes salons ont ou veulent
// Les idées arrivent par « fournées » : chaque fournée va un peu plus loin
// (albums suivants de mes artistes, artistes proches suivants, puis les proches
// des proches…), pour que « Autres idées » propose toujours d'autres disques,
// en s'éloignant petit à petit de mes goûts.
// Pour un homonyme (plusieurs « SCH »), on garde celui qui a le plus de fans.
// Les disques eux-mêmes viennent de Discogs : pour chaque artiste, UNE recherche
// donne tous ses albums qui existent en vinyle, du plus populaire au moins
// populaire (rapide : Discogs limite le nombre de recherches par minute).
// Un disque déjà chez moi (même sous un titre un peu différent,
// « JVLIVS » / « JVLIVS Tome 1 : Absolu ») n'est pas proposé.
// Les résultats Deezer sont gardés 12 h sur l'appareil, les vérifications 14 jours.

import { jsonp, cleanTitle } from './player'

const BASE = 'https://api.discogs.com'
const token = import.meta.env.VITE_DISCOGS_TOKEN
const CACHE_KEY = 'vinyl-wishlist-suggestions-v5'
const TTL = 12 * 60 * 60 * 1000

const cleanName = (name = '') => name.replace(/\*$/, '').replace(/\s\(\d+\)$/, '')
const cleanImage = (url) => (!url || url.includes('spacer.gif') ? null : url)
export const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
// Nom d'artiste comparable : « The Jacksons » = « Jacksons », « Damso* » = « Damso »
const artistKey = (name = '') => norm(cleanName(name).replace(/^the\s+/i, ''))
export const titleKey = (v) => `${norm(cleanName(v.artist))}|${norm(cleanTitle(v.title))}`
// Le titre « de base » : sans sous-titre ni « Tome 1 »
// « JVLIVS Tome 1 : Absolu » → « jvlivs » ; « JVLIVS II » reste « jvlivsii »
export const coreTitle = (title = '') =>
  norm(
    cleanTitle(title)
      .replace(/[([].*?[)\]]/g, ' ')
      .split(/\s[:\-–—]\s|:\s|\s\/\s/)[0]
      .replace(/\b(tome|vol(ume)?\.?|chapitre|partie|part)\s*(1|i|one|un)\b/gi, ' ')
  )
// Les clés d'un album : titre complet et titre de base (même artiste)
export function albumKeys(v) {
  const a = artistKey(v.artist)
  const keys = [`${a}|${norm(cleanTitle(v.title))}`]
  const core = coreTitle(v.title)
  if (core && !keys.includes(`${a}|${core}`)) keys.push(`${a}|${core}`)
  return keys
}
const sameAlbum = (a, b) => {
  const kb = albumKeys(b)
  return albumKeys(a).some((k) => kb.includes(k))
}
const keyOf = (v) => (v.discogs_id ? `${v.discogs_type || 'master'}:${v.discogs_id}` : `dz:${v.deezer_id}`)

// --- Deezer ---
const dz = (path) => jsonp(`https://api.deezer.com${path}`)

// L'artiste Deezer qui correspond au nom : le plus écouté parmi les homonymes
async function findArtist(name) {
  const res = await dz(`/search/artist?q=${encodeURIComponent(name)}&limit=10`)
  const list = res?.data || []
  const exact = list.filter((a) => norm(a.name) === norm(name))
  return (exact.length ? exact : list.slice(0, 1)).sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0] || null
}


// Ce que j'écoute : les artistes les plus présents chez moi
export function tasteOf(myItems, n = 5) {
  const artists = new Map()
  for (const v of myItems) {
    const name = cleanName(v.artist || '')
    if (!name || /various|artiste inconnu/i.test(name)) continue
    const w = v.status === 'owned' ? 2 : 1 // ce qu'on a déjà compte un peu plus
    artists.set(name, (artists.get(name) || 0) + w)
  }
  // Égalité : ordre alphabétique, pour que la sélection reste stable
  return [...artists.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n)
}

// Tout ce qu'on a appris de Deezer, gardé 12 h : le plan (mes artistes et les
// artistes proches), les albums de mes artistes et les fournées déjà faites
let mem = null
function getMem(sig) {
  if (mem?.sig === sig && Date.now() - mem.at < TTL) return mem
  let c = null
  try {
    c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  } catch {
    /* rien */
  }
  mem = c && c.sig === sig && Date.now() - c.at < TTL ? c : { sig, at: Date.now(), plan: null, albums: {}, batches: {} }
  return mem
}
function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(mem))
  } catch {
    /* plein */
  }
}

// Mélange des listes, un élément de chacune à tour de rôle
function interleave(lists) {
  const out = []
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i])
  return out
}

// Le plan : mes 5 artistes principaux sur Deezer, et leurs artistes proches
// (une file où les proches de chacun de mes artistes alternent).
// La file s'allonge ensuite avec les proches des proches (de plus en plus loin).
async function buildPlan(top) {
  const found = await Promise.allSettled(top.map(([name]) => findArtist(name)))
  const own = found.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean)
  if (!own.length) {
    if (found.some((r) => r.status === 'rejected')) throw new Error('Deezer ne répond pas')
    return { own: [], near: [], expanded: 0 }
  }
  const rel = await Promise.allSettled(own.map((a) => dz(`/artist/${a.id}/related?limit=25`)))
  const ownIds = new Set(own.map((a) => a.id))
  const ownNames = new Set(top.map(([name]) => artistKey(name)))
  const lists = rel.map((r, i) =>
    (r.status === 'fulfilled' ? r.value?.data || [] : [])
      .sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))
      .map((a) => ({ id: a.id, name: a.name, because: own[i].name, depth: 1 }))
  )
  const seen = new Set()
  const near = interleave(lists).filter((a) => {
    if (ownIds.has(a.id) || ownNames.has(artistKey(a.name)) || seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })
  return { own: own.map((a) => ({ id: a.id, name: a.name })), near, expanded: 0, ownNames: [...ownNames] }
}

// Un cran plus loin : les proches du prochain artiste de la file
async function expandOnce(plan) {
  const parent = plan.near[plan.expanded]
  if (!parent) return false
  plan.expanded++
  let list = []
  try {
    list = (await dz(`/artist/${parent.id}/related?limit=15`))?.data || []
  } catch {
    return true // on passe au suivant
  }
  const known = new Set([...plan.own.map((a) => a.id), ...plan.near.map((a) => a.id)])
  const ownNames = new Set(plan.ownNames || [])
  list
    .sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))
    .filter((a) => !known.has(a.id) && !ownNames.has(artistKey(a.name)))
    .slice(0, 5)
    .forEach((a) => plan.near.push({ id: a.id, name: a.name, because: parent.name, depth: (parent.depth || 1) + 1 }))
  return true
}

const OWN_PER_BATCH = 2 // albums de chacun de mes artistes par fournée
const NEAR_PER_BATCH = 5 // artistes proches par fournée
// Albums par artiste : 2 pour les proches de mes artistes, 3 plus loin (moins de recherches Discogs)
const albumsFor = (a) => (a.depth > 1 ? 3 : 2)

const reasonFor = (a) => (a.depth > 1 ? `Dans la lignée de ${a.because}` : `Si tu aimes ${a.because}`)

// Les albums vinyles d'un artiste sur Discogs, du plus populaire au moins populaire
// (gardés avec le reste, 12 h)
async function vinylsOf(m, name) {
  m.vinyls ??= {}
  const key = artistKey(name)
  if (m.vinyls[key]) return m.vinyls[key]
  const res = await discogsSearch({ type: 'master', artist: name, format: 'Vinyl', per_page: '50' })
  const popularity = (r) => (r.community?.have || 0) + 2 * (r.community?.want || 0)
  const credit = (r) => (r.title || '').split(' - ')[0].trim() // « SCH (2) » tel quel
  const albums = res
    .filter((r) => !(r.format || []).some((f) => /single|compilation|^ep$/i.test(f))) // les albums
    .map((r) => ({ r, d: parseDiscogs(r) }))
    .filter(({ d }) => artistKey(d.artist) === key)
  // Homonymes sur Discogs (« SCH » et « SCH (2) ») : on garde le plus populaire
  const byCredit = new Map()
  for (const a of albums) byCredit.set(credit(a.r), (byCredit.get(credit(a.r)) || 0) + popularity(a.r))
  const best = [...byCredit.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const seen = new Set()
  const list = albums
    .filter(({ r }) => credit(r) === best)
    .sort((a, b) => popularity(b.r) - popularity(a.r))
    .filter(({ d }) => {
      const t = coreTitle(d.title) // une seule version de chaque album
      if (!t || seen.has(t)) return false
      seen.add(t)
      return true
    })
    .map(({ d }) => ({ ...d, artist: d.artist === 'Artiste inconnu' ? name : d.artist }))
  m.vinyls[key] = list
  return list
}

async function buildBatch(m, k, isMine = () => false) {
  const plan = m.plan
  plan.expanded ??= 0
  // Pas assez d'artistes dans la file pour cette fournée : on va un cran plus loin
  for (let tries = 0; plan.near.length < (k + 1) * NEAR_PER_BATCH && tries < 8; tries++) {
    if (!(await expandOnce(plan))) break
  }
  const { own, near } = plan
  const ownPart = await Promise.allSettled(
    own.map(async (a) =>
      (await vinylsOf(m, a.name))
        .filter((d) => !isMine(d)) // d'abord retirer ce que j'ai déjà, puis prendre les suivants
        .slice(k * OWN_PER_BATCH, (k + 1) * OWN_PER_BATCH)
        .map((item) => ({ item, reason: `Un autre album de ${a.name}` }))
    )
  )
  const nearPart = await Promise.allSettled(
    near
      .slice(k * NEAR_PER_BATCH, (k + 1) * NEAR_PER_BATCH)
      .map(async (a) =>
        (await vinylsOf(m, a.name))
          .filter((d) => !isMine(d))
          .slice(0, albumsFor(a))
          .map((item) => ({ item, reason: reasonFor(a) }))
      )
  )
  const all = [...ownPart, ...nearPart]
  const items = interleave(all.map((r) => (r.status === 'fulfilled' ? r.value : [])))
  if (!items.length && all.some((r) => r.status === 'rejected')) throw new Error('Discogs ne répond pas')
  const more =
    (k + 1) * NEAR_PER_BATCH < near.length ||
    plan.expanded < near.length || // on peut encore aller plus loin
    own.some((a) => (m.vinyls?.[artistKey(a.name)]?.filter((d) => !isMine(d)).length ?? 0) > (k + 1) * OWN_PER_BATCH)
  return { items, more }
}

const pending = new Map()
function once(key, fn) {
  if (!pending.has(key)) pending.set(key, fn().finally(() => pending.delete(key)))
  return pending.get(key)
}

// Fournée n° k d'idées d'après mes goûts : { items: [{ item, reason }], more }
export async function tasteBatch(myItems, k) {
  const top = tasteOf(myItems)
  const sig = JSON.stringify(top.map((a) => a[0]))
  let m = getMem(sig)
  if (!m.plan) {
    const plan = await once(`plan:${sig}`, () => buildPlan(top))
    m = getMem(sig)
    m.plan = plan
    persist()
  }
  if (m.batches[k]) return m.batches[k]
  // Mes disques (même titre un peu différent, ou même fiche Discogs)
  const myKeys = new Set(myItems.flatMap(albumKeys))
  const myIds = new Set(myItems.map((v) => `${v.discogs_type || 'master'}:${v.discogs_id}`))
  const isMine = (d) => myIds.has(`${d.discogs_type || 'master'}:${d.discogs_id}`) || albumKeys(d).some((x) => myKeys.has(x))
  const batch = await once(`batch:${sig}:${k}`, () => buildBatch(m, k, isMine))
  m = getMem(sig)
  m.batches[k] = batch
  persist()
  return batch
}

// --- Discogs : le disque existe-t-il en vinyle ? ---
// Discogs accepte 60 recherches par minute : on reste en dessous.
const calls = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function budget() {
  for (;;) {
    const now = Date.now()
    while (calls.length && now - calls[0] > 60000) calls.shift()
    if (calls.length < 55) return calls.push(now) // on laisse de la marge au reste de l'app
    await sleep(60000 - (now - calls[0]) + 50)
  }
}

async function discogsSearch(params) {
  if (!token) throw new Error('VITE_DISCOGS_TOKEN manquant')
  const qs = new URLSearchParams({ per_page: '10', ...params, token })
  // Discogs saturé (429) : on attend un peu et on réessaie
  for (let attempt = 0; ; attempt++) {
    await budget()
    const res = await fetch(`${BASE}/database/search?${qs}`)
    if (res.ok) return (await res.json()).results || []
    if (res.status !== 429 || attempt >= 3) throw new Error(`Erreur Discogs (${res.status})`)
    await sleep(5000 * 2 ** attempt)
  }
}

function parseDiscogs(it) {
  const [credit, ...rest] = (it.title || '').split(' - ')
  return {
    discogs_id: it.master_id || it.id,
    discogs_type: it.type === 'master' || it.master_id ? 'master' : 'release',
    artist: rest.length ? cleanName(credit) : 'Artiste inconnu',
    title: rest.length ? rest.join(' - ') : it.title,
    year: it.year ? String(it.year) : null,
    cover_url: cleanImage(it.cover_image) || cleanImage(it.thumb),
    kind: 'Album',
  }
}

// La fiche Discogs (vinyle) d'un album Deezer, ou null s'il n'existe pas en vinyle.
// Même artiste obligatoire ; titre identique de préférence, sinon un titre qui
// commence pareil (« Ipséité » / « Ipséité (Édition Collector) »).
export async function resolveOnDiscogs(item) {
  if (item.discogs_id) return item
  const artist = artistKey(item.artist)
  const core = coreTitle(item.title)
  const pick = (results) => {
    const same = results.map(parseDiscogs).filter((d) => artistKey(d.artist) === artist)
    return (
      same.find((d) => sameAlbum(d, item)) ||
      same.find((d) => {
        const c = coreTitle(d.title)
        const [short, long] = c.length < core.length ? [c, core] : [core, c]
        // …mais pas une suite : « JVLIVS » ≠ « JVLIVS II », « A7 » ≠ « A72 »
        return short.length >= 3 && long.startsWith(short) && !/^(\d+|[ivx]+)$/.test(long.slice(short.length))
      })
    )
  }
  // Une seule recherche par album (Discogs limite le nombre de recherches par minute)
  const d = pick(await discogsSearch({ type: 'master', artist: item.artist, release_title: item.title, format: 'Vinyl' }))
  if (!d) return null
  return { ...d, year: d.year || item.year, cover_url: d.cover_url || item.cover_url }
}

// Vérifications gardées sur l'appareil (14 jours)
const CHECK_KEY = 'vinyl-wishlist-vinyl-check-v1'
const CHECK_TTL = 14 * 24 * 60 * 60 * 1000
let checks = null
function readChecks() {
  if (!checks) {
    try {
      checks = JSON.parse(localStorage.getItem(CHECK_KEY) || '{}')
    } catch {
      checks = {}
    }
  }
  return checks
}
function saveChecks() {
  try {
    const keys = Object.keys(checks)
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((k) => delete checks[k])
    localStorage.setItem(CHECK_KEY, JSON.stringify(checks))
  } catch {
    /* plein */
  }
}
// Déjà vérifié ? → { vinyl } (vinyl = fiche Discogs ou null), sinon undefined
export function knownVinyl(item) {
  const e = readChecks()[`dz:${item.deezer_id}`]
  return e && Date.now() - e.at < CHECK_TTL ? { vinyl: e.d } : undefined
}
const inFlight = new Map()
// Vérifie qu'un album Deezer existe en vinyle (fiche Discogs ou null)
export function verifyVinyl(item) {
  const known = knownVinyl(item)
  if (known) return Promise.resolve(known.vinyl)
  const id = `dz:${item.deezer_id}`
  if (!inFlight.has(id)) {
    inFlight.set(
      id,
      resolveOnDiscogs(item)
        .then((d) => {
          readChecks()[id] = { d, at: Date.now() }
          saveChecks()
          return d
        })
        .finally(() => inFlight.delete(id))
    )
  }
  return inFlight.get(id)
}

// --- Mes proches ---
// others : [{ vinyl, person }] (amis et membres de mes salons)
export function peopleSuggestions(others, myArtists) {
  const map = new Map()
  for (const { vinyl, person } of others) {
    const k = titleKey(vinyl)
    const e = map.get(k) ?? { item: vinyl, people: [], score: 0 }
    if (!e.people.some((p) => p.id === person.id)) e.people.push(person)
    e.score += 1 + (myArtists.has(norm(cleanName(vinyl.artist))) ? 2 : 0) + (vinyl.status === 'owned' ? 0.5 : 0)
    map.set(k, e)
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ item, people }) => ({
      item: {
        discogs_id: item.discogs_id,
        discogs_type: item.discogs_type,
        artist: item.artist,
        title: item.title,
        year: item.year,
        cover_url: item.cover_url,
        kind: item.kind ?? null,
      },
      reason:
        people.length > 1
          ? `${people[0].name} et ${people.length - 1} autre${people.length > 2 ? 's' : ''} l’ont`
          : `${people[0].name} ${item.status === 'owned' ? 'l’a' : 'le veut aussi'}`,
      people,
    }))
}

// Mélange les sources (une de chaque à tour de rôle), sans doublon ni disque déjà chez moi
export function mergeSuggestions(sources, myItems, limit = 40) {
  const mine = new Set(myItems.flatMap(albumKeys))
  const seen = new Set()
  const queues = sources.map((s) => [...s])
  const out = []
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length) {
        const s = q.shift()
        const keys = albumKeys(s.item)
        if (keys.some((k) => mine.has(k) || seen.has(k))) continue
        keys.forEach((k) => seen.add(k))
        out.push({ ...s, key: keyOf(s.item) })
        break
      }
      if (out.length >= limit) break
    }
  }
  return out
}