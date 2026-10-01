import { useCallback, useEffect, useRef, useState } from 'react'
import { CloseIcon } from './Icons'

const MAX_ZOOM = 5

function RotateIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  )
}

// Éditeur de photo de profil : glisser pour déplacer, pincer / molette / curseur
// pour zoomer, bouton pour pivoter. Le cercle montre ce qui sera gardé.
// photo : { url, width, height } (voir loadPhoto) ; onConfirm(view) reçoit le cadrage.
export default function AvatarCropper({ photo, busy, error, onConfirm, onCancel }) {
  const frameRef = useRef(null)
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const [size, setSize] = useState(288) // côté du cadre à l'écran
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0, rotation: 0 })

  // Dimensions de l'image une fois pivotée, et échelle pour couvrir le cadre
  const turned = view.rotation % 180 !== 0
  const rw = turned ? photo.height : photo.width
  const rh = turned ? photo.width : photo.height
  const base = size / Math.min(rw, rh)
  const scale = base * view.zoom

  // L'image doit toujours couvrir tout le cadre : on borne le déplacement
  const clamp = useCallback(
    (v) => {
      const t = v.rotation % 180 !== 0
      const w = t ? photo.height : photo.width
      const h = t ? photo.width : photo.height
      const s = (size / Math.min(w, h)) * v.zoom
      const mx = Math.max(0, (w * s - size) / 2)
      const my = Math.max(0, (h * s - size) / 2)
      return { ...v, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) }
    },
    [photo.width, photo.height, size]
  )

  const zoomTo = useCallback(
    (z) =>
      setView((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, z))
        const r = zoom / v.zoom // zoom centré : le point au centre du cercle reste au centre
        return clamp({ ...v, zoom, x: v.x * r, y: v.y * r })
      }),
    [clamp]
  )

  // Taille réelle du cadre (s'adapte à l'écran)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => setView((v) => clamp(v)), [clamp])

  // Molette / pincement du pavé tactile (doit pouvoir bloquer le défilement de la page)
  useEffect(() => {
    const el = frameRef.current
    const onWheel = (e) => {
      e.preventDefault()
      setView((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * Math.exp(-e.deltaY * 0.0015)))
        const r = zoom / v.zoom
        return clamp({ ...v, zoom, x: v.x * r, y: v.y * r })
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [clamp])

  // Fermeture avec Échap
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  // --- Doigts / souris ---
  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom }
    }
  }

  function onPointerMove(e) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      zoomTo(pinch.current.zoom * (dist / pinch.current.dist))
    } else if (pointers.current.size === 1) {
      setView((v) => clamp({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }))
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  // --- Clavier ---
  function onKeyDown(e) {
    const step = e.shiftKey ? 40 : 10
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      const [dx, dy] = moves[e.key]
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }))
    } else if (e.key === '+' || e.key === '=') zoomTo(view.zoom * 1.15)
    else if (e.key === '-') zoomTo(view.zoom / 1.15)
  }

  const rotate = () => setView((v) => clamp({ ...v, rotation: (v.rotation + 90) % 360 }))
  const reset = () => setView({ zoom: 1, x: 0, y: 0, rotation: 0 })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recadrer ta photo"
        className="animate-pop w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-2xl shadow-black/60 sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-black uppercase leading-[0.9]">Recadre ta photo</h3>
            <p className="mt-2 text-sm text-muted">
              Fais glisser pour la placer, pince ou utilise le curseur pour zoomer.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Annuler"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted transition hover:bg-raised hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <div
          ref={frameRef}
          tabIndex={0}
          role="application"
          aria-label="Zone de recadrage : flèches pour déplacer, plus et moins pour zoomer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="relative mx-auto mt-5 aspect-square w-full max-w-[20rem] cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-paper outline-none active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-accent/30"
        >
          <img
            src={photo.url}
            alt=""
            draggable="false"
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{
              width: photo.width,
              height: photo.height,
              maxWidth: 'none',
              transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) rotate(${view.rotation}deg) scale(${scale})`,
              transformOrigin: 'center',
            }}
          />
          {/* Tout ce qui est hors du cercle est assombri */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-ink/80"
            style={{ boxShadow: '0 0 0 999px rgba(27, 36, 32, 0.6)' }}
          />
        </div>

        <div className="mx-auto mt-5 flex max-w-[20rem] items-center gap-3">
          <button
            onClick={() => zoomTo(view.zoom / 1.25)}
            aria-label="Dézoomer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-lg leading-none text-muted transition hover:border-accent hover:text-paper"
          >
            −
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 w-full cursor-pointer accent-[var(--color-accent)]"
          />
          <button
            onClick={() => zoomTo(view.zoom * 1.25)}
            aria-label="Zoomer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-lg leading-none text-muted transition hover:border-accent hover:text-paper"
          >
            +
          </button>
        </div>

        <div className="mx-auto mt-3 flex max-w-[20rem] justify-center gap-2">
          <button onClick={rotate} className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm transition hover:border-accent hover:bg-raised">
            <RotateIcon /> Pivoter
          </button>
          <button onClick={reset} className="rounded-full px-3.5 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-paper">
            Recentrer
          </button>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-line py-2.5 font-medium transition hover:bg-raised disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm({ size, scale, x: view.x, y: view.y, rotation: view.rotation })}
            disabled={busy}
            className="flex-1 rounded-full bg-accent py-2.5 font-bold text-ink transition hover:bg-accent-soft disabled:opacity-60"
          >
            {busy ? 'Envoi…' : 'Utiliser cette photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
