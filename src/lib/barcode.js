// Lecture des codes-barres (EAN / UPC) au dos des pochettes.
// On utilise le détecteur intégré au navigateur quand il existe (Chrome Android,
// macOS…), sinon la bibliothèque ZXing, chargée seulement à l'ouverture du scanner
// (elle marche partout, iPhone compris).

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
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur (icône à côté de l’adresse), ou tape le code à la main.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Aucune caméra trouvée sur cet appareil. Tape le code à la main en dessous.'
    case 'NotReadableError':
    case 'AbortError':
      return 'La caméra est déjà utilisée par une autre application. Ferme-la et réessaie.'
    default:
      return 'Impossible d’ouvrir la caméra. Tape le code à la main en dessous.'
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

async function startNative(video, onCode) {
  const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS })
  const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
  video.srcObject = stream
  video.setAttribute('playsinline', '')
  await video.play()
  let stopped = false
  let timer = null
  const tick = async () => {
    if (stopped) return
    try {
      if (video.readyState >= 2) {
        const found = await detector.detect(video)
        if (!stopped && found[0]?.rawValue) onCode(found[0].rawValue)
      }
    } catch {
      // image illisible : on réessaie
    }
    if (!stopped) timer = setTimeout(tick, 120)
  }
  tick()
  return {
    stop() {
      stopped = true
      clearTimeout(timer)
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    },
  }
}

async function startZxing(video, onCode) {
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
    [DecodeHintType.TRY_HARDER, true],
  ])
  const reader = new BrowserMultiFormatOneDReader(hints, {
    delayBetweenScanAttempts: 120,
    delayBetweenScanSuccess: 400,
  })
  const controls = await reader.decodeFromConstraints(CONSTRAINTS, video, (result) => {
    if (result) onCode(result.getText())
  })
  return { stop: () => controls.stop() }
}

// Démarre la caméra dans <video> et appelle onCode(code) à chaque code lu.
// Renvoie { stop }.
export async function startScanner(video, onCode) {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats()
      if (NATIVE_FORMATS.some((f) => supported.includes(f))) return await startNative(video, onCode)
    } catch (e) {
      // Erreur de caméra : on la remonte ; sinon on passe à ZXing
      if (e?.name && e.name !== 'TypeError' && e.name !== 'NotSupportedError') throw e
    }
  }
  return startZxing(video, onCode)
}
