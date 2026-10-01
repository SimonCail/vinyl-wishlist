import { supabase } from './supabase'

const BUCKET = 'avatars'
const SIZE = 512 // côté de la photo finale, en pixels
const MAX_INPUT = 30 * 1024 * 1024 // photo d'origine : 30 Mo max

// Adresse publique d'une photo à partir de son chemin (« <id>/<fichier> »)
export function avatarUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function decode(file) {
  // createImageBitmap respecte l'orientation des photos de téléphone
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Solution de secours (anciens Safari)
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality))

const MAX_EDIT = 2048 // côté max de la photo pendant le recadrage

// Photo de la galerie -> image prête à recadrer (bien orientée, taille raisonnable).
// Renvoie { canvas, url, width, height } ; url sert à l'affichage dans l'éditeur.
export async function loadPhoto(file) {
  if (!file) throw new Error('Aucune photo choisie.')
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error("Ce fichier n'est pas une image.")
  }
  if (file.size > MAX_INPUT) throw new Error('Photo trop lourde (30 Mo maximum).')

  let source
  try {
    source = await decode(file)
  } catch {
    throw new Error('Format de photo non pris en charge. Essaie une photo JPEG ou PNG.')
  }

  const ratio = Math.min(1, MAX_EDIT / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(source.width * ratio)
  canvas.height = Math.round(source.height * ratio)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close?.()

  const shown = await toBlob(canvas, 'image/jpeg', 0.9)
  return { canvas, url: URL.createObjectURL(shown), width: canvas.width, height: canvas.height }
}

// Applique le cadrage choisi dans l'éditeur et produit la photo finale (512 px).
// view : { size, scale, x, y, rotation } — size = côté du cadre à l'écran,
// scale = échelle de l'image, x/y = décalage du centre en px écran, rotation en degrés.
export async function exportAvatar(photo, view) {
  const out = document.createElement('canvas')
  out.width = SIZE
  out.height = SIZE
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#f5f1e8'
  ctx.fillRect(0, 0, SIZE, SIZE)
  const k = SIZE / view.size
  ctx.translate(SIZE / 2 + view.x * k, SIZE / 2 + view.y * k)
  ctx.rotate((view.rotation * Math.PI) / 180)
  ctx.scale(view.scale * k, view.scale * k)
  ctx.drawImage(photo.canvas, -photo.width / 2, -photo.height / 2)

  let blob = await toBlob(out, 'image/webp', 0.86)
  // Certains navigateurs ne savent pas produire de WebP : on se rabat sur JPEG
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(out, 'image/jpeg', 0.88)
  if (!blob) throw new Error('Impossible de préparer la photo.')
  return blob
}

// Erreurs du stockage Supabase -> phrases claires (le détail reste dans la console)
function uploadMessage(error) {
  console.error('Envoi de la photo :', error)
  const msg = `${error?.message || ''} ${error?.error || ''}`.toLowerCase()
  if (msg.includes('bucket not found')) {
    return 'Le stockage des photos n’est pas encore prêt : active Storage dans Supabase puis relance le script 3-profil-et-photos.sql.'
  }
  if (msg.includes('row-level security') || msg.includes('unauthorized') || msg.includes('403')) {
    return 'Le stockage a refusé la photo (règles d’accès manquantes) : relance le script 3-profil-et-photos.sql.'
  }
  if (msg.includes('mime') || msg.includes('not supported')) return 'Format de photo refusé par le stockage.'
  if (msg.includes('size') || msg.includes('too large')) return 'Photo trop lourde pour le stockage.'
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return `L'envoi de la photo a échoué (${error?.message || 'erreur inconnue'}).`
}

// Envoie la photo dans le dossier de la personne, puis supprime les anciennes.
// Renvoie le chemin à enregistrer dans le profil.
export async function uploadAvatar(userId, blob) {
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${Date.now()}.${ext}` // nom unique : pas de vieille photo en cache
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(uploadMessage(error))
  return path
}

// Supprime les photos d'une personne, sauf éventuellement celle à garder
export async function removeAvatars(userId, keep = null) {
  const { data } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 })
  const old = (data || []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep)
  if (old.length) await supabase.storage.from(BUCKET).remove(old)
}
