import Cover from './Cover'
import { StarIcon, TrashIcon, NoteIcon, ArrowIcon, CheckIcon, PlusIcon } from './Icons'
import { AvatarStack, namesLabel } from './Avatar'
import { formatPrice } from '../lib/format'
import { discogsUrl, prefetchDetails } from '../lib/discogs'
import { useRef } from 'react'
import { colorFor } from '../lib/palette'

// « oct. 2026 »
const sinceLabel = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })

// vinyl.owners : les membres qui ont ce disque dans le bac affiché
// vinyl.mine   : le disque est dans MA liste (je peux le modifier)
export default function VinylCard({
  vinyl, index, mode, inRoom, meId,
  onOpen, onDelete, onPriority, onNote, onGotIt, onMeToo,
}) {
  const color = colorFor(vinyl)
  // Au survol (après un court instant) ou au toucher, on précharge la fiche
  const hoverTimer = useRef(null)
  const prefetch = () => prefetchDetails(vinyl)
  const startHover = () => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(prefetch, 120)
  }
  const stopHover = () => clearTimeout(hoverTimer.current)
  const owners = vinyl.owners || []
  const shared = inRoom && owners.length > 1
  const editable = vinyl.mine
  const badge = shared
    ? mode === 'wish' ? 'Envie commune' : 'En double'
    : vinyl.kind && vinyl.kind !== 'Album' ? vinyl.kind : null

  return (
    <li
      className="group animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      onPointerEnter={startHover}
      onPointerLeave={stopHover}
      onTouchStart={prefetch}
      onFocus={prefetch}
    >
      <div className="relative cursor-pointer" onClick={onOpen}>
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-transform duration-500 ease-out group-hover:translate-x-[26%] [@media(hover:none)]:translate-x-[12%]"
        >
          <div className="vinyl-disc disc-spin h-full w-full" style={{ '--disc-label': color }} />
        </div>

        <div className="relative overflow-hidden rounded-sm shadow-[0_8px_20px_-10px_rgba(26,22,18,0.6)] ring-1 ring-black/10 transition duration-300 group-hover:-translate-x-1.5 group-hover:-rotate-[1.5deg]">
          <Cover url={vinyl.cover_url} className="aspect-square w-full" />
          {badge && (
            <span
              className={`absolute left-0 top-2 px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${
                shared ? 'bg-sun text-paper' : 'bg-ink text-paper'
              }`}
            >
              {badge}
            </span>
          )}
          {editable && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.() }}
              aria-label="Retirer de ma liste"
              className="absolute right-2 top-2 rounded-full bg-ink/90 p-1.5 text-paper transition hover:bg-red-500 hover:text-white focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <TrashIcon width={16} height={16} />
            </button>
          )}
        </div>

        {vinyl.lowest_price != null && (
          <span
            title={mode === 'wish' ? 'Prix le plus bas actuellement en vente' : 'Cote actuelle (offre la moins chère)'}
            className="keep-day absolute -bottom-2 -left-2 z-10 -rotate-3 rounded-sm px-2 py-1 font-mono text-xs font-medium text-paper shadow-md transition duration-300 group-hover:rotate-2 group-hover:scale-110"
            style={{ backgroundColor: color }}
          >
            {formatPrice(vinyl.lowest_price)}
          </span>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={onOpen}
          className="block w-full truncate text-left font-display text-xl font-bold leading-tight transition hover:text-accent"
        >
          {vinyl.title}
        </button>
        <p className="truncate text-sm text-muted">
          {vinyl.artist}
          {vinyl.year && ` · ${vinyl.year}`}
        </p>

        {inRoom && owners.length > 0 && (
          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
            <AvatarStack members={owners} size={20} />
            <span className="truncate">
              {mode === 'wish' ? `${namesLabel(owners, meId)} ${owners.length > 1 ? 'le veulent' : 'le veut'}` : `Chez ${namesLabel(owners, meId).replace('Toi', 'toi')}`}
            </span>
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          {mode === 'wish' ? (
            editable ? (
              <div className="-ml-0.5 flex" role="group" aria-label="Niveau d'envie">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => onPriority?.(vinyl.priority === n ? 0 : n)}
                    aria-label={`Envie ${n} sur 3`}
                    className={`p-0.5 transition hover:scale-110 active:scale-150 ${
                      n <= vinyl.priority ? 'text-accent' : 'text-line hover:text-accent/60'
                    }`}
                  >
                    <StarIcon filled={n <= vinyl.priority} width={18} height={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex text-accent" role="img" aria-label={`Envie ${vinyl.priority} sur 3`}>
                {Array.from({ length: vinyl.priority }).map((_, i) => (
                  <StarIcon key={i} filled width={18} height={18} />
                ))}
              </div>
            )
          ) : (
            <span className="font-mono text-[11px] text-muted">
              {vinyl.mine && vinyl.owned_at ? `Depuis ${sinceLabel(vinyl.owned_at)}` : ''}
            </span>
          )}

          <div className="flex items-center gap-2.5 text-muted sm:gap-3">
            {mode === 'wish' && editable && (
              <button
                onClick={onGotIt}
                title="Je l'ai eu : passer dans ma collection"
                aria-label="Je l'ai : passer dans ma collection"
                className="flex items-center gap-1 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[11px] font-medium transition hover:border-accent hover:bg-accent hover:text-ink"
              >
                <CheckIcon width={13} height={13} /> <span className="hidden min-[400px]:inline md:inline">Je l'ai</span>
              </button>
            )}
            {inRoom && !editable && onMeToo && (
              <button
                onClick={onMeToo}
                title={mode === 'wish' ? 'Ajouter aussi à mes souhaits' : "Je l'ai aussi : ajouter à ma collection"}
                aria-label={mode === 'wish' ? 'Moi aussi, ajouter à mes souhaits' : "Je l'ai aussi"}
                className="flex items-center gap-1 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[11px] font-medium transition hover:border-accent hover:bg-accent hover:text-ink"
              >
                <PlusIcon width={13} height={13} /> <span className="hidden min-[400px]:inline md:inline">Moi aussi</span>
              </button>
            )}
            {editable && (
              <button onClick={onNote} aria-label="Ajouter une note" className="transition hover:text-paper">
                <NoteIcon width={17} height={17} />
              </button>
            )}
            <a
              href={discogsUrl(vinyl)}
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
          <p className="mt-2 line-clamp-2 border-l-4 pl-2 text-xs italic text-muted" style={{ borderColor: color }}>
            {vinyl.note}
          </p>
        )}
      </div>
    </li>
  )
}
