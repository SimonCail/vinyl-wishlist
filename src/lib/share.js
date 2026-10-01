import { formatPrice } from './format'

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n)

// Texte de la liste, dans l'ordre affiché à l'écran
export function buildListText(vinyls, { url, filtered }) {
  const count = `${vinyls.length} disque${vinyls.length > 1 ? 's' : ''}`
  const title = filtered ? 'Sélection de notre wishlist vinyles' : 'Notre wishlist vinyles'

  const lines = vinyls.map((v) => {
    let line = `• ${v.artist} – ${v.title}`
    if (v.year) line += ` (${v.year})`
    if (v.lowest_price != null) line += ` · dès ${formatPrice(v.lowest_price)}`
    if (v.priority > 0) line += ` · ${stars(v.priority)}`
    if (v.note) line += `\n   « ${v.note} »`
    return line
  })

  return [`${title} (${count})`, '', ...lines, '', `Liste en direct : ${url}`].join('\n')
}

// Copie dans le presse-papiers, avec une solution de secours pour les anciens navigateurs
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // on tente la méthode de secours
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}