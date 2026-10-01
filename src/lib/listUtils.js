import { itemKey } from './discogs'

const normalize = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Réunit les disques des membres d'un espace : une carte par disque.
// Chaque carte garde :
//   owners : les membres qui ont ce disque dans ce bac
//   mine   : true si le disque est dans MA liste (je peux le modifier)
//   myItem : ma ligne en base (pour les modifications), sinon null
// Si j'ai le disque, la carte affiche mes infos (étoiles, note) ; sinon celles du
// premier membre, avec la plus forte envie du groupe.
export function mergeItems(items, members, status, meId) {
  const byId = new Map(members.map((m) => [m.id, m]))
  const byKey = new Map()

  for (const it of items) {
    if (it.status !== status || !byId.has(it.owner_id)) continue
    const key = itemKey(it)
    const owner = byId.get(it.owner_id)
    const prev = byKey.get(key)

    if (!prev) {
      byKey.set(key, {
        ...it,
        key,
        owners: [owner],
        mine: it.owner_id === meId,
        myItem: it.owner_id === meId ? it : null,
      })
      continue
    }

    prev.owners.push(owner)
    if (it.owner_id === meId) {
      // Mes infos priment, en gardant la date d'ajout la plus récente pour le tri
      const created_at = prev.created_at > it.created_at ? prev.created_at : it.created_at
      Object.assign(prev, { ...it, key, owners: prev.owners, mine: true, myItem: it, created_at })
    } else {
      prev.priority = prev.mine ? prev.priority : Math.max(prev.priority, it.priority)
      if (prev.created_at < it.created_at) prev.created_at = it.created_at
      if (prev.lowest_price == null && it.lowest_price != null) {
        prev.lowest_price = it.lowest_price
        prev.num_for_sale = it.num_for_sale
      }
    }
  }

  // Ordre d'arrivée des membres pour les avatars
  const order = new Map(members.map((m, i) => [m.id, i]))
  for (const v of byKey.values()) v.owners.sort((a, b) => order.get(a.id) - order.get(b.id))

  return [...byKey.values()]
}

// Filtre « De » : un membre précis, ou les disques partagés par plusieurs membres
export function filterByPerson(list, person) {
  if (!person) return list
  if (person === '__shared') return list.filter((v) => v.owners.length > 1)
  return list.filter((v) => v.owners.some((o) => o.id === person))
}

export const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'priority', label: 'Priorité' },
  { value: 'artist', label: 'Artiste (A-Z)' },
  { value: 'title', label: 'Titre (A-Z)' },
  { value: 'year', label: 'Année (récent)' },
  { value: 'price', label: 'Prix (croissant)' },
]

const byRecent = (a, b) => new Date(b.created_at) - new Date(a.created_at)
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

export function filterAndSort(vinyls, { sort, search, genre }) {
  const q = normalize(search.trim())
  return vinyls
    .filter((v) => {
      if (genre && !(v.genres || []).includes(genre)) return false
      if (!q) return true
      return normalize(`${v.title} ${v.artist}`).includes(q)
    })
    .sort(sorters[sort] || byRecent)
}

// Genres présents, avec leur nombre de disques
export function getGenres(vinyls) {
  const genres = new Map()
  for (const v of vinyls) {
    for (const g of v.genres || []) genres.set(g, (genres.get(g) || 0) + 1)
  }
  return [...genres.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
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
