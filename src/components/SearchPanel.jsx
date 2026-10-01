import { useEffect, useRef, useState } from 'react'
import Cover from './Cover'
import { SearchIcon, CloseIcon, PlusIcon, CheckIcon } from './Icons'
import { searchVinyls, searchArtists, getArtistAlbums, itemKey } from '../lib/discogs'

const DEBOUNCE_MS = 400
const MIN_CHARS = 2

// statusOf(item) : 'wish' | 'owned' | null selon ma liste perso
// onAdd(item, status) : ajoute à mes souhaits ou à ma collection
// onGotIt(item) : un de mes souhaits passe dans ma collection
function BarcodeIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" aria-hidden="true" {...p}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 8v8M10 8v8M13 8v8M16.5 8v8" />
    </svg>
  )
}

export default function SearchPanel({ statusOf, onAdd, onGotIt, onError, onScan, offline }) {
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState([])
  const [results, setResults] = useState([])
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pending, setPending] = useState(() => new Set()) // ajouts en cours

  // Sert à ignorer les réponses des recherches déjà dépassées
  const requestId = useRef(0)

  function reset() {
    requestId.current++
    setArtists([])
    setResults([])
    setSelectedArtist(null)
    setSearched(false)
    setSearching(false)
  }

  async function runSearch(text) {
    const id = ++requestId.current
    setSearching(true)
    try {
      const [artistList, albumList] = await Promise.all([
        searchArtists(text),
        searchVinyls(text),
      ])
      if (id !== requestId.current) return
      setSelectedArtist(null)
      setArtists(artistList)
      setResults(albumList)
      setSearched(true)
    } catch (err) {
      if (id === requestId.current) onError(err.message)
    } finally {
      if (id === requestId.current) setSearching(false)
    }
  }

  async function handleSelectArtist(artist) {
    const id = ++requestId.current
    setSearching(true)
    try {
      const albums = await getArtistAlbums(artist)
      if (id !== requestId.current) return
      setResults(albums)
      setSelectedArtist(artist)
      setArtists([])
    } catch (err) {
      if (id === requestId.current) onError(err.message)
    } finally {
      if (id === requestId.current) setSearching(false)
    }
  }

  // Recherche automatique après une courte pause de frappe
  useEffect(() => {
    const text = query.trim()
    if (text.length < MIN_CHARS) return
    const timer = setTimeout(() => runSearch(text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    if (value.trim().length < MIN_CHARS) reset()
  }

  function handleSubmit(e) {
    e.preventDefault() // Entrée force simplement la recherche tout de suite
    const text = query.trim()
    if (text.length >= MIN_CHARS) runSearch(text)
  }

  function clear() {
    setQuery('')
    reset()
  }

  // Évite les doubles clics pendant que l'ajout part en base
  async function withPending(item, action) {
    const key = itemKey(item)
    if (pending.has(key)) return
    setPending((s) => new Set(s).add(key))
    try {
      await action()
    } finally {
      setPending((s) => {
        const next = new Set(s)
        next.delete(key)
        return next
      })
    }
  }

  const empty = searched && !artists.length && !results.length
  const smallBtn = 'rounded-full px-3 py-1.5 text-xs transition disabled:opacity-50'

  return (
    <section>
      <div className="flex gap-2">
        <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={handleChange}
            enterKeyHint="search"
            autoComplete="off"
            disabled={offline}
            aria-label="Chercher un disque à ajouter"
            placeholder={
              offline
                ? 'Recherche indisponible hors-ligne'
                : 'Un artiste, un album… (ex. Josman, Discovery)'
            }
            className="w-full rounded-2xl border border-line bg-surface py-4 pl-14 pr-14 text-base shadow-[0_10px_30px_-14px_rgba(27,36,32,0.35)] outline-none transition placeholder:text-muted/70 focus:border-accent focus:shadow-[0_14px_36px_-14px_rgba(29,74,58,0.5)] focus:ring-4 focus:ring-accent/10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {searching ? (
              <span className="m-1.5 block h-5 w-5 animate-rotate rounded-full border-2 border-line border-t-accent" />
            ) : (
              query && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Effacer la recherche"
                  className="rounded-full p-1.5 text-muted transition hover:bg-raised hover:text-paper"
                >
                  <CloseIcon width={18} height={18} />
                </button>
              )
            )}
          </div>
        </form>
        {onScan && (
          <button
            type="button"
            onClick={onScan}
            disabled={offline}
            aria-label="Scanner un code-barres"
            title="Scanner le code-barres d'un vinyle"
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-accent px-4 font-bold text-ink shadow-[0_10px_30px_-14px_rgba(27,36,32,0.5)] transition hover:bg-accent-soft disabled:opacity-50 sm:px-5"
          >
            <BarcodeIcon />
            <span className="hidden sm:inline">Scanner</span>
          </button>
        )}
      </div>

      {searched && (
        <div className="animate-pop mt-3 rounded-3xl border border-line bg-surface/90 p-4 backdrop-blur sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            {selectedArtist ? (
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => runSearch(query.trim())}
                  className="shrink-0 text-sm text-muted transition hover:text-paper"
                >
                  ← Retour
                </button>
                <h2 className="truncate font-display text-lg font-bold">
                  {selectedArtist.name}
                </h2>
              </div>
            ) : (
              <h2 className="font-display text-lg font-bold">Résultats</h2>
            )}
            <button
              onClick={clear}
              className="shrink-0 text-sm text-muted transition hover:text-paper"
            >
              Fermer
            </button>
          </div>

          {empty && (
            <p className="py-8 text-center text-muted">
              Rien trouvé pour « {query.trim()} ». Essaie une autre orthographe.
            </p>
          )}

          {artists.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-muted">
                Artistes
              </p>
              <div className="flex flex-wrap gap-2">
                {artists.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelectArtist(a)}
                    className="flex items-center gap-2.5 rounded-full border border-line bg-raised py-1 pl-1 pr-4 text-sm font-medium transition hover:border-accent"
                  >
                    <Cover url={a.image} className="h-10 w-10 overflow-hidden rounded-full" />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <>
              {!selectedArtist && (
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-muted">
                  Albums
                </p>
              )}
              <ul className="nice-scroll grid max-h-[26rem] gap-1 overflow-y-auto sm:grid-cols-2">
                {results.map((item, i) => {
                  const key = itemKey(item)
                  const status = statusOf(item)
                  const busy = pending.has(key)
                  return (
                    <li
                      key={key}
                      className="animate-fade-up flex items-center gap-3 rounded-2xl p-2 transition hover:bg-raised"
                      style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                    >
                      <Cover
                        url={item.cover_url}
                        className="h-14 w-14 shrink-0 overflow-hidden rounded-md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted">
                          {item.artist}
                          {item.year && ` · ${item.year}`}
                          {item.kind && ` · ${item.kind}`}
                        </p>
                        {status === 'wish' && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                            <CheckIcon width={13} height={13} /> Dans mes souhaits
                          </p>
                        )}
                      </div>
                      {status === 'owned' ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                          <CheckIcon width={14} height={14} /> Dans ma collection
                        </span>
                      ) : status === 'wish' ? (
                        <button
                          onClick={() => withPending(item, () => onGotIt(item))}
                          disabled={busy}
                          className={`${smallBtn} shrink-0 border border-line font-medium hover:border-accent`}
                        >
                          Je l'ai
                        </button>
                      ) : (
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            onClick={() => withPending(item, () => onAdd(item, 'wish'))}
                            disabled={busy}
                            className={`${smallBtn} flex items-center gap-1 bg-accent font-bold text-ink hover:bg-accent-soft`}
                          >
                            <PlusIcon width={13} height={13} /> Souhait
                          </button>
                          <button
                            onClick={() => withPending(item, () => onAdd(item, 'owned'))}
                            disabled={busy}
                            className={`${smallBtn} border border-line font-medium hover:border-accent`}
                          >
                            Je l'ai
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
