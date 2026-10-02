import { useEffect, useMemo, useRef, useState } from 'react'
import Cover from './Cover'
import { CloseIcon, ArrowIcon, StarIcon, CheckIcon, PlusIcon, NoteIcon } from './Icons'
import { AvatarStack } from './Avatar'
import { getDetails, peekDetails, discogsUrl } from '../lib/discogs'
import { formatPrice } from '../lib/format'
import { colorFor } from '../lib/palette'
import StoreLinks from './StoreLinks'

function PlayIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}

function Pill({ children, strong }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        strong ? 'bg-accent/10 text-accent' : 'border border-line text-muted'
      }`}
    >
      {children}
    </span>
  )
}

// "3:38" -> 218 secondes
const toSeconds = (d) => {
  const parts = (d || '').split(':').map(Number)
  if (!parts.length || parts.some(Number.isNaN)) return null
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

// Positions « A1, A2, B1… » -> faces du vinyle ; sinon une seule liste
function groupBySide(tracks) {
  const songs = tracks.filter((t) => t.position) // on ignore les titres de section de Discogs
  const sides = songs.map((t) => /^([A-Z])\d*/i.exec(t.position)?.[1]?.toUpperCase())
  if (sides.some((s) => !s) || new Set(sides).size < 2) return [{ side: null, tracks: songs }]
  const groups = []
  songs.forEach((t, i) => {
    const last = groups[groups.length - 1]
    if (last && last.side === sides[i]) last.tracks.push(t)
    else groups.push({ side: sides[i], tracks: [t] })
  })
  return groups
}

// Liens d'écoute : une recherche « artiste + titre » sur chaque service
const listenLinks = (v) => {
  const q = encodeURIComponent(`${v.artist} ${v.title}`)
  return [
    { label: 'Spotify', href: `https://open.spotify.com/search/${q}` },
    { label: 'YouTube', href: `https://www.youtube.com/results?search_query=${q}` },
    { label: 'Apple Music', href: `https://music.apple.com/search?term=${q}` },
  ]
}

// Offres en vente sur Discogs (vinyles uniquement)
const marketUrl = (v) =>
  v.discogs_type === 'release'
    ? `https://www.discogs.com/sell/release/${v.discogs_id}`
    : `https://www.discogs.com/sell/list?master_id=${v.discogs_id}&format=Vinyl`

const sinceLabel = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

