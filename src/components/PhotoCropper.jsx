import { useEffect, useRef, useState } from 'react'

const VIEW = 240 // taille de l'aperçu à l'écran (px)
const OUTPUT = 640 // taille de l'image envoyée (px)

// Recadrage carré d'une photo : on glisse pour placer, curseur pour zoomer.
// onConfirm(blob) reçoit un JPEG carré prêt à envoyer.
export default function PhotoCropper({ file, busy, onConfirm, onCancel }) {
  const [img, setImg] = useState(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // coin haut-gauche de l'image dans l'aperçu
  const drag = useRef(null)

  // Lecture de la photo choisie
  useEffect(() => {
    // « cancelled » : ignore une lecture abandonnée (React peut lancer cet
    // effet deux fois de suite ; la première lecture est alors annulée)
    let cancelled = false
    setFailed(false)
    setImg(null)
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      setImg(image)
      const s = VIEW / Math.min(image.naturalWidth, image.naturalHeight)
      setZoom(1)
      setPos({ x: (VIEW - image.naturalWidth * s) / 2, y: (VIEW - image.naturalHeight * s) / 2 })
    }
    image.onerror = () => !cancelled && setFailed(true)
    image.src = url
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1
  const scale = base * zoom
  const w = img ? img.naturalWidth * scale : 0
  const h = img ? img.naturalHeight * scale : 0
  // L'image doit toujours couvrir tout le carré
  const clamp = (p, ww = w, hh = h) => ({
    x: Math.min(0, Math.max(VIEW - ww, p.x)),
    y: Math.min(0, Math.max(VIEW - hh, p.y)),
  })

  function changeZoom(z) {
    if (!img) return
    // Zoom autour du centre de l'aperçu
    const ns = base * z
    const cx = (VIEW / 2 - pos.x) / scale
    const cy = (VIEW / 2 - pos.y) / scale
    const nw = img.naturalWidth * ns
    const nh = img.naturalHeight * ns
    setZoom(z)
    setPos(clamp({ x: VIEW / 2 - cx * ns, y: VIEW / 2 - cy * ns }, nw, nh))
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: pos }
  }
  function onPointerMove(e) {
    if (!drag.current) return
    const d = drag.current
    setPos(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }))
  }
  const onPointerUp = () => (drag.current = null)

  function confirm() {
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const k = OUTPUT / VIEW
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, pos.x * k, pos.y * k, w * k, h * k)
    canvas.toBlob((blob) => blob && onConfirm(blob), 'image/jpeg', 0.86)
  }

  if (failed) {
    return (
      <div className="rounded-2xl bg-raised p-4 text-sm">
        Impossible de lire cette image. Essaie une photo en JPEG ou PNG.
        <button onClick={onCancel} className="ml-2 font-medium underline underline-offset-4">OK</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative shrink-0 touch-none overflow-hidden rounded-xl bg-ink shadow-inner"
        style={{ width: VIEW, height: VIEW, cursor: img ? 'grab' : 'default' }}
        onPointerDown={img ? onPointerDown : undefined}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {img ? (
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ left: pos.x, top: pos.y, width: w, height: h }}
          />
        ) : (
          <span className="absolute inset-0 animate-shimmer bg-line" />
        )}
      </div>
      <div className="flex w-full min-w-0 flex-col gap-3">
        <p className="text-sm text-muted">Fais glisser la photo pour la placer.</p>
        <label className="flex items-center gap-3 text-xs font-medium text-muted">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            disabled={!img}
            className="w-full accent-[var(--color-accent)]"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={confirm}
            disabled={!img || busy}
            className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? 'Envoi…' : 'Utiliser cette photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
