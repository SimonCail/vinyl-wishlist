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
    throw new Error('Trop de requêtes Discogs, réessaie dans une minute.')
  }
  if (!response.ok) throw new Error(`Erreur Discogs (${response.status})`)
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
    cover_url: cleanImage(item.cover_image) || cleanImage(item.thumb),
    kind: kindOf(item),
  }
}

// Plusieurs pressages d'un même album -> une seule ligne (le plus ancien).
// Sans fiche master, on regroupe les pressages qui ont le même titre.
function pickOnePerAlbum(items) {
  const groups = new Map()
  for (const it of items) {
    const key = it.master_id ? `m:${it.master_id}` : `t:${norm(it.title)}`
    const prev = groups.get(key)
    if (!prev || (it.year && (!prev.year || Number(it.year) < Number(prev.year)))) {
      groups.set(key, it)
    }
  }
  return [...groups.values()].map(parseResult)
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

// Détails d'un disque : genres, prix le plus bas, pistes, vidéos
export async function getDetails(item) {
  const path =
    item.discogs_type === 'release'
      ? `/releases/${item.discogs_id}`
      : `/masters/${item.discogs_id}`
  const d = await discogsFetch(path, { curr_abbr: 'EUR' })

  return {
    genres: d.genres || [],
    styles: d.styles || [],
    lowest_price: d.lowest_price ?? null,
    num_for_sale: d.num_for_sale ?? null,
    tracklist: (d.tracklist || []).map((t) => ({
      position: t.position,
      title: t.title,
      duration: t.duration,
    })),
    videos: (d.videos || []).map((v) => ({ title: v.title, uri: v.uri })),
  }
}
