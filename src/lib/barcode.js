// Lecture des codes-barres (EAN / UPC) au dos des pochettes.
// On ouvre la caméra nous-mêmes (avec tout ce que l'iPhone demande, y compris
// dans l'app installée sur l'écran d'accueil), puis on lit les images de la vidéo :
// avec le détecteur intégré au navigateur quand il existe (Chrome Android, macOS…),
// sinon avec la bibliothèque ZXing, chargée seulement à l'ouverture du scanner.
// Si la caméra en direct ne marche pas, on peut lire le code sur une photo.

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

const CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' }, // caméra arrière
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
}

export const cameraAvailable = () => !!navigator.mediaDevices?.getUserMedia

// Erreurs de caméra -> phrases claires
export function cameraMessage(error) {
  if (!window.isSecureContext) {
    return 'La caméra ne fonctionne que sur un site en https. Tu peux taper le code à la main en dessous.'
  }
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent)
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return iphone
        ? 'Accès à la caméra refusé. Sur iPhone : Réglages › Safari › Caméra › « Autoriser » ou « Demander », puis rouvre l’app. Tu peux aussi prendre le code en photo.'
        : 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur (icône à côté de l’adresse), ou prends le code en photo.'
    case 'TimeoutError':
      return iphone
        ? 'La caméra ne répond pas. Réessaie, ou prends le code en photo. (Si ça recommence : Réglages › Safari › Caméra › « Autoriser ».)'
        : 'La caméra ne répond pas. Réessaie, ou prends le code en photo.'
    case 'NoFramesError':
      return 'La caméra s’ouvre mais l’image reste noire. Réessaie, ou prends le code en photo.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Aucune caméra trouvée sur cet appareil. Tape le code à la main en dessous.'
    case 'NotReadableError':
    case 'AbortError':
      return 'La caméra est déjà utilisée par une autre application. Ferme-la et réessaie.'
    default:
      return 'Impossible d’ouvrir la caméra. Prends le code en photo ou tape-le à la main.'
  }
}

// Vérifie la clé de contrôle d'un code EAN-8, UPC-A (12) ou EAN-13
export function isValidBarcode(code) {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

// Garde uniquement les chiffres (« 3 700187 667852 » -> « 3700187667852 »)
export const cleanBarcode = (raw) => (raw || '').replace(/\D/g, '')

// --- Décodeur : détecteur du navigateur, sinon ZXing (une seule fois) ---
async function makeDecoder() {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats()
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f))
      if (formats.length) {
        const detector = new window.BarcodeDetector({ formats })
        return async (canvas) => (await detector.detect(canvas))[0]?.rawValue || null
      }
    } catch {
      // pas de détecteur utilisable : ZXing
    }
  }
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
    [DecodeHintType.TRY_HARDER, true],
  ])
  const reader = new BrowserMultiFormatOneDReader(hints)
  return async (canvas) => {
    try {
      return reader.decodeFromCanvas(canvas).getText()
    } catch {
      return null // pas de code sur cette image
    }
  }
}
let decoderPromise = null
const getDecoder = () =>
  (decoderPromise ??= makeDecoder().catch((e) => {
    decoderPromise = null
    throw e
  }))

const named = (name) => Object.assign(new Error(name), { name })
function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(named('TimeoutError')), ms)
    }),
  ])
}

// --- Caméra ---
// Ouvre la caméra arrière dans <video>. Renvoie { stop, needsTap } :
// needsTap = l'iPhone veut un toucher avant d'afficher l'image.
export async function openCamera(video) {
  if (!cameraAvailable()) throw named('NotFoundError')
  getDecoder().catch(() => {}) // on prépare le décodeur en même temps
  // Si la caméra répond après le délai, on la referme (sinon elle resterait allumée)
  const ask = (constraints) => {
    const request = navigator.mediaDevices.getUserMedia(constraints)
    return withTimeout(request, 10000).catch((e) => {
      if (e?.name === 'TimeoutError') request.then((late) => late.getTracks().forEach((t) => t.stop())).catch(() => {})
      throw e
    })
  }
  let stream
  try {
    stream = await ask(CONSTRAINTS)
  } catch (e) {
    // Réglages refusés par cette caméra : on réessaie avec les réglages de base
    if (e?.name !== 'OverconstrainedError') throw e
    stream = await ask({ audio: false, video: true })
  }
  // Ce que l'iPhone exige pour afficher la vidéo dans la page
  video.muted = true
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.setAttribute('autoplay', '')
  video.srcObject = stream
  const stop = () => {
    stream.getTracks().forEach((t) => t.stop())
    if (video.srcObject === stream) video.srcObject = null
  }
  try {
    await withTimeout(video.play(), 4000)
    return { stop, needsTap: false }
  } catch {
    return { stop, needsTap: true }
  }
}

// L'image arrive-t-elle vraiment ? (sinon : écran noir)
export async function waitFrames(video, ms = 4000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (video.videoWidth > 0 && video.readyState >= 2) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

// Lit les images de la vidéo et appelle onCode(code) à chaque code lu.
// Renvoie une fonction pour arrêter.
export function startDecoding(video, onCode) {
  let stopped = false
  let timer = null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const tick = async () => {
    if (stopped) return
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        const decode = await getDecoder()
        const scale = Math.min(1, 1280 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const code = await decode(canvas)
        if (code && !stopped) onCode(code)
      }
    } catch {
      // image illisible : on réessaie
    }
    if (!stopped) timer = setTimeout(tick, 150)
  }
  tick()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

// --- Photo ---
// Lit le code-barres sur une photo (appareil photo de l'iPhone, galerie…). Renvoie le code ou null.
export async function decodeImageFile(file) {
  const decode = await getDecoder()
  let source
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    source = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }
  const w = source.width || source.naturalWidth
  const h = source.height || source.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  // Plusieurs tailles, puis tourné d'un quart de tour (photo prise de côté)
  for (const rotate of [false, true]) {
    for (const max of [1600, 1000, 2400]) {
      const scale = Math.min(1, max / Math.max(w, h))
      const sw = Math.round(w * scale)
      const sh = Math.round(h * scale)
      canvas.width = rotate ? sh : sw
      canvas.height = rotate ? sw : sh
      ctx.save()
      if (rotate) {
        ctx.translate(sh, 0)
        ctx.rotate(Math.PI / 2)
      }
      ctx.drawImage(source, 0, 0, sw, sh)
      ctx.restore()
      const raw = await decode(canvas)
      const code = cleanBarcode(raw)
      if (code && isValidBarcode(code)) return code
    }
  }
  return null
}