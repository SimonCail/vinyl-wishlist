import { useEffect, useMemo, useRef, useState } from 'react'
import { CloseIcon, SearchIcon, CheckIcon } from './Icons'
import { CLASSICS, loadArtistImages, searchArtistImages } from '../lib/artistAvatars'

const MAX_MINE = 12 // artistes de tes listes affichés
const MAX_TILES = 24

const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function Tile({ item, selected, onSelect }) {
  return (
    <li>
      <button
        onClick={() => onSelect(item)}
        aria-pressed={selected}
        aria-label={item.label}
        className="group block w-full text-left"
      >
        <span
          className={`relative block aspect-square overflow-hidden rounded-2xl bg-ink/10 transition duration-200 group-hover:scale-[1.04] ${
            selected ? 'ring-4 ring-sun ring-offset-2 ring-offset-accent' : 'group-hover:ring-2 group-hover:ring-ink/70'
          }`}
        >
          <img src={item.url} alt="" loading="lazy" draggable="false" className="h-full w-full object-cover" />
          {selected && (
            <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-sun text-paper shadow-lg">
              <CheckIcon width={16} height={16} />
            </span>
          )}
        </span>
        <span className={`mt-2 block truncate text-center font-display text-sm font-bold uppercase leading-tight ${selected ? 'text-ink' : 'text-ink/75 group-hover:text-ink'}`}>
          {item.label}
        </span>
      </button>
    </li>
  )
}

function Placeholder() {
  return (
    <li className="animate-shimmer">
      <span className="block aspect-square rounded-2xl bg-ink/15" />
      <span className="mx-auto mt-2 block h-3 w-2/3 rounded bg-ink/15" />
    </li>
  )
}

function Section({ title, children }) {
  return (
    <section className="mt-6 first:mt-0">
      <h4 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/70">{title}</h4>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-6">{children}</ul>
    </section>
  )
}

// Choix d'un avatar d'artiste, façon « Qui regarde ? » : les artistes de tes
// listes d'abord, puis des classiques, et une recherche Discogs.
export default function ArtistAvatarPicker({ myArtists, currentUrl, busy, error, onConfirm, onCancel }) {
  const mine = useMemo(() => myArtists.slice(0, MAX_MINE), [myArtists])
  const classics = useMemo(() => {
    const taken = new Set(mine.map(norm))
    return CLASSICS.filter((n) => !taken.has(norm(n))).slice(0, Math.max(6, MAX_TILES - mine.length))
  }, [mine])

  const [images, setImages] = useState({}) // nom -> { label, url } | null
  const [loadError, setLoadError] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const requestId = useRef(0)

  // Chargement progressif des images
  useEffect(() => {
    let cancelled = false
    loadArtistImages([...mine, ...classics], (name, value) => {
      if (!cancelled) setImages((prev) => ({ ...prev, [name]: value }))
    }, { isCancelled: () => cancelled }).then(({ failures }) => {
      if (!cancelled && failures > 0 && failures >= mine.length + classics.length) {
        setLoadError('Impossible de joindre Discogs pour le moment. Réessaie dans un instant.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [mine, classics])

  // Recherche libre (après une courte pause de frappe)
  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) {
      setResults(null)
      setSearching(false)
      return
    }
    const id = ++requestId.current
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const found = await searchArtistImages(text)
        if (id === requestId.current) setResults(found)
      } catch {
        if (id === requestId.current) setResults([])
      } finally {
        if (id === requestId.current) setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  // Fermeture avec Échap
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const tilesFor = (names) => names.map((n) => [n, images[n]]).filter(([, v]) => v !== null)
  const render = (entries) =>
    entries.map(([n, v]) =>
      v ? (
        <Tile key={n} item={v} selected={selected?.url === v.url} onSelect={setSelected} />
      ) : (
        <Placeholder key={n} />
      )
    )
  const mineTiles = tilesFor(mine)
  const classicTiles = tilesFor(classics)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choisir un artiste"
        className="animate-pop flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-accent text-ink shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
          <div>
            <h3 className="font-display text-4xl font-black uppercase leading-[0.85] sm:text-6xl">
              Choisis ton
              <br />
              artiste.
            </h3>
            <p className="mt-3 max-w-md text-sm text-ink/75">
              Il remplace ta photo partout : dans tes salons, sur tes disques, dans les invitations.
            </p>
          </div>
          <button onClick={onCancel} disabled={busy} aria-label="Fermer" className="-mr-1 shrink-0 rounded-full p-1.5 text-ink/80 transition hover:bg-ink/15 hover:text-ink">
            <CloseIcon width={22} height={22} />
          </button>
        </div>

        <div className="px-5 sm:px-8">
          <div className="relative">
            <SearchIcon width={18} height={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un autre artiste…"
              aria-label="Chercher un artiste"
              autoComplete="off"
              className="w-full rounded-2xl border border-ink/25 bg-ink/10 py-3 pl-11 pr-4 text-ink outline-none transition placeholder:text-ink/55 focus:border-ink/60 focus:bg-ink/15"
            />
            {searching && (
              <span className="absolute right-4 top-1/2 block h-4 w-4 -translate-y-1/2 animate-rotate rounded-full border-2 border-ink/30 border-t-ink" />
            )}
          </div>
        </div>

        <div className="nice-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5 sm:px-8">
          {loadError && <p className="mb-4 rounded-xl bg-ink/15 p-3 text-sm">{loadError}</p>}

          {results !== null ? (
            <Section title={`Résultats pour « ${query.trim()} »`}>
              {results.length === 0 && !searching ? (
                <li className="col-span-full py-6 text-center text-sm text-ink/75">Aucun artiste avec photo pour cette recherche.</li>
              ) : (
                results.map((r) => <Tile key={r.url} item={r} selected={selected?.url === r.url} onSelect={setSelected} />)
              )}
            </Section>
          ) : (
            <>
              {mineTiles.length > 0 && <Section title="Dans tes listes">{render(mineTiles)}</Section>}
              <Section title="Classiques">{render(classicTiles)}</Section>
            </>
          )}
        </div>

        {/* Barre de validation */}
        <div className="flex flex-wrap items-center gap-3 border-t border-ink/15 bg-accent-soft px-5 py-4 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {selected ? (
              <>
                <img src={selected.url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-sun" />
                <p className="min-w-0 truncate font-display text-lg font-black uppercase">{selected.label}</p>
              </>
            ) : (
              <p className="text-sm text-ink/70">{currentUrl ? 'Choisis un autre artiste' : 'Choisis un artiste dans la grille'}</p>
            )}
          </div>
          {error && <p className="w-full rounded-xl bg-ink px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex w-full gap-2 sm:w-auto">
            <button onClick={onCancel} disabled={busy} className="flex-1 rounded-full border border-ink/40 px-5 py-2.5 text-sm font-medium transition hover:bg-ink/10 sm:flex-none">
              Annuler
            </button>
            <button
              onClick={() => onConfirm(selected)}
              disabled={!selected || busy}
              className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-accent transition hover:bg-surface disabled:opacity-50 sm:flex-none"
            >
              {busy ? '…' : selected ? `Choisir ${selected.label}` : 'Choisir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
