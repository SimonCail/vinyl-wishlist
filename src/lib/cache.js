const KEY = 'vinyl-wishlist-cache-v1'

export function readCache() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function writeCache(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // stockage plein ou indisponible : on ignore, l'app marche quand même
  }
}