import { formatPrice } from '../lib/format'

export default function ListSummary({ totals, filtered }) {
  const { total, pricedCount, unpricedCount } = totals

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface px-5 py-4">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-muted">
          {filtered ? 'Valeur de la sélection' : 'Valeur estimée de la liste'}
        </p>
        {pricedCount > 0 ? (
          <p className="mt-1 font-display text-3xl font-bold text-accent-soft">
            {formatPrice(total)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Pas encore de prix. Utilise « Compléter les infos » ci-dessus.
          </p>
        )}
      </div>
      {pricedCount > 0 && (
        <p className="max-w-xs text-xs text-muted sm:text-right">
          Somme des offres les moins chères de {pricedCount} disque
          {pricedCount > 1 ? 's' : ''}
          {unpricedCount > 0 && `, ${unpricedCount} sans prix`}. Indicatif :
          c'est un minimum.
        </p>
      )}
    </div>
  )
}