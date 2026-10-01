import { formatPrice } from '../lib/format'

export default function ListSummary({ totals, label, note }) {
  const { total, pricedCount, unpricedCount } = totals

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface px-6 py-5 shadow-[0_10px_30px_-18px_rgba(27,36,32,0.4)]">
      <div>
        <p className="text-sm text-muted">{label}</p>
        {pricedCount > 0 ? (
          <p className="mt-1 font-display text-5xl font-black leading-none text-accent">
            {formatPrice(total)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Pas encore de prix.</p>
        )}
      </div>
      {pricedCount > 0 && (
        <p className="max-w-xs text-xs text-muted sm:text-right">
          {note ?? 'Somme des offres les moins chères'} — {pricedCount} disque
          {pricedCount > 1 ? 's' : ''}
          {unpricedCount > 0 && `, ${unpricedCount} sans prix`}. Indicatif.
        </p>
      )}
    </div>
  )
}
