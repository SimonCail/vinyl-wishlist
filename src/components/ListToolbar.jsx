import { SORT_OPTIONS } from '../lib/listUtils'
import { SearchIcon, CloseIcon } from './Icons'
import { Avatar } from './Avatar'
import SortSelect from './SortSelect'

function Chip({ active, onClick, children, count, lead }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border py-1.5 text-sm transition ${
        lead ? 'pl-1.5 pr-3.5' : 'px-3.5'
      } ${
        active
          ? 'border-accent bg-accent font-bold text-ink'
          : 'border-line text-muted hover:border-accent hover:text-paper'
      }`}
    >
      {lead}
      {children}
      {count != null && (
        <span className={`text-xs ${active ? 'text-ink/60' : 'text-muted/60'}`}>{count}</span>
      )}
    </button>
  )
}

export default function ListToolbar({
  search, onSearch, sort, onSort,
  genres, genre, onGenre, person, onPerson,
  members, meId, sharedCount, mode,
  hasFilters, onReset,
}) {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon width={18} height={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder="Filtrer dans la liste…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        <SortSelect value={sort} options={SORT_OPTIONS} onChange={onSort} />
      </div>

      {members && members.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs uppercase tracking-[0.15em] text-muted">De</span>
          <Chip active={!person} onClick={() => onPerson?.('')}>Tout le monde</Chip>
          {members.map((m) => (
            <Chip
              key={m.id}
              active={person === m.id}
              count={m.count}
              lead={<Avatar member={m} size={22} ring={false} />}
              onClick={() => onPerson?.(person === m.id ? '' : m.id)}
            >
              {m.id === meId ? 'Moi' : m.name}
            </Chip>
          ))}
          {sharedCount > 0 && (
            <Chip active={person === '__shared'} count={sharedCount} onClick={() => onPerson?.(person === '__shared' ? '' : '__shared')}>
              {mode === 'wish' ? '★ En commun' : '★ En double'}
            </Chip>
          )}
        </div>
      )}

      {genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={!genre} onClick={() => onGenre?.('')}>Tous les genres</Chip>
          {genres.map((g) => (
            <Chip
              key={g.name}
              active={genre === g.name}
              count={g.count}
              onClick={() => onGenre?.(genre === g.name ? '' : g.name)}
            >
              {g.name}
            </Chip>
          ))}
        </div>
      )}

      {hasFilters && (
        <button onClick={onReset} className="flex items-center gap-1.5 text-sm text-muted transition hover:text-paper">
          <CloseIcon width={14} height={14} /> Réinitialiser les filtres
        </button>
      )}
    </div>
  )
}
