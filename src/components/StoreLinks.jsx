import { ArrowIcon } from './Icons'
import { storeLinks } from '../lib/stores'

// « Acheter neuf » : un bouton par enseigne, qui ouvre sa recherche déjà remplie.
// barcode : code-barres du pressage (si Discogs le donne), sinon recherche par titre.
export default function StoreLinks({ vinyl, barcode }) {
  const links = storeLinks(vinyl, barcode)
  const byBarcode = links[0]?.byBarcode

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted">Acheter neuf</h3>
        <p className="font-mono text-[11px] text-muted">{byBarcode ? 'par code-barres' : 'par titre'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {links.map((l) => (
          <a
            key={l.id}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Voir « ${vinyl.title} » chez ${l.name}`}
            className="group flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium transition hover:border-accent hover:bg-raised"
          >
            <span className="truncate">{l.name}</span>
            <ArrowIcon width={15} height={15} className="shrink-0 text-muted transition group-hover:text-accent" />
          </a>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Ouvre la recherche de l’enseigne dans un nouvel onglet : prix, promos et stock en ligne.
      </p>
    </section>
  )
}
