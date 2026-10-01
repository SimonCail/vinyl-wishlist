import { useEffect, useRef, useState } from 'react'
import Cover from './Cover'
import { SearchIcon, CloseIcon, PlusIcon, CheckIcon } from './Icons'
import { searchVinyls, searchArtists, getArtistAlbums } from '../lib/discogs'

const DEBOUNCE_MS = 400
const MIN_CHARS = 2

export default function SearchPanel({ inListIds, onAdd, onError, offline }) {
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState([])
  const [results, setResults] = useState([])
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

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
      const albums = await getArtistAlbums(artist.id)
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

  const empty = searched && !artists.length && !results.length

  return (
    <section>
      <form onSubmit={handleSubmit} className="relative">
        <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={handleChange}
          enterKeyHint="search"
          autoComplete="off"
          disabled={offline}
          placeholder={
            offline
                ? 'Recherche indisponible hors-ligne'
                : 'Un artiste, un album… (ex. Josman, Discovery)'
          }
          className="w-full rounded-2xl border border-line bg-surface py-4 pl-14 pr-14 text-base outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15"
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
              <ul className="grid max-h-[26rem] gap-1 overflow-y-auto sm:grid-cols-2">
                {results.map((item) => {
                  const added = inListIds.has(item.discogs_id)
                  return (
                    <li
                      key={item.discogs_id}
                      className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-raised"
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
                        </p>
                      </div>
                      {added ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                          <CheckIcon width={14} height={14} /> Dans la liste
                        </span>
                      ) : (
                        <button
                          onClick={() => onAdd(item)}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-ink transition hover:bg-accent-soft"
                        >
                          <PlusIcon width={14} height={14} /> Ajouter
                        </button>
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