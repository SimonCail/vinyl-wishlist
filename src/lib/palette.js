// Une couleur par disque, toujours la même (calculée à partir de son identifiant)
const PALETTE = [
  '#ec5b3e', // corail
  '#f1c04e', // beurre
  '#6fbf98', // vert d'eau
  '#6aa6d6', // bleu ciel
  '#f09aaa', // rose poudré
  '#b9cf5a', // vert olive clair
  '#e58a4e', // abricot
]

export function colorFor(vinyl) {
  const s = `${vinyl.discogs_type || 'master'}${vinyl.discogs_id}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
