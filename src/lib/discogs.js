const DISCOGS_URL = 'https://api.discogs.com/database/search'
const token = import.meta.env.VITE_DISCOGS_TOKEN

export async function searchVinyls(query) {
  if (!token) {
    throw new Error('VITE_DISCOGS_TOKEN manquant dans .env.local')
  }

  const trimmed = query.trim()
  if (!trimmed) return []

  const params = new URLSearchParams({
    q: trimmed,
    type: 'master',
    format: 'vinyl',
    per_page: '12',
    token,
  })

  const response = await fetch(`${DISCOGS_URL}?${params}`)

  if (response.status === 429) {
    throw new Error('Trop de requêtes Discogs, réessaie dans une minute.')
  }
  if (!response.ok) {
    throw new Error(`Erreur Discogs (${response.status})`)
  }

  const data = await response.json()

  return data.results.map((item) => {
    // Discogs renvoie "Artiste - Titre" dans le champ title
    const [artist, ...rest] = item.title.split(' - ')
    return {
      discogs_id: item.master_id || item.id,
      artist: rest.length ? artist : 'Artiste inconnu',
      title: rest.length ? rest.join(' - ') : item.title,
      year: item.year || null,
      cover_url: item.cover_image || item.thumb || null,
    }
  })
}