const normalize = (s = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'priority', label: 'Priorité' },
  { value: 'artist', label: 'Artiste (A-Z)' },
  { value: 'title', label: 'Titre (A-Z)' },
  { value: 'year', label: 'Année (récent)' },
  { value: 'price', label: 'Prix (croissant)' },
]

const byRecent = (a, b) => new Date(b.created_at) - new Date(a.created_at)

// Les disques sans prix passent en dernier
const priceOf = (v) => (v.lowest_price == null ? Infinity : Number(v.lowest_price))

const sorters = {
  recent: byRecent,
  priority: (a, b) => b.priority - a.priority || byRecent(a, b),
  artist: (a, b) => a.artist.localeCompare(b.artist, 'fr'),
  title: (a, b) => a.title.localeCompare(b.title, 'fr'),
  year: (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0),
  price: (a, b) => {
    const pa = priceOf(a)
    const pb = priceOf(b)
    if (pa === pb) return byRecent(a, b)
    return pa < pb ? -1 : 1
  },
}

export function filterAndSort(vinyls, { sort, search, genre, person }) {
  const q = normalize(search.trim())

  return vinyls
    .filter((v) => {
      if (genre && !(v.genres || []).includes(genre)) return false
      if (person && v.added_by !== person) return false
      if (!q) return true
      return normalize(`${v.title} ${v.artist}`).includes(q)
    })
    .sort(sorters[sort])
}

// Liste des genres et des personnes présents, avec leur nombre de disques
export function getFacets(vinyls) {
  const genres = new Map()
  const people = new Map()

  for (const v of vinyls) {
    for (const g of v.genres || []) genres.set(g, (genres.get(g) || 0) + 1)
    if (v.added_by) people.set(v.added_by, (people.get(v.added_by) || 0) + 1)
  }

  const toList = (map) =>
    [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))

  return { genres: toList(genres), people: toList(people) }
}

// Total des prix les plus bas, et nombre de disques sans prix
export function getTotals(list) {
  let total = 0
  let pricedCount = 0

  for (const v of list) {
    if (v.lowest_price != null) {
      total += Number(v.lowest_price)
      pricedCount++
    }
  }
  return { total, pricedCount, unpricedCount: list.length - pricedCount }
}