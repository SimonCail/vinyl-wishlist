import { useSyncExternalStore } from 'react'

// Thème de l'appareil : 'light' (jour), 'dark' (nuit) ou 'system' (suit le téléphone).
// Gardé dans le navigateur : chacun choisit selon son écran.
export const THEME_KEY = 'vinyl-wishlist-theme'
const CHOICES = ['light', 'dark', 'system']
const media = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

function readChoice() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return CHOICES.includes(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

let choice = readChoice()
const listeners = new Set()

const resolve = (c) => (c === 'system' ? (media?.matches ? 'dark' : 'light') : c)

function apply() {
  const theme = resolve(choice)
  const root = document.documentElement
  root.dataset.theme = theme
  // Barre d'état du téléphone : vert de l'en-tête le jour, plus sombre la nuit
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#153a2d' : '#1d4a3a')
}

function emit() {
  apply()
  listeners.forEach((l) => l())
}

if (typeof document !== 'undefined') {
  apply()
  media?.addEventListener?.('change', () => choice === 'system' && emit())
  // Changement fait dans un autre onglet
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY) {
      choice = readChoice()
      emit()
    }
  })
}

function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function setThemeChoice(next) {
  if (!CHOICES.includes(next)) return
  choice = next
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    // navigation privée : le choix vaut pour cette visite
  }
  emit()
}

// Renvoie { choice, theme, setChoice, toggle }
export function useTheme() {
  const snap = useSyncExternalStore(subscribe, () => `${choice}|${resolve(choice)}`)
  const [current, theme] = snap.split('|')
  return {
    choice: current,
    theme,
    setChoice: setThemeChoice,
    toggle: () => setThemeChoice(theme === 'dark' ? 'light' : 'dark'),
  }
}
