import { searchArtists } from './discogs'
import { readJSON, writeJSON } from './cache'

const CACHE_KEY = 'vinyl-wishlist-artist-images-v1'
const DISCOGS_IMAGE = /^https:\/\/i\.discogs\.com\//

// Classiques proposés en plus des artistes de tes listes
export const CLASSICS = [
  'Daft Punk', 'Beyoncé', 'Bob Marley', 'Nina Simone', 'David Bowie', 'Rosalía',
  'Fela Kuti', 'Björk', 'Kendrick Lamar', 'Stromae', 'Amy Winehouse', 'Prince',
  'Aya Nakamura', 'The Beatles', 'Bad Bunny', 'Miles Davis', 'Frank Ocean', 'Billie Eilish',
  'Erykah Badu', 'Gorillaz', 'Ryuichi Sakamoto', 'Burna Boy', 'Kate Bush', 'Tame Impala',
]

const norm = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^the\s+/, '').trim()

// Image Discogs d'un artiste à partir de son nom (gardée en cache sur l'appareil).
// Renvoie { label, url } ou null si Discogs n'a pas de photo pour ce nom exact.
export async function findArtistImage(name) {
  const cache = readJSON(CACHE_KEY, {})
  const key = norm(name)
  if (key in cache) return cache[key]

  const results = await searchArtists(name)
  const hit = results.find((a) => norm(a.name) === key && a.image && DISCOGS_IMAGE.test(a.image))
  const value = hit ? { label: hit.name, url: hit.image } : null
  writeJSON(CACHE_KEY, { ...readJSON(CACHE_KEY, {}), [key]: value })
  return value
}

// Charge plusieurs artistes, quelques-uns à la fois (Discogs limite le nombre de requêtes).
// onResult(name, value) est appelé au fur et à mesure.
export async function loadArtistImages(names, onResult, { concurrency = 3, isCancelled = () => false } = {}) {
  const queue = [...names]
  let failures = 0
  async function worker() {
    while (queue.length && !isCancelled()) {
      const name = queue.shift()
      try {
        onResult(name, await findArtistImage(name))
      } catch {
        failures++
        onResult(name, null)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return { failures }
}

// Recherche libre : les artistes qui ont une photo
export async function searchArtistImages(query) {
  const results = await searchArtists(query)
  return results
    .filter((a) => a.image && DISCOGS_IMAGE.test(a.image))
    .map((a) => ({ label: a.name, url: a.image }))
}
