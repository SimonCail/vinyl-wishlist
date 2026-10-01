const BASE = 'https://api.discogs.com'
const token = import.meta.env.VITE_DISCOGS_TOKEN
const MAX_PAGES = 5

async function discogsFetch(path, params = {}) {
  if (!token) throw new Error('VITE_DISCOGS_TOKEN manquant')

  const qs = new URLSearchParams({ ...params, token })
  let response
  try {
    response = await fetch(`${BASE}${path}?${qs}`)
  } catch {
    throw new Error('Connexion impossible. Vérifie ton réseau.')
  }

  if (response.status === 429) {
    throw Object.assign(new Error('Trop de requêtes Discogs, réessaie dans une minute.'), { status: 429 })
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Erreur Discogs (${response.status})`), { status: response.status })
  }
  return response.json()
}

// --- Identité d'un disque : type + numéro ---

export const itemKey = (v) => `${v.discogs_type || 'master'}:${v.discogs_id}`

export const discogsUrl = (v) =>
  `https://www.discogs.com/${v.discogs_type === 'release' ? 'release' : 'master'}/${v.discogs_id}`

// --- Petits utilitaires ---

// Discogs ajoute un numéro aux homonymes : "Hamza (3)" -> "Hamza"
const cleanName = (name) => name.replace(/\s\(\d+\)$/, '')

// Discogs renvoie une image vide ("spacer.gif") quand il n'y a pas de pochette
const cleanImage = (url) => (!url || url.includes('spacer.gif') ? null : url)

const norm = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Garde-fou : on vérifie nous-mêmes que le pressage est bien un vinyle
const isVinyl = (item) =>
  !Array.isArray(item.format) ||
  item.format.length === 0 ||
  item.format.some((f) => /vinyl/i.test(f))

// Album, EP, single, compilation… d'après les mentions du pressage
function kindOf(item) {
  const f = (item.format || []).map((x) => x.toLowerCase())
  if (f.includes('compilation')) return 'Compilation'
  if (f.includes('mixtape')) return 'Mixtape'
  if (f.includes('ep') || f.includes('mini-album')) return 'EP'
  if (f.includes('single') || f.includes('maxi-single')) return 'Single'
  if (f.includes('album') || f.includes('lp')) return 'Album'
  return null
}

// "Artiste - Titre" -> la partie artiste
const creditOf = (item) => {
  const parts = item.title.split(' - ')
  return parts.length > 1 ? parts[0] : ''
}

// L'artiste est-il crédité ? (gère "A, B", "A & B", "A feat. B", "A x B")
function creditsInclude(credit, name) {
  const target = norm(name)
  return credit
    .split(/\s*(?:,|&|\/|\+|\bfeat\.?|\bft\.?|\sx\s)\s*/i)
    .some((part) => norm(part) === target)
}

// Pressage trouvé -> disque de notre liste.
// Avec une fiche master on garde le master, sinon on garde le pressage lui-même.
function parseResult(item) {
  const [credit, ...rest] = item.title.split(' - ')
  const hasArtist = rest.length > 0
  return {
    discogs_id: item.master_id || item.id,
    discogs_type: item.master_id ? 'master' : 'release',
    artist: hasArtist ? cleanName(credit) : 'Artiste inconnu',
    title: hasArtist ? rest.join(' - ') : item.title,
    year: item.year ? String(item.year) : null,
    cover_url: imageOf(item),
    kind: kindOf(item),
  }
}

const imageOf = (it) => cleanImage(it.cover_image) || cleanImage(it.thumb)

// Plusieurs pressages d'un même album -> une seule ligne (le plus ancien).
// Sans fiche master, on regroupe les pressages qui ont le même titre.
// Le plus ancien pressage n'a souvent pas de photo : on prend alors la
// pochette d'un autre pressage du même album.
function pickOnePerAlbum(items) {
  const groups = new Map()
  for (const it of items) {
    const key = it.master_id ? `m:${it.master_id}` : `t:${norm(it.title)}`
    const g = groups.get(key) || { pick: null, image: null }
    if (!g.pick || (it.year && (!g.pick.year || Number(it.year) < Number(g.pick.year)))) {
      g.pick = it
    }
    if (!g.image) g.image = imageOf(it)
    groups.set(key, g)
  }
  return [...groups.values()].map(({ pick, image }) => {
    const parsed = parseResult(pick)
    return { ...parsed, cover_url: parsed.cover_url || image }
  })
}

// --- Fonctions utilisées par l'app ---

// Recherche par mot-clé (tous les vinyles : albums, EP, singles, compilations)
export async function searchVinyls(query) {
  const trimmed = query.trim()
  if (!trimmed) return []

  const data = await discogsFetch('/database/search', {
    q: trimmed,
    type: 'release',
    format: 'vinyl',
    per_page: '100',
  })

  return pickOnePerAlbum(data.results.filter(isVinyl)).slice(0, 24)
}

// Recherche d'artistes
export async function searchArtists(query) {
  const trimmed = query.trim()
  if (!trimmed) return []

  const data = await discogsFetch('/database/search', {
    type: 'artist',
    q: trimmed,
    per_page: '6',
  })

  return data.results.map((a) => ({
    id: a.id,
    name: cleanName(a.title),
    rawName: a.title, // avec le numéro d'homonyme éventuel
    image: cleanImage(a.cover_image) || cleanImage(a.thumb),
  }))
}

// Discographie vinyle complète d'un artiste
export async function getArtistAlbums(artist) {
  const params = {
    type: 'release',
    format: 'vinyl',
    artist: artist.name,
    sort: 'year',
    sort_order: 'desc',
    per_page: '100',
  }

  const first = await discogsFetch('/database/search', { ...params, page: '1' })
  const pages = Math.min(first.pagination?.pages || 1, MAX_PAGES)
  const others = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      discogsFetch('/database/search', { ...params, page: String(i + 2) })
    )
  )

  const eligible = [first, ...others].flatMap((d) => d.results).filter(isVinyl)

  // D'abord avec le nom exact (numéro d'homonyme compris), sinon sans le numéro
  const strict = eligible.filter((r) => creditsInclude(creditOf(r), artist.rawName))
  const kept = strict.length
    ? strict
    : eligible.filter((r) => creditsInclude(creditOf(r), artist.name))

  return pickOnePerAlbum(kept).sort(
    (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0)
  )
}

