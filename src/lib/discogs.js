const BASE = 'https://api.discogs.com'
const token = import.meta.env.VITE_DISCOGS_TOKEN

async function discogsFetch(path, params = {}) {
  if (!token) throw new Error('VITE_DISCOGS_TOKEN manquant dans .env.local')

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

// Discogs ajoute un numéro aux homonymes : "Hamza (3)" -> "Hamza"
const cleanName = (name) => name.replace(/\s\(\d+\)$/, '')

// Discogs renvoie une image vide ("spacer.gif") quand il n'y a pas de pochette
const cleanImage = (url) => (!url || url.includes('spacer.gif') ? null : url)

// Recherche d'albums par mot-clé
export async function searchVinyls(query) {
  const trimmed = query.trim()
  if (!trimmed) return []

  const data = await discogsFetch('/database/search', {
    q: trimmed,
    type: 'master',
    format: 'vinyl',
    per_page: '12',
  })

  return data.results.map((item) => {
    const [artist, ...rest] = item.title.split(' - ')
    return {
      discogs_id: item.master_id || item.id,
      artist: rest.length ? cleanName(artist) : 'Artiste inconnu',
      title: rest.length ? rest.join(' - ') : item.title,
      year: item.year ? String(item.year) : null,
      cover_url: cleanImage(item.cover_image) || cleanImage(item.thumb),
    }
  })
}

// Recherche d'artistes
export async function searchArtists(query) {
  const trimmed = query.trim()
  if (!trimmed) return []

  const data = await discogsFetch('/database/search', {
    q: trimmed,
    type: 'artist',
    per_page: '6',
  })

  return data.results.map((a) => ({
    id: a.id,
    name: cleanName(a.title),
    image: cleanImage(a.cover_image) || cleanImage(a.thumb),
  }))
}

// Discographie d'un artiste (albums où il est artiste principal)
export async function getArtistAlbums(artistId) {
  const data = await discogsFetch(`/artists/${artistId}/releases`, {
    sort: 'year',
    sort_order: 'desc',
    per_page: '100',
  })

  return data.releases
    .filter((r) => r.type === 'master' && r.role === 'Main')
    .map((r) => ({
      discogs_id: r.id,
      artist: cleanName(r.artist),
      title: r.title,
      year: r.year ? String(r.year) : null,
      cover_url: cleanImage(r.thumb),
    }))
}

// Détails d'un album (master) : genres, prix le plus bas, pistes, vidéos
export async function getMasterDetails(masterId) {
  const d = await discogsFetch(`/masters/${masterId}`, { curr_abbr: 'EUR' })

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