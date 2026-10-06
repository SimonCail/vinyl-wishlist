// Règles des comptes : pseudo, email, mot de passe.
// Les mêmes règles sont vérifiées par la base (script 13-regles-comptes.sql).

// --- Pseudo ---
export const PSEUDO_MIN = 3
export const PSEUDO_MAX = 20
const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿ'
const PSEUDO_RE = new RegExp(`^[${LETTER}0-9][${LETTER}0-9._-]*$`)
const RESERVED = [
  'admin', 'administrateur', 'administrator', 'moderateur', 'modérateur', 'moderator', 'support',
  'root', 'system', 'systeme', 'système', 'staff', 'equipe', 'équipe', 'officiel', 'official',
  'vinyl', 'vinyle', 'vinylwishlist', 'vinyl-wishlist', 'vinyl_wishlist', 'moi', 'null', 'undefined',
]

// Message d'erreur, ou null si le pseudo respecte les règles
export function pseudoError(raw) {
  const p = (raw ?? '').trim()
  if (!p) return 'Choisis un pseudo.'
  if (/\s/.test(p)) return 'Pas d’espace dans le pseudo (tu peux utiliser « _ », « . » ou « - »).'
  if (!PSEUDO_RE.test(p)) {
    if (!new RegExp(`^[${LETTER}0-9]`).test(p)) return 'Le pseudo doit commencer par une lettre ou un chiffre.'
    return 'Seulement des lettres, des chiffres et « _ », « . » ou « - ».'
  }
  if (p.length < PSEUDO_MIN) return `Au moins ${PSEUDO_MIN} caractères.`
  if (p.length > PSEUDO_MAX) return `${PSEUDO_MAX} caractères maximum.`
  if (/^\d+$/.test(p)) return 'Le pseudo ne peut pas contenir que des chiffres.'
  if (RESERVED.includes(p.toLowerCase())) return 'Ce pseudo est réservé, choisis-en un autre.'
  return null
}

// --- Email ---
// Format d'une vraie adresse : quelque chose@domaine.extension
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/
export function emailError(raw) {
  const e = (raw ?? '').trim()
  if (!e) return 'Indique ton email.'
  if (e.length > 254 || !EMAIL_RE.test(e) || e.includes('..') || e.split('@')[0].length > 64) {
    return 'Cette adresse email n’est pas valide (exemple : toi@exemple.fr).'
  }
  return null
}

// Fautes de frappe courantes : « gmial.com » → « gmail.com »
const DOMAINS = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr', 'yahoo.com', 'yahoo.fr',
  'icloud.com', 'live.fr', 'live.com', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'wanadoo.fr', 'me.com', 'proton.me', 'protonmail.com']
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : Infinity)
  return d[a.length][b.length]
}
// « toi@gmial.com » → « toi@gmail.com » (ou null)
export function emailSuggestion(raw) {
  const e = (raw ?? '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return null
  const domain = e.slice(at + 1)
  if (!domain || DOMAINS.includes(domain)) return null
  let best = null
  for (const d of DOMAINS) {
    const n = distance(domain, d)
    if (n > 0 && n <= 2 && (!best || n < best.n)) best = { d, n }
  }
  return best ? `${e.slice(0, at)}@${best.d}` : null
}

// --- Mot de passe ---
export const PASSWORD_RULES = [
  { id: 'length', label: '8 caractères minimum', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'Une majuscule', test: (p) => /[A-ZÀ-Ö]/.test(p) },
  { id: 'lower', label: 'Une minuscule', test: (p) => /[a-zø-ÿß]/.test(p) },
  { id: 'digit', label: 'Un chiffre', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'Un symbole (!?@#…)', test: (p) => /[^A-Za-z0-9À-ÖØ-öø-ÿ\s]/.test(p) },
]
export const PASSWORD_MAX = 72 // limite de Supabase
export function passwordError(p = '') {
  if (!p) return 'Choisis un mot de passe.'
  if (p.length > PASSWORD_MAX) return `${PASSWORD_MAX} caractères maximum.`
  if (/^\s|\s$/.test(p)) return 'Pas d’espace au début ni à la fin du mot de passe.'
  return PASSWORD_RULES.every((r) => r.test(p)) ? null : 'Le mot de passe ne respecte pas toutes les règles.'
}
