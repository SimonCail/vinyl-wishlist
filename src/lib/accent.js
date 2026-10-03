// Couleur du site = couleur choisie dans le profil, en version foncée
// (comme le vert d'origine) pour que le texte crème reste lisible dessus.
//
// Variables lues par index.css :
//   --user-accent-bg       fonds « couleur du site » (en-tête, boutons…)
//   --user-accent-bg-soft  la même, plus foncée (survol des boutons)
//   --user-on-accent       texte posé sur ces fonds (crème)
//   --user-accent          liens et textes colorés sur fond clair
//   --user-accent-light    liens et textes colorés en mode nuit

const STORAGE_KEY = 'vinyl-wishlist-accent-v1'

// Pastille du profil → teinte du site (choisies à la main)
const PALETTE = {
  '#ec5b3e': { bg: '#6b2632', light: '#e8939b' }, // rouge → bordeaux
  '#e58a4e': { bg: '#7a3b1e', light: '#eba67a' }, // orange → rouille
  '#f1c04e': { bg: '#6e561b', light: '#e3c47a' }, // jaune → moutarde
  '#b9cf5a': { bg: '#48561d', light: '#bccd7e' }, // vert pomme → olive
  '#6fbf98': { bg: '#1d4a3a', light: '#86c9a6', soft: '#153a2d' }, // vert d'origine
  '#6aa6d6': { bg: '#1f3d5c', light: '#8fb8de' }, // bleu → bleu nuit
  '#f09aaa': { bg: '#8a4f57', light: '#e8a9b3' }, // rose → vieux rose
}
const ORIGINAL = PALETTE['#6fbf98']

const CREAM = '#f5f1e8'
const LIGHT_BG = '#ece6d8' // le plus foncé des fonds clairs (lisible partout)
const NIGHT = '#101714' // fond du mode nuit

// --- petites fonctions de couleur ---
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mix = (hex, target, amount) => {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount))
}
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
// Fonce (vers le noir) ou éclaircit (vers le crème) jusqu'à être lisible sur `bg`
function readableOn(color, bg, toward) {
  for (let t = 0; t <= 1; t += 0.04) {
    const c = mix(color, toward, t)
    if (contrast(c, bg) >= 4.5) return c
  }
  return toward
}

export function accentPalette(color) {
  const c = (color || '').toLowerCase()
  const known = PALETTE[c]
  if (known) return { bg: known.bg, light: known.light, soft: known.soft ?? mix(known.bg, '#000000', 0.25) }
  if (!/^#[0-9a-f]{6}$/.test(c)) return ORIGINAL
  // Autre couleur : on la fonce jusqu'à ce que le crème se lise dessus
  const bg = readableOn(c, LIGHT_BG, '#000000')
  return { bg, light: readableOn(c, NIGHT, CREAM), soft: mix(bg, '#000000', 0.25) }
}

export function applyAccent(color) {
  const p = accentPalette(color)
  const root = document.documentElement.style
  root.setProperty('--user-accent-bg', p.bg)
  root.setProperty('--user-accent-bg-soft', p.soft)
  root.setProperty('--user-on-accent', CREAM)
  root.setProperty('--user-accent', p.bg)
  root.setProperty('--user-accent-light', p.light)
  // Couleur de la barre du téléphone (app installée, Chrome Android…)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg)
  try {
    if (color) localStorage.setItem(STORAGE_KEY, color)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* stockage indisponible : tant pis */
  }
}

// Au chargement : on remet tout de suite la dernière couleur connue,
// pour ne pas voir le vert le temps que le profil arrive
export function restoreAccent() {
  let saved = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    /* rien */
  }
  if (saved) applyAccent(saved)
}
