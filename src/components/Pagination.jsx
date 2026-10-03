import { useEffect, useState } from 'react'

// Nombre de disques par page : toujours des rangées complètes selon le
// nombre de colonnes de la grille (2 sur mobile, 3, 4 puis 5 sur grand écran)
const SIZES = [
  { query: '(min-width: 1280px)', size: 15 }, // 5 colonnes × 3
  { query: '(min-width: 768px)', size: 12 }, // 4 colonnes × 3
  { query: '(min-width: 640px)', size: 12 }, // 3 colonnes × 4
]
const MOBILE_SIZE = 10 // 2 colonnes × 5

function currentSize() {
  if (typeof window === 'undefined' || !window.matchMedia) return MOBILE_SIZE
  return SIZES.find((s) => window.matchMedia(s.query).matches)?.size ?? MOBILE_SIZE
}

export function usePageSize() {
  const [size, setSize] = useState(currentSize)
  useEffect(() => {
    const lists = SIZES.map((s) => window.matchMedia(s.query))
    const update = () => setSize(currentSize())
    lists.forEach((l) => l.addEventListener('change', update))
    return () => lists.forEach((l) => l.removeEventListener('change', update))
  }, [])
  return size
}

// Numéros à afficher : 1 … 4 5 6 … 12 (la page courante et ses voisines)
function pageNumbers(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const set = new Set([1, count, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n))
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((n) => set.add(n))
  const nums = [...set].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push(`gap-${n}`)
    out.push(n)
  })
  return out
}

const Arrow = ({ dir }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
)

export default function Pagination({ page, pageCount, total, pageSize, onPage }) {
  if (pageCount <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const btn =
    'flex h-9 min-w-8 items-center justify-center rounded-full px-1.5 font-mono sm:h-10 sm:min-w-10 sm:px-3 text-sm transition disabled:pointer-events-none disabled:opacity-30'

  return (
    <nav aria-label="Pages" className="mt-14 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
          className={`${btn} text-paper hover:bg-raised`}
        >
          <Arrow dir="prev" />
        </button>
        {pageNumbers(page, pageCount).map((n) =>
          typeof n === 'string' ? (
            <span key={n} className="w-4 text-center font-mono sm:w-6 text-sm text-muted" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? 'page' : undefined}
              className={`${btn} ${
                n === page ? 'bg-accent font-bold text-ink' : 'text-paper hover:bg-raised'
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pageCount}
          aria-label="Page suivante"
          className={`${btn} text-paper hover:bg-raised`}
        >
          <Arrow dir="next" />
        </button>
      </div>
      <p className="font-mono text-xs text-muted">
        {from}–{to} sur {total}
      </p>
    </nav>
  )
}
