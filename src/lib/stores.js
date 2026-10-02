// Liens « Voir chez… » : ouvrent la recherche de chaque enseigne, déjà remplie.
// Avec le code-barres, on tombe en général directement sur le bon vinyle ;
// sinon on cherche « artiste titre vinyle ».

const STORES = [
  { id: 'fnac', name: 'Fnac', url: (q) => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q}` },
  { id: 'cultura', name: 'Cultura', url: (q) => `https://www.cultura.com/search/results?search_query=${q}` },
  { id: 'leclerc', name: 'E.Leclerc', url: (q) => `https://www.e.leclerc/recherche?q=${q}` },
  // i=popular : rayon « CD & Vinyles » d'Amazon
  { id: 'amazon', name: 'Amazon', url: (q) => `https://www.amazon.fr/s?k=${q}&i=popular` },
]

// « 3 700187 667852 » -> « 3700187667852 », et seulement si ça ressemble à un EAN / UPC
export function cleanBarcode(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  return /^\d{12,13}$/.test(digits) ? digits : null
}

// Discogs ajoute parfois « (2) » aux homonymes, et « * » aux variantes de nom
const tidy = (s = '') => s.replace(/\s\(\d+\)/g, '').replace(/\*/g, '').trim()

export function storeLinks(vinyl, barcode) {
  const code = cleanBarcode(barcode)
  const text = `${tidy(vinyl.artist)} ${tidy(vinyl.title)} vinyle`
  const q = encodeURIComponent(code || text)
  return STORES.map((s) => ({ ...s, href: s.url(q), byBarcode: !!code }))
}
