import Cover from './Cover'
import { StarIcon, TrashIcon, NoteIcon, ArrowIcon } from './Icons'
import { formatPrice } from '../lib/format'

export default function VinylCard({
  vinyl, index, readOnly, onOpen, onDelete, onPriority, onNote,
}) {
  return (
    <li
      className="group animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div className="relative cursor-pointer" onClick={onOpen}>
        {/* Le disque qui sort de la pochette (ordinateur uniquement) */}
        <div
          aria-hidden="true"
          className="vinyl-disc absolute inset-0 hidden rounded-full shadow-lg shadow-black/50 transition-transform duration-500 ease-out md:block md:group-hover:translate-x-[18%]"
        />
        <div className="relative overflow-hidden rounded-md shadow-lg shadow-black/40 ring-1 ring-white/10">
          <Cover url={vinyl.cover_url} className="aspect-square w-full" />
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label="Retirer de la liste"
              className="absolute right-2 top-2 rounded-full bg-ink/75 p-1.5 text-paper backdrop-blur transition hover:bg-red-500 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <TrashIcon width={16} height={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={onOpen}
          className="block w-full truncate text-left font-display text-base font-semibold leading-snug transition hover:text-accent-soft"
        >
          {vinyl.title}
        </button>
        <p className="truncate text-sm text-muted">
          {vinyl.artist}
          {vinyl.year && ` · ${vinyl.year}`}
        </p>
        <p className="truncate text-xs text-muted/70">
          {vinyl.added_by && `Ajouté par ${vinyl.added_by}`}
          {vinyl.added_by && vinyl.lowest_price != null && ' · '}
          {vinyl.lowest_price != null && (
            <span className="text-accent-soft">
              dès {formatPrice(vinyl.lowest_price)}
            </span>
          )}
        </p>

        <div className="mt-2 flex items-center justify-between">
          {readOnly ? (
            <div
              className="flex text-accent"
              role="img"
              aria-label={`Envie ${vinyl.priority} sur 3`}
            >
              {Array.from({ length: vinyl.priority }).map((_, i) => (
                <StarIcon key={i} filled width={18} height={18} />
              ))}
            </div>
          ) : (
            <div className="-ml-0.5 flex" role="group" aria-label="Niveau d'envie">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => onPriority(vinyl.priority === n ? 0 : n)}
                  aria-label={`Envie ${n} sur 3`}
                  className={`p-0.5 transition hover:scale-110 ${
                    n <= vinyl.priority
                      ? 'text-accent'
                      : 'text-line hover:text-accent-soft'
                  }`}
                >
                  <StarIcon filled={n <= vinyl.priority} width={18} height={18} />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-muted">
            {!readOnly && (
              <button
                onClick={onNote}
                aria-label="Ajouter une note"
                className="transition hover:text-paper"
              >
                <NoteIcon width={17} height={17} />
              </button>
            )}
            <a
              href={`https://www.discogs.com/master/${vinyl.discogs_id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Voir sur Discogs"
              className="transition hover:text-paper"
            >
              <ArrowIcon width={17} height={17} />
            </a>
          </div>
        </div>

        {vinyl.note && (
          <p className="mt-2 line-clamp-2 border-l-2 border-accent/60 pl-2 text-xs italic text-muted">
            {vinyl.note}
          </p>
        )}
      </div>
    </li>
  )
}