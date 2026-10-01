import { SORT_OPTIONS } from '../lib/listUtils'
import { SearchIcon, CloseIcon } from './Icons'

function Chip({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? 'border-accent bg-accent font-bold text-ink'
          : 'border-line text-muted hover:border-accent hover:text-paper'
      }`}
    >
      {children}
      {count != null && (
        <span className={`ml-1.5 text-xs ${active ? 'text-ink/60' : 'text-muted/60'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

export default function ListToolbar({
  search, onSearch, sort, onSort,
  facets, genre, onGenre, person, onPerson,
  hasFilters, onReset,
}) {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Filtrer dans la liste…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-accent"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Trier : {o.label}
            </option>
          ))}
        </select>
      </div>

      {facets.genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={!genre} onClick={() => onGenre('')}>
            Tous les genres
          </Chip>
          {facets.genres.map((g) => (
            <Chip
              key={g.name}
              active={genre === g.name}
              count={g.count}
              onClick={() => onGenre(genre === g.name ? '' : g.name)}
            >
              {g.name}
            </Chip>
          ))}
        </div>
      )}

      {facets.people.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.15em] text-muted">
            Ajoutés par
          </span>
          {facets.people.map((p) => (
            <Chip
              key={p.name}
              active={person === p.name}
              count={p.count}
              onClick={() => onPerson(person === p.name ? '' : p.name)}
            >
              {p.name}
            </Chip>
          ))}
        </div>
      )}

      {hasFilters && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-muted transition hover:text-paper"
        >
          <CloseIcon width={14} height={14} /> Réinitialiser les filtres
        </button>
      )}
    </div>
  )
}