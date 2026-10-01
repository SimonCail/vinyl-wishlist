import { AvatarStack } from './Avatar'

// En-tête : platine animée + titre affiche. Le texte s'adapte à l'espace affiché.
export default function Hero({ count, context, topRight, compact = false }) {
  const isRoom = context?.kind === 'room'
  const isMe = context?.kind === 'me'

  return (
    <header className="relative overflow-hidden bg-accent text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-52 top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 opacity-30 sm:-right-28 sm:h-[38rem] sm:w-[38rem] sm:opacity-100"
      >
        <div
          className="vinyl-disc animate-disc h-full w-full"
          style={{ '--disc-label': isRoom ? '#f1c04e' : '#ec5b3e' }}
        />
        <svg viewBox="0 0 100 100" fill="none" className="absolute inset-0 h-full w-full overflow-visible">
          <g className="needle">
            <line x1="76" y1="16" x2="62" y2="70" stroke="#e9e3d3" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="59" y="68" width="6" height="9" rx="1.2" fill="#e9e3d3" transform="rotate(14 62 70)" />
            <rect x="73.5" y="6.5" width="5" height="8" rx="1.5" fill="#e9e3d3" transform="rotate(14 76 16)" />
          </g>
          <circle cx="76" cy="16" r="4.2" fill="#1b2420" stroke="#e9e3d3" strokeWidth="1.2" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-5xl px-5">
        <div className="flex items-center justify-between gap-3 py-4">
          <span className="font-mono text-xs text-ink/70">
            vinyl-wishlist{count != null && ` · ${String(count).padStart(3, '0')}`}
          </span>
          {topRight}
        </div>

        <div className={compact ? 'pb-20 pt-10 sm:pb-24 sm:pt-16' : 'pb-24 pt-14 sm:pb-32 sm:pt-24'}>
          {isRoom ? (
            <>
              <p className="animate-fade-up mb-4 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
                <AvatarStack members={context.members} size={30} />
                <span className="min-w-0 truncate">Salon · {context.name}</span>
              </p>
              <h1 className="font-display animate-fade-up text-[clamp(3.5rem,14vw,9.5rem)] font-black uppercase leading-[0.84]">
                Les disques
                <br />
                qu'on veut.
              </h1>
              <p className="animate-fade-up mt-6 max-w-sm text-ink/80" style={{ animationDelay: '120ms' }}>
                Vos souhaits et vos collections, réunis. Chacun garde sa liste
                perso, ici on voit tout ensemble.
              </p>
            </>
          ) : isMe ? (
            <>
              <p className="animate-fade-up mb-4 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
                Mon espace · {context.me.name}
              </p>
              <h1 className="font-display animate-fade-up text-[clamp(3.5rem,14vw,9.5rem)] font-black uppercase leading-[0.84]">
                Mes
                <br />
                disques.
              </h1>
              <p className="animate-fade-up mt-6 max-w-sm text-ink/80" style={{ animationDelay: '120ms' }}>
                Ce que tu veux, ce que tu as déjà. Ta liste te suit dans tous
                les salons que tu rejoins.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display animate-fade-up text-[clamp(3.5rem,14vw,9.5rem)] font-black uppercase leading-[0.84]">
                Les disques
                <br />
                qu'on veut.
              </h1>
              <p className="animate-fade-up mt-6 max-w-sm text-ink/80" style={{ animationDelay: '120ms' }}>
                Ta liste de souhaits et ta collection de vinyles. Rejoins le
                salon d'un proche pour tout mettre en commun.
              </p>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