// Fiche d'un disque. onSync n'est appelé que pour mes disques (je ne modifie que les miens).
// Les actions (étoiles, « Je l'ai », note, « Moi aussi ») sont les mêmes que sur la carte.
export default function VinylDetail({
  vinyl, mode, inRoom, canAdd,
  onSync, onClose, onPriority, onGotIt, onNote, onMeToo,
}) {
  // Ce qu'on a déjà en cache s'affiche tout de suite ; le prix se met à jour derrière
  const [details, setDetails] = useState(() => peekDetails(vinyl)?.data ?? null)
  const [fresh, setFresh] = useState(() => !!peekDetails(vinyl)?.fresh)
  const [error, setError] = useState(null)
  const [compact, setCompact] = useState(false)
  const synced = useRef(false)
  const color = colorFor(vinyl)
  const mine = vinyl.mine

  // Chargement des infos à jour (sauf si le cache est récent)
  useEffect(() => {
    if (fresh) return
    let cancelled = false
    getDetails(vinyl)
      .then((d) => {
        if (cancelled) return
        setDetails(d)
        setFresh(true)
      })
      // Si on a déjà une version en cache, on la garde sans afficher d'erreur
      .catch((e) => !cancelled && !details && setError(e.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinyl.discogs_id, vinyl.discogs_type])

  // Synchronise la base une seule fois (avec des infos à jour) si le prix a changé,
  // ou si genres / pochette manquent
  useEffect(() => {
    if (!details || !fresh || synced.current || !vinyl.myItem) return
    synced.current = true
    const m = vinyl.myItem
    const priceChanged = Number(details.lowest_price) !== Number(m.lowest_price)
    const needsGenres = !m.genres?.length && details.genres.length > 0
    const needsCover = m.cover_url == null || (!m.cover_url && !!details.cover_url)
    if (priceChanged || needsGenres || needsCover) onSync(m, details)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, fresh])

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
  const cover = vinyl.cover_url || details?.cover_url
  const videos = (details?.videos ?? []).filter((v) => v.uri?.startsWith('http')).slice(0, 4)
  const owners = vinyl.owners || []
  const sides = useMemo(() => groupBySide(details?.tracklist ?? []), [details])
  const trackCount = sides.reduce((n, g) => n + g.tracks.length, 0)
  const totalMin = useMemo(() => {
    const secs = sides.flatMap((g) => g.tracks).map((t) => toSeconds(t.duration))
    if (!secs.length || secs.some((s) => s == null)) return null
    return Math.round(secs.reduce((a, b) => a + b, 0) / 60)
  }, [sides])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={vinyl.title}
        className="animate-pop relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barre du haut : le titre apparaît quand on fait défiler */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-5 py-3 transition duration-200 sm:px-6 ${
            compact ? 'border-b border-line bg-surface/90 backdrop-blur' : 'border-b border-transparent'
          }`}
        >
          <p
            aria-hidden={!compact}
            className={`min-w-0 flex-1 truncate font-display text-lg font-black uppercase transition duration-200 ${
              compact ? 'opacity-100' : 'translate-y-1 opacity-0'
            }`}
          >
            {vinyl.title}
          </p>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="pointer-events-auto shrink-0 rounded-full bg-surface/80 p-1.5 text-muted shadow-sm backdrop-blur transition hover:bg-raised hover:text-paper"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div
          className="nice-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onScroll={(e) => setCompact(e.currentTarget.scrollTop > 140)}
        >
          {/* En-tête : pochette + disque à la couleur du vinyle */}
          <header
            className="px-5 pb-6 pt-6 sm:px-7 sm:pt-7"
            style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${color} 22%, transparent), transparent)` }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="relative mr-12 w-36 shrink-0 sm:mr-16 sm:w-44">
                <div
                  aria-hidden="true"
                  className="vinyl-disc animate-disc absolute inset-[4%] translate-x-[30%]"
                  style={{ '--disc-label': color }}
                />
                <Cover
                  url={cover}
                  className="relative aspect-square w-full overflow-hidden rounded-sm shadow-[0_14px_30px_-12px_rgba(26,22,18,0.7)] ring-1 ring-black/10"
                />
              </div>

              <div className="min-w-0 pr-8 sm:pb-1">
                {vinyl.kind && vinyl.kind !== 'Album' && (
                  <span className="mb-2 inline-block bg-ink px-2 py-0.5 font-mono text-[10px] font-medium uppercase">
                    {vinyl.kind}
                  </span>
                )}
                <h2 className="font-display text-3xl font-black uppercase leading-[0.9] sm:text-4xl">{vinyl.title}</h2>
                <p className="mt-2 text-muted">
                  {vinyl.artist}
                  {vinyl.year && ` · ${vinyl.year}`}
                </p>
                {inRoom && owners.length > 0 && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <AvatarStack members={owners} size={22} />
                    {mode === 'wish' ? 'Voulu par ' : 'Dans la collection de '}
                    {owners.map((o) => o.name).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Actions, comme sur la carte */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {mine && mode === 'wish' && (
                <>
                  <div className="mr-1 flex items-center rounded-full border border-line bg-surface px-1.5 py-1" role="group" aria-label="Niveau d'envie">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => onPriority?.(vinyl.priority === n ? 0 : n)}
                        aria-label={`Envie ${n} sur 3`}
                        className={`p-0.5 transition hover:scale-110 ${n <= vinyl.priority ? 'text-accent' : 'text-line hover:text-accent/60'}`}
                      >
                        <StarIcon filled={n <= vinyl.priority} width={20} height={20} />
                      </button>
                    ))}
                  </div>
                  <button onClick={onGotIt} className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-soft">
                    <CheckIcon width={16} height={16} /> Je l'ai
                  </button>
                </>
              )}
              {mine && mode === 'owned' && vinyl.owned_at && (
                <span className="rounded-full bg-raised px-3.5 py-2 text-sm text-muted">
                  Dans ta collection depuis {sinceLabel(vinyl.owned_at)}
                </span>
              )}
              {mine && (
                <button onClick={onNote} className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-sm font-medium transition hover:border-accent hover:bg-raised">
                  <NoteIcon width={15} height={15} /> {vinyl.note ? 'Modifier la note' : 'Ajouter une note'}
                </button>
              )}
              {!mine && canAdd && (
                <button onClick={onMeToo} className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-soft">
                  <PlusIcon width={16} height={16} /> {mode === 'wish' ? 'Moi aussi' : 'Je l’ai aussi'}
                </button>
              )}
            </div>

            {vinyl.note && (
              <p className="mt-4 border-l-4 pl-3 text-sm italic text-muted" style={{ borderColor: color }}>
                {vinyl.note}
              </p>
            )}
          </header>

          <div className="space-y-6 px-5 pb-6 sm:px-7">
            {/* Prix */}
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink/60 px-5 py-4">
              {price != null ? (
                <div>
                  <p className="text-xs text-muted">Prix le plus bas en ce moment</p>
                  <p className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-black leading-none text-accent">{formatPrice(price)}</span>
                    {forSale != null && <span className="text-xs text-muted">{forSale} en vente</span>}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">{details || error ? 'Aucune offre en ce moment.' : 'Recherche des prix…'}</p>
              )}
              <a
                href={marketUrl(vinyl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent"
              >
                Voir les offres <ArrowIcon width={15} height={15} />
              </a>
            </section>
            <StoreLinks vinyl={vinyl} barcode={details?.barcode} />

            {(genres.length > 0 || styles.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => <Pill key={g} strong>{g}</Pill>)}
                {styles.map((s) => <Pill key={s}>{s}</Pill>)}
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">
                Impossible de charger les détails : {error}
              </p>
            )}

            {!details && !error && (
              <div className="animate-shimmer space-y-2">
                {[70, 90, 60, 80, 75].map((w, i) => (
                  <div key={i} className="h-4 rounded bg-raised" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}

            {/* Titres, par face */}
            {trackCount > 0 && (
              <section>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted">Titres</h3>
                  <p className="font-mono text-[11px] text-muted">
                    {trackCount} titre{trackCount > 1 ? 's' : ''}
                    {totalMin ? ` · ${totalMin} min` : ''}
                  </p>
                </div>
                {sides.map((g) => (
                  <div key={g.side ?? 'all'} className="mt-3 first:mt-0">
                    {g.side && (
                      <p className="mb-1 flex items-center gap-2 font-display text-sm font-black uppercase">
                        <span className="vinyl-disc block h-4 w-4" style={{ '--disc-label': color }} aria-hidden="true" />
                        Face {g.side}
                      </p>
                    )}
                    <ol className="divide-y divide-line/70 text-sm">
                      {g.tracks.map((t, i) => (
                        <li key={`${t.position}-${i}`} className="flex items-baseline gap-3 rounded-lg py-2.5 transition hover:bg-raised/60">
                          <span className="w-8 shrink-0 pl-1 font-mono text-xs text-muted">{t.position}</span>
                          <span className="min-w-0 flex-1">{t.title}</span>
                          {t.duration && <span className="shrink-0 pr-1 font-mono text-xs text-muted">{t.duration}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </section>
            )}

            {/* Écouter */}
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-muted">Écouter</h3>
              <div className="flex flex-wrap gap-2">
                {listenLinks(vinyl).map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-sm font-medium transition hover:border-accent hover:bg-raised"
                  >
                    <PlayIcon className="text-accent" /> {l.label}
                  </a>
                ))}
              </div>
              {videos.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {videos.map((v) => (
                    <li key={v.uri}>
                      <a
                        href={v.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm transition hover:border-accent hover:bg-raised"
                      >
                        <PlayIcon className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate">{v.title}</span>
                        <ArrowIcon width={15} height={15} className="shrink-0 text-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <a
              href={discogsUrl(vinyl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-bold text-ink transition hover:bg-accent-soft"
            >
              Voir la fiche sur Discogs <ArrowIcon width={16} height={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
