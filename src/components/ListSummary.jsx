import { useState } from 'react'
import { formatPrice } from '../lib/format'

// Valeur de la liste.
// Ordinateur : un encart avec le grand prix.
// Téléphone : une seule ligne discrète ; la précision s'affiche si on appuie dessus.
export default function ListSummary({ totals, label, note }) {
  const [open, setOpen] = useState(false)
  const { total = 0, pricedCount = 0, unpricedCount = 0 } = totals || {}
  const count = pricedCount + unpricedCount
  const detail = pricedCount
    ? `${note} — ${pricedCount} disque${pricedCount > 1 ? 's' : ''}${
        unpricedCount ? `, ${unpricedCount} sans prix` : ''
      }. Indicatif.`
    : 'Pas encore de prix : utilise « Compléter les infos » au-dessus.'

  return (
    <>
      {/* Téléphone */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-4 block w-full text-left sm:hidden"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted">{label}</span>
          <span className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-black leading-none text-accent">
              {pricedCount ? formatPrice(total) : '—'}
            </span>
            <span className="text-xs text-muted">
              {count} disque{count > 1 ? 's' : ''}
            </span>
          </span>
        </span>
        {open && <span className="animate-pop mt-2 block text-xs text-muted">{detail}</span>}
      </button>

      {/* Ordinateur */}
      <div className="mb-6 hidden flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface px-6 py-5 shadow-[0_10px_30px_-18px_rgba(27,36,32,0.4)] sm:flex">
        <div>
          <p className="text-sm text-muted">{label}</p>
          {pricedCount > 0 ? (
            <p className="mt-1 font-display text-5xl font-black leading-none text-accent">{formatPrice(total)}</p>
          ) : (
            <p className="mt-1 text-sm text-muted">Pas encore de prix : utilise « Compléter les infos » au-dessus.</p>
          )}
        </div>
        {pricedCount > 0 && <p className="max-w-xs text-xs text-muted sm:text-right">{detail}</p>}
      </div>
    </>
  )
}
