import { useTheme } from '../hooks/useTheme'
import { usePlayer, setSoundEnabled } from '../lib/player'

export const SunIcon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
  </svg>
)
export const MoonIcon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
)

// Mini page : bandeau couleur du site + fond, aux couleurs du thème
function Preview({ bg, text, line }) {
  return (
    <span className="block overflow-hidden rounded-lg" style={{ background: bg }}>
      <span className="relative block h-7" style={{ background: 'var(--user-accent-bg, #1d4a3a)' }}>
        <span className="absolute -right-2 top-1.5 h-9 w-9 rounded-full bg-[#111] shadow-[inset_0_0_0_9px_#1a1a1c]">
          <span className="absolute inset-[34%] rounded-full bg-[#ec5b3e]" />
        </span>
        <span className="absolute left-2 top-2 h-1.5 w-8 rounded-full bg-[#f5f1e8]/80" />
      </span>
      <span className="flex gap-1.5 p-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block flex-1">
            <span className="block aspect-square rounded-[3px]" style={{ background: line }} />
            <span className="mt-1 block h-1 w-3/4 rounded-full" style={{ background: text, opacity: 0.7 }} />
          </span>
        ))}
      </span>
    </span>
  )
}

const DAY = { bg: '#f5f1e8', text: '#1b2420', line: '#e2dbc9' }
const NIGHT = { bg: '#101714', text: '#f0eadd', line: '#2d3833' }

const OPTIONS = [
  { id: 'light', label: 'Jour', preview: <Preview {...DAY} /> },
  { id: 'dark', label: 'Nuit', preview: <Preview {...NIGHT} /> },
  {
    id: 'system',
    label: 'Auto',
    preview: (
      <span className="relative block">
        <Preview {...DAY} />
        <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
          <Preview {...NIGHT} />
        </span>
      </span>
    ),
  },
]

// Réglage dans le profil : Jour / Nuit / Auto
export function ThemeSettings() {
  const { choice, theme, setChoice } = useTheme()
  return (
    <div>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Apparence">
        {OPTIONS.map((o) => {
          const active = choice === o.id
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(o.id)}
              className={`group rounded-2xl border p-2 text-left transition ${
                active ? 'border-accent ring-4 ring-accent/15' : 'border-line hover:border-accent/60'
              }`}
            >
              {o.preview}
              <span className={`mt-2 block text-center text-sm ${active ? 'font-bold' : 'text-muted group-hover:text-paper'}`}>
                {o.label}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-muted">
        {choice === 'system'
          ? `Suit le réglage de ton appareil (en ce moment : ${theme === 'dark' ? 'nuit' : 'jour'}).`
          : 'Réglage gardé sur cet appareil.'}
      </p>
      <SoundSetting />
    </div>
  )
}

// Son de la platine : écouter les extraits du disque posé sur la platine
export function SoundSetting() {
  const { enabled } = usePlayer()
  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
      <div className="min-w-0">
        <p className="font-medium">Son de la platine</p>
        <p className="mt-0.5 text-sm text-muted">
          {enabled
            ? 'Le disque de ta platine se lance à l’ouverture de l’app, et quand tu en poses un nouveau.'
            : 'Coupé : la platine tourne en silence.'}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label="Son de la platine"
        onClick={() => setSoundEnabled(!enabled)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-accent' : 'bg-raised ring-1 ring-line'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full shadow transition-all ${enabled ? 'left-6 bg-ink' : 'left-1 bg-muted'}`}
        />
      </button>
    </div>
  )
}

// Bouton rapide dans l'en-tête : passe de jour à nuit et inversement
export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const label = dark ? 'Passer en mode jour' : 'Passer en mode nuit'
  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/40 text-ink transition hover:bg-ink hover:text-accent ${className}`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}