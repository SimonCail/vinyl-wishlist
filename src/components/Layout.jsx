import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import { ThemeToggle } from './ThemePicker'
import { FriendsIcon } from './Friends'

// --- Icônes de navigation ---
const base = {
  viewBox: '0 0 24 24',
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}
export const RecordIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 6.5a5.5 5.5 0 0 0-5.5 5.5" opacity=".55" />
  </svg>
)
export const RoomsIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="7" width="11" height="11" rx="2.2" />
    <path d="M7 4h11a3 3 0 0 1 3 3v11" />
  </svg>
)
export const ChatIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 12.5a7.5 7.5 0 0 1-11.2 6.5L4 20l1.1-4.2A7.5 7.5 0 1 1 20 12.5z" />
  </svg>
)

export const NAV = [
  { name: 'home', label: 'Ma liste', Icon: RecordIcon },
  { name: 'rooms', label: 'Salons', Icon: RoomsIcon },
  { name: 'friends', label: 'Amis', Icon: FriendsIcon },
  { name: 'messages', label: 'Messages', Icon: ChatIcon },
]
// Page → onglet allumé
export const sectionOf = (route) =>
  ({ home: 'home', rooms: 'rooms', room: 'rooms', friends: 'friends', friend: 'friends', messages: 'messages', chat: 'messages' })[
    route
  ] ?? 'home'

function Badge({ count, className = '' }) {
  if (!count) return null
  return (
    <span
      className={`keep-day flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral px-1 font-mono text-[10px] font-bold leading-none text-white ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

// Logo : un petit vinyle qui fait un tour à chaque changement de page
function Logo({ spinKey, onClick }) {
  return (
    <button onClick={onClick} aria-label="Accueil : ma liste" className="group flex items-center gap-2.5">
      <span
        key={spinKey}
        aria-hidden="true"
        className="vinyl-disc logo-spin block h-8 w-8 shrink-0 shadow-none ring-1 ring-black/30"
        style={{ '--disc-label': 'var(--color-ink)' }}
      />
      <span className="font-display text-[1.35rem] font-black uppercase leading-none tracking-tight">
        Vinyl&nbsp;Wishlist
      </span>
    </button>
  )
}

// Barre du haut, toujours visible
export function TopBar({ section, spinKey, badges, me, onNavigate, onProfile }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={`sticky top-0 z-30 bg-accent text-ink transition-shadow ${
        scrolled ? 'shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]' : ''
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[88rem] items-center gap-4 px-5 sm:px-8 lg:px-14">
        <Logo spinKey={spinKey} onClick={() => onNavigate('home')} />

        {/* Navigation (ordinateur) */}
        <nav aria-label="Navigation" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map(({ name, label }) => {
            const active = section === name
            return (
              <button
                key={name}
                onClick={() => onNavigate(name)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active ? 'bg-ink text-accent' : 'text-ink/80 hover:bg-ink/10 hover:text-ink'
                }`}
              >
                {label}
                <Badge count={badges[name]} />
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 md:ml-3">
          <ThemeToggle />
          <button
            onClick={onProfile}
            aria-label="Mon profil"
            title="Mon profil"
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-ink/50 transition hover:scale-105 hover:ring-ink"
          >
            <Avatar member={me} size={40} ring={false} className="block" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Onglets du bas (téléphone)
export function TabBar({ section, badges, onNavigate }) {
  const index = Math.max(0, NAV.findIndex((n) => n.name === section))
  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="relative grid grid-cols-4">
        {/* Repère de l'onglet allumé : glisse d'un onglet à l'autre */}
        <span
          aria-hidden="true"
          className="tab-marker absolute top-0 h-[3px] w-1/4 rounded-b-full"
          style={{ transform: `translateX(${index * 100}%)` }}
        >
          <span className="mx-auto block h-full w-10 rounded-b-full bg-[var(--color-accent)]" />
        </span>
        {NAV.map(({ name, label, Icon }) => {
          const active = section === name
          return (
            <button
              key={name}
              onClick={() => onNavigate(name)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] transition ${
                active ? 'font-bold text-accent' : 'text-muted'
              }`}
            >
              <span className="relative">
                <Icon />
                <Badge count={badges[name]} className="absolute -right-2.5 -top-1.5" />
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// En-tête court des pages (salon, ami, salons, amis, messages)
// media : image à gauche (pochette, avatar) ; actions : boutons à droite ;
// discColor : étiquette du vinyle qui dépasse à droite
export function PageHeader({ title, subtitle, media, actions, discColor = '#ec5b3e', children }) {
  return (
    <header className="relative overflow-hidden bg-accent text-ink">
      <div
        aria-hidden="true"
        className="vinyl-disc animate-disc pointer-events-none absolute -right-28 top-1/2 h-[22rem] w-[22rem] -translate-y-1/2 opacity-25 sm:-right-20 sm:opacity-100"
        style={{ '--disc-label': discColor }}
      />
      <div className="page-in relative mx-auto max-w-[88rem] px-5 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-8 lg:px-14">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
          {media && <div className="shrink-0">{media}</div>}
          <div className="min-w-0 flex-1 basis-56">
            <h1 className="font-display break-words text-[clamp(2.6rem,9vw,4.75rem)] font-black uppercase leading-[0.86]">
              {title}
            </h1>
            {subtitle && <div className="mt-3 text-sm text-ink/80 sm:text-base">{subtitle}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 sm:mr-40 lg:mr-56">{actions}</div>}
        </div>
        {children}
      </div>
    </header>
  )
}

// Bouton posé sur l'en-tête coloré
export const headerBtn =
  'flex items-center gap-1.5 rounded-full border border-ink/40 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-accent'
export const headerBtnSolid =
  'flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-accent transition hover:bg-ink/85'
