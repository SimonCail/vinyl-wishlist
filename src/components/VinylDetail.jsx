import { useEffect, useRef, useState } from 'react'
import Cover from './Cover'
import { CloseIcon, ArrowIcon } from './Icons'
import { AvatarStack } from './Avatar'
import { getDetails, discogsUrl } from '../lib/discogs'
import { formatPrice } from '../lib/format'

function Pill({ children, strong }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        strong ? 'bg-accent/15 text-accent-soft' : 'border border-line text-muted'
      }`}
    >
      {children}
    </span>
  )
}

// onSync n'est appelé que si le disque est dans ma liste (je ne modifie que les miens)
export default function VinylDetail({ vinyl, mode, inRoom, onSync, onClose }) {
  const [details, setDetails] = useState(null)
  const [error, setError] = useState(null)
  const synced = useRef(false)

  // Chargement des infos en direct
  useEffect(() => {
    let cancelled = false
    getDetails(vinyl)
      .then((d) => !cancelled && setDetails(d))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [vinyl.discogs_id, vinyl.discogs_type])

  // Synchronise la base une seule fois si le prix a changé ou si les genres manquent
  useEffect(() => {
    if (!details || synced.current || !vinyl.myItem) return
    synced.current = true
    const mine = vinyl.myItem
    const priceChanged = Number(details.lowest_price) !== Number(mine.lowest_price)
    const needsGenres = !mine.genres?.length && details.genres.length > 0
    if (priceChanged || needsGenres) onSync(mine, details)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details])

  // Fermeture avec Échap
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const genres = details?.genres ?? vinyl.genres ?? []
  const styles = details?.styles ?? vinyl.styles ?? []
  const price = details ? details.lowest_price : vinyl.lowest_price
  const forSale = details ? details.num_for_sale : vinyl.num_for_sale
  const videos = (details?.videos ?? []).filter((v) => v.uri?.startsWith('http')).slice(0, 4)
  const owners = vinyl.owners || []

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={vinyl.title}
        className="animate-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-2xl shadow-black/60 sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <Cover
            url={vinyl.cover_url}
            className="h-28 w-28 shrink-0 overflow-hidden rounded-md shadow-lg shadow-black/40 sm:h-32 sm:w-32"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-xl font-bold leading-tight">
                {vinyl.title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted transition hover:bg-raised hover:text-paper"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <p className="mt-1 text-muted">
              {vinyl.artist}
              {vinyl.year && ` · ${vinyl.year}`}
            </p>
            {inRoom && owners.length > 0 && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                <AvatarStack members={owners} size={20} />
                {mode === 'wish' ? 'Voulu par ' : 'Dans la collection de '}
                {owners.map((o) => o.name).join(', ')}
              </p>
            )}
            {price != null && (
              <p className="mt-3">
                <span className="font-display text-2xl font-bold text-accent-soft">
                  dès {formatPrice(price)}
                </span>
                {forSale != null && (
                  <span className="ml-2 text-xs text-muted">
                    {forSale} en vente
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {(genres.length > 0 || styles.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {genres.map((g) => (
              <Pill key={g} strong>
                {g}
              </Pill>
            ))}
            {styles.map((s) => (
              <Pill key={s}>{s}</Pill>
            ))}
          </div>
        )}

        {vinyl.note && (
          <p className="mt-5 border-l-2 border-accent/60 pl-3 text-sm italic text-muted">
            {vinyl.note}
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">
            Impossible de charger les détails : {error}
          </p>
        )}

        {!details && !error && (
          <div className="mt-6 space-y-2 animate-shimmer">
            {[70, 90, 60, 80].map((w, i) => (
              <div key={i} className="h-4 rounded bg-raised" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {details && details.tracklist.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-muted">
              Titres
            </h3>
            <ol className="divide-y divide-line/60 text-sm">
              {details.tracklist.map((t, i) => (
                <li key={i} className="flex items-baseline gap-3 py-2">
                  <span className="w-7 shrink-0 text-xs text-muted">{t.position}</span>
                  <span className="min-w-0 flex-1">{t.title}</span>
                  {t.duration && (
                    <span className="shrink-0 text-xs text-muted">{t.duration}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {videos.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-muted">
              Écouter
            </h3>
            <ul className="space-y-1.5">
              {videos.map((v) => (
                <li key={v.uri}>
                  <a
                    href={v.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm transition hover:border-accent hover:bg-raised"
                  >
                    <span className="min-w-0 flex-1 truncate">{v.title}</span>
                    <ArrowIcon width={16} height={16} className="shrink-0 text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={discogsUrl(vinyl)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-bold text-ink transition hover:bg-accent-soft"
        >
          Voir sur Discogs <ArrowIcon width={16} height={16} />
        </a>
      </div>
    </div>
  )
}
