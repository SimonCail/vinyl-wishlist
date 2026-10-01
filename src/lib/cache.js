// Petit stockage local : l'app reste consultable hors-ligne
const ITEMS_KEY = 'vinyl-wishlist-cache-v2'
export const ROOMS_KEY = 'vinyl-wishlist-rooms-v1'
export const PROFILE_KEY = 'vinyl-wishlist-profile-v1'
export const CONTEXT_KEY = 'vinyl-wishlist-context'

export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // stockage plein ou indisponible : on ignore, l'app marche quand même
  }
}

export const readCache = () => readJSON(ITEMS_KEY, [])
export const writeCache = (list) => writeJSON(ITEMS_KEY, list)

// À la déconnexion : on ne laisse rien de la personne sur l'appareil
export function clearUserCache() {
  for (const key of [ITEMS_KEY, ROOMS_KEY, PROFILE_KEY, CONTEXT_KEY, 'vinyl-wishlist-cache-v1']) {
    try {
      localStorage.removeItem(key)
    } catch {
      // rien
    }
  }
}