// Image principale d'une fiche Discogs (master ou pressage)
function primaryImage(d) {
  const list = d.images || []
  const img = list.find((i) => i.type === 'primary') || list[0]
  return cleanImage(img?.uri) || cleanImage(img?.uri150)
}

// --- Import d'une collection / wantlist Discogs ---

const IMPORT_MAX_PAGES = 30 // 3 000 disques par liste, largement assez
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// « https://www.discogs.com/fr/user/Serena_V/collection », « @serena_v »… -> « Serena_V »
export function cleanDiscogsUsername(raw) {
  const text = (raw || '').trim()
  const fromUrl = /discogs\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?user\/([^/?#\s]+)/i.exec(text)
  return decodeURIComponent(fromUrl ? fromUrl[1] : text.replace(/^@/, '')).trim()
}

function importError(e, kind) {
  if (e.status === 404) return 'Aucun compte Discogs avec ce nom. Vérifie l’orthographe (c’est ton nom d’utilisateur, pas ton email).'
  if (e.status === 401 || e.status === 403) {
    return kind === 'owned'
      ? 'Ta collection Discogs est privée. Rends-la publique dans Discogs › Paramètres › Confidentialité, importe, puis tu pourras la remettre en privé.'
      : 'Ta wantlist Discogs est privée. Rends-la publique dans Discogs › Paramètres › Confidentialité, importe, puis tu pourras la remettre en privé.'
  }
  return e.message
}

// Une ligne de collection / wantlist Discogs -> disque de notre liste (ou null si pas un vinyle)
function fromUserItem(row) {
  const b = row.basic_information || {}
  const formats = b.formats || []
  if (formats.length && !formats.some((f) => /vinyl/i.test(f.name))) return null
  const descriptions = formats.flatMap((f) => f.descriptions || [])
  const names = (b.artists || []).map((a) => cleanName(a.name))
  return {
    discogs_id: b.master_id || b.id,
    discogs_type: b.master_id ? 'master' : 'release',
    artist: names.length ? names.join(', ') : 'Artiste inconnu',
    title: b.title || 'Sans titre',
    year: b.year ? String(b.year) : null,
    cover_url: cleanImage(b.cover_image) || cleanImage(b.thumb) || null,
    kind: kindOf({ format: descriptions }),
    genres: b.genres || [],
    styles: b.styles || [],
    added_at: row.date_added || null,
  }
}

// Lit toute la collection (kind = 'owned') ou la wantlist (kind = 'wish') d'un
// utilisateur Discogs. onProgress({ done, total }) est appelé à chaque page.
// Renvoie { items, skipped } : un disque par album, vinyles seulement ;
// skipped = nombre de CD, cassettes… ignorés.
export async function fetchDiscogsList(username, kind, onProgress) {
  const user = encodeURIComponent(username)
  const path = kind === 'owned' ? `/users/${user}/collection/folders/0/releases` : `/users/${user}/wants`
  const rows = []
  let page = 1
  let pages = 1
  try {
    do {
      const data = await discogsFetch(path, {
        per_page: '100',
        page: String(page),
        sort: 'added',
        sort_order: 'desc',
      })
      rows.push(...((kind === 'owned' ? data.releases : data.wants) || []))
      pages = Math.min(data.pagination?.pages || 1, IMPORT_MAX_PAGES)
      onProgress?.({ done: rows.length, total: data.pagination?.items ?? rows.length })
      page++
      // Petite pause entre les pages pour rester sous la limite de Discogs
      if (page <= pages) await wait(1100)
    } while (page <= pages)
  } catch (e) {
    throw new Error(importError(e, kind))
  }

  const byKey = new Map()
  let skipped = 0
  for (const row of rows) {
    const item = fromUserItem(row)
    if (!item) {
      skipped++
      continue
    }
    if (!byKey.has(itemKey(item))) byKey.set(itemKey(item), item) // plusieurs pressages = un album
  }
  return { items: [...byKey.values()], skipped, total: rows.length }
}

// Recherche par code-barres (dos de pochette).
// Discogs range les codes américains en UPC (12 chiffres) ou en EAN (13, avec un 0
// devant) : on essaie les deux. Renvoie { items, notVinyl } — notVinyl = le code
// correspond à un CD ou une cassette du même album.
function barcodeVariants(code) {
  const v = [code]
  if (code.length === 13 && code.startsWith('0')) v.push(code.slice(1))
  if (code.length === 12) v.push(`0${code}`)
  return v
}

export async function searchByBarcode(code) {
  for (const barcode of barcodeVariants(code)) {
    const data = await discogsFetch('/database/search', {
      barcode,
      type: 'release',
      per_page: '25',
    })
    if (!data.results?.length) continue
    const vinyl = data.results.filter(
      (r) => Array.isArray(r.format) && r.format.some((f) => /vinyl/i.test(f))
    )
    const list = vinyl.length ? vinyl : data.results
    return { items: pickOnePerAlbum(list), notVinyl: vinyl.length === 0 }
  }
  return { items: [], notVinyl: false }
}

// --- Détails d'un disque, avec cache ---
// Les titres d'un album ne changent pas : on les garde sur l'appareil pour que
// la fiche s'ouvre instantanément. Le prix, lui, est rafraîchi s'il date de plus
// de FRESH_MS (on affiche l'ancien en attendant).
const DETAILS_KEY = 'vinyl-wishlist-details-v1'
const FRESH_MS = 6 * 60 * 60 * 1000 // 6 h
const MAX_SAVED = 150

const detailsCache = new Map() // clé -> { data, at }
const inFlight = new Map() // clé -> Promise (évite deux requêtes pour le même disque)

try {
  const saved = JSON.parse(localStorage.getItem(DETAILS_KEY) || '[]')
  for (const [k, v] of saved) detailsCache.set(k, v)
} catch {
  // cache illisible : on repart de zéro
}

let saveTimer = null
function saveDetailsNow() {
  clearTimeout(saveTimer)
  saveTimer = null
  try {
    const recent = [...detailsCache.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_SAVED)
    localStorage.setItem(DETAILS_KEY, JSON.stringify(recent))
  } catch {
    // stockage plein : tant pis, le cache mémoire suffit
  }
}

function persistDetails() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDetailsNow, 300)
}
// Si on quitte la page juste après un chargement, on sauvegarde quand même
window.addEventListener('pagehide', () => {
  if (saveTimer) saveDetailsNow()
})

