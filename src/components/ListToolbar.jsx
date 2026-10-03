import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SORT_OPTIONS } from '../lib/listUtils'
import { SearchIcon, CloseIcon } from './Icons'
import { Avatar } from './Avatar'
import SortSelect from './SortSelect'

const FilterIcon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" aria-hidden="true" {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)

function Chip({ active, onClick, children, count, className = '' }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${
        active ? 'border-accent bg-accent font-bold text-ink' : 'border-line text-muted hover:border-accent hover:text-paper'
      } ${className}`}
    >
      {children}
      {count != null && <span className={`text-xs ${active ? 'text-ink/60' : 'text-muted/60'}`}>{count}</span>}
    </button>
  )
}

// Personnes d'un salon (+ « en commun »)
function PeopleChips({ members, meId, person, onPerson, sharedCount }) {
  return (
    <>
      {members.map((m) => (
        <Chip key={m.id} active={person === m.id} count={m.count} onClick={() => onPerson(person === m.id ? '' : m.id)}>
          <Avatar member={m} size={20} ring={false} className="-ml-1.5" />
          {m.id === meId ? 'Moi' : m.name}
        </Chip>
      ))}
      {sharedCount > 0 && (
        <Chip active={person === '__shared'} count={sharedCount} onClick={() => onPerson(person === '__shared' ? '' : '__shared')}>
          En commun
        </Chip>
      )}
    </>
  )
}

// Panneau des filtres qui monte du bas (téléphone)
function FilterSheet({ options, sort, onSort, genres, genre, onGenre, people, hasFilters, onReset, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtres"
        onClick={(e) => e.stopPropagation()}
        className="sheet-up nice-scroll max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
      >
        <span aria-hidden="true" className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-black uppercase leading-none">Filtres</h2>
          {hasFilters && (
            <button onClick={onReset} className="text-sm font-medium text-muted underline-offset-4 hover:text-paper hover:underline">
              Tout effacer
            </button>
          )}
        </div>

        <h3 className="mb-2 mt-6 text-sm font-medium text-muted">Trier par</h3>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Chip key={o.value} active={sort === o.value} onClick={() => onSort(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>

        {genres.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 text-sm font-medium text-muted">Genre</h3>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <Chip key={g.name} active={genre === g.name} count={g.count} onClick={() => onGenre(genre === g.name ? '' : g.name)}>
                  {g.name}
                </Chip>
              ))}
            </div>
          </>
        )}

        {people && (
          <>
            <h3 className="mb-2 mt-6 text-sm font-medium text-muted">À qui</h3>
            <div className="flex flex-wrap gap-2">{people}</div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-8 w-full rounded-full bg-accent py-3.5 text-sm font-bold text-ink transition hover:bg-accent-soft"
        >
          Voir les disques
        </button>
      </div>
    </div>
  )
}

// Recherche, tri, genres et personnes.
// Téléphone : une barre accrochée en haut (recherche + « Filtres ») et une
// ligne de genres qui défile sur le côté ; le reste dans le panneau du bas.
// Ordinateur : tout est visible.
export default function ListToolbar({
  search, onSearch, sort, onSort,
  genres = [], genre, onGenre, person, onPerson,
  members, meId, sharedCount = 0, mode,
  hasFilters, onReset,
}) {
  const [sheet, setSheet] = useState(false)
  // La priorité n'a de sens que pour les souhaits
  const options = SORT_OPTIONS.filter((o) => mode !== 'owned' || o.value !== 'priority')
  const showPeople = members && members.length > 1
  const activeCount = (genre ? 1 : 0) + (person ? 1 : 0) + (sort !== options[0]?.value ? 1 : 0)
  const people = showPeople ? (
    <PeopleChips members={members} meId={meId} person={person} onPerson={onPerson} sharedCount={sharedCount} />
  ) : null

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <SearchIcon width={18} height={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Filtrer dans la liste…"
        aria-label="Filtrer dans la liste"
        enterKeyHint="search"
        className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-9 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent sm:rounded-xl"
      />
      {search && (
        <button
          onClick={() => onSearch('')}
          aria-label="Effacer"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-paper"
        >
          <CloseIcon width={14} height={14} />
        </button>
      )}
    </div>
  )

  return (
    // Téléphone : toute la barre reste accrochée sous la barre du haut pendant qu'on fait défiler
    <div className="sticky top-16 z-20 -mx-5 mb-6 border-b border-line/60 bg-ink/90 px-5 py-3 backdrop-blur-md sm:static sm:mx-0 sm:mb-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {/* --- Téléphone --- */}
      <div className="space-y-2.5 sm:hidden">
        <div className="flex gap-2">
          {searchField}
          <button
            onClick={() => setSheet(true)}
            aria-label={activeCount ? `Filtres (${activeCount} actifs)` : 'Filtres'}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
              activeCount ? 'border-accent bg-accent text-ink' : 'border-line bg-surface text-paper'
            }`}
          >
            <FilterIcon />
            Filtres
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-mono text-[11px] font-bold text-accent">
                {activeCount}
              </span>
            )}
          </button>
        </div>
        {genres.length > 0 && (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            <Chip active={!genre} onClick={() => onGenre('')}>
              Tout
            </Chip>
            {genres.map((g) => (
              <Chip key={g.name} active={genre === g.name} count={g.count} onClick={() => onGenre(genre === g.name ? '' : g.name)}>
                {g.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* --- Ordinateur --- */}
      <div className="hidden space-y-4 sm:block">
        <div className="flex gap-2">
          {searchField}
          <SortSelect value={sort} options={options} onChange={onSort} />
        </div>
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={!genre} onClick={() => onGenre('')}>
              Tous les genres
            </Chip>
            {genres.map((g) => (
              <Chip key={g.name} active={genre === g.name} count={g.count} onClick={() => onGenre(genre === g.name ? '' : g.name)}>
                {g.name}
              </Chip>
            ))}
          </div>
        )}
        {showPeople && <div className="flex flex-wrap items-center gap-2">{people}</div>}
        {hasFilters && (
          <button onClick={onReset} className="flex items-center gap-1.5 text-sm text-muted transition hover:text-paper">
            <CloseIcon width={14} height={14} /> Réinitialiser les filtres
          </button>
        )}
      </div>

      {sheet && createPortal(
        <FilterSheet
          options={options}
          sort={sort}
          onSort={onSort}
          genres={genres}
          genre={genre}
          onGenre={onGenre}
          people={people}
          hasFilters={hasFilters || sort !== options[0]?.value}
          onReset={() => {
            onReset()
            onSort(options[0]?.value)
          }}
          onClose={() => setSheet(false)}
        />,
        document.body
      )}
    </div>
  )
}
