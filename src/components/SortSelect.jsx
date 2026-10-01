import { useEffect, useId, useRef, useState } from 'react'
import { ChevronIcon, CheckIcon } from './Icons'

export default function SortSelect({ value, options, onChange, label = 'Trier' }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const listId = useId()
  const current = options.find((o) => o.value === value) || options[0]

  // Fermeture au clic en dehors
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function openMenu() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function choose(i) {
    onChange(options[i].value)
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => (i === last ? 0 : i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => (i === 0 ? last : i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(last)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className="relative sm:w-64">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-surface px-4 py-2.5 text-sm transition hover:border-accent/50 ${
          open ? 'border-accent ring-4 ring-accent/10' : 'border-line'
        }`}
      >
        <span className="truncate">
          <span className="text-muted">{label} : </span>
          <span className="font-medium">{current.label}</span>
        </span>
        <ChevronIcon
          width={16}
          height={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="animate-pop absolute left-0 right-0 z-30 mt-2 origin-top overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgba(27,36,32,0.5)] sm:left-auto sm:w-full sm:min-w-[15rem]"
        >
          {options.map((o, i) => {
            const selected = o.value === value
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  i === active ? 'bg-raised' : ''
                } ${selected ? 'font-medium text-accent' : ''}`}
              >
                {o.label}
                {selected && <CheckIcon width={16} height={16} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