// Détails déjà connus (même anciens), sans requête : { data, fresh } ou null
export function peekDetails(item) {
  const hit = detailsCache.get(itemKey(item))
  return hit ? { data: hit.data, fresh: Date.now() - hit.at < FRESH_MS } : null
}

// Détails d'un disque : genres, prix le plus bas, pistes, vidéos, pochette.
// Va toujours chercher la version à jour sur Discogs (et met le cache à jour).
export function getDetails(item) {
  const key = itemKey(item)
  if (inFlight.has(key)) return inFlight.get(key)
  const path =
    item.discogs_type === 'release'
      ? `/releases/${item.discogs_id}`
      : `/masters/${item.discogs_id}`

  const request = discogsFetch(path, { curr_abbr: 'EUR' })
    .then((d) => {
      const data = {
        genres: d.genres || [],
        styles: d.styles || [],
        lowest_price: d.lowest_price ?? null,
        num_for_sale: d.num_for_sale ?? null,
        cover_url: primaryImage(d),
        tracklist: (d.tracklist || []).map((t) => ({
          position: t.position,
          title: t.title,
          duration: t.duration,
        })),
        videos: (d.videos || []).map((v) => ({ title: v.title, uri: v.uri })),
      }
      detailsCache.set(key, { data, at: Date.now() })
      persistDetails()
      return data
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

// Précharge les détails (au survol d'une carte) si on ne les a pas déjà, à jour
export function prefetchDetails(item) {
  const known = peekDetails(item)
  if (known?.fresh || inFlight.has(itemKey(item))) return
  getDetails(item).catch(() => {})
}
