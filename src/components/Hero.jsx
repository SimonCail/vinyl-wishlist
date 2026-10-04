import { Avatar, AvatarStack } from './Avatar'
import SpinningDisc from './SpinningDisc'
import { RoomCover, roomColor } from './Rooms'
import { usePlayer, toggle } from '../lib/player'

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
)
// Petites barres qui dansent pendant la lecture
const Bars = () => (
  <span aria-hidden="true" className="eq flex h-3 items-end gap-[2px]">
    <span /><span /><span />
  </span>
)

// Le disque posé sur la platine, avec lecture des extraits (si le son est activé)
function NowSpinning({ disc }) {
  const player = usePlayer()
  if (!disc?.title) return null
  const album = { key: disc.key ?? `${disc.artist}|${disc.title}`, title: disc.title, artist: disc.artist, cover_url: disc.cover_url }
  const current = player.album?.key === album.key
  const playing = current && (player.status === 'playing' || player.status === 'loading')
  const track = current ? player.tracks[player.index] : null

  return (
    <div className="animate-fade-up mt-5 flex max-w-md items-center gap-3" style={{ animationDelay: '220ms' }}>
      {player.enabled && disc.artist && (
        <button
          onClick={() => toggle(album)}
          data-player-control
          aria-label={playing ? 'Mettre en pause' : `Écouter ${disc.title}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-accent shadow-lg transition hover:scale-105"
        >
          {current && player.status === 'loading' ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          ) : playing ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>
      )}
      <p className="min-w-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/70">
        <span className="flex items-center gap-2">
          {playing && player.status === 'playing' ? (
            <Bars />
          ) : (
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 animate-shimmer rounded-full bg-coral" />
          )}
          <span className="truncate">
            Sur la platine · {disc.title}
            {disc.artist && ` — ${disc.artist}`}
          </span>
        </span>
        {current && track && (
          <span className="mt-1 block truncate normal-case tracking-normal text-ink/85">
            {track.title} <span className="text-ink/55">· extrait {player.index + 1}/{player.tracks.length}</span>
          </span>
        )}
        {current && player.status === 'waiting' && (
          <span className="mt-1 block normal-case tracking-normal text-ink/60">Touche l’écran pour lancer la musique.</span>
        )}
        {current && player.status === 'unavailable' && (
          <span className="mt-1 block normal-case tracking-normal text-ink/60">Pas d’extrait trouvé pour cet album.</span>
        )}
      </p>
    </div>
  )
}

// En-tête : platine animée + titre affiche. Le texte s'adapte à l'espace affiché.
// disc : { cover_url, title, artist } du disque choisi dans le profil (sinon étiquette classique).
// Dans un salon, l'étiquette prend la couleur du salon.
export default function Hero({ count, context, topRight, compact = false, disc = null }) {
  const isRoom = context?.kind === 'room'
  const isMe = context?.kind === 'me'
  const isFriend = context?.kind === 'friend'
  const player = usePlayer()
  const discKey = disc ? disc.key ?? `${disc.artist}|${disc.title}` : null
  // 33 tours/minute pendant l'écoute, sinon rotation lente de décor
  const spinning = discKey && player.album?.key === discKey && player.status === 'playing'

  return (
    <header className="relative overflow-hidden bg-accent text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-52 top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 opacity-30 sm:-right-28 sm:h-[38rem] sm:w-[38rem] sm:opacity-100"
      >
        <SpinningDisc
          cover={disc?.cover_url}
          color={isRoom ? roomColor(context) : context?.kind === 'friend' ? context.friend.color || '#ec5b3e' : '#ec5b3e'}
          className={`hero-platter h-full w-full ${spinning ? 'is-playing' : ''}`}
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

      <div className="relative mx-auto max-w-[88rem] sm:px-8 lg:px-14 px-5">
        {topRight ? (
          <div className="flex items-center justify-between gap-3 py-4">
            <div className="ml-auto">{topRight}</div>
          </div>
        ) : (
          <div className="h-2" />
        )}

        <div className={compact ? 'pb-20 pt-10 sm:pb-24 sm:pt-16' : 'pb-16 pt-8 sm:pb-28 sm:pt-16'}>
          {isRoom ? (
            <>
              <p className="animate-fade-up mb-4 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
                <RoomCover room={context} size={30} className="ring-2 ring-ink/40" />
                <span className="min-w-0 truncate">Salon · {context.name}</span>
                <AvatarStack members={context.members} size={24} />
              </p>
              <h1 className="font-display animate-fade-up text-[clamp(3.5rem,14vw,9.5rem)] xl:text-[clamp(9.5rem,10vw,12.5rem)] font-black uppercase leading-[0.84]">
                Les disques
                <br />
                qu'on veut.
              </h1>
              <p className="animate-fade-up mt-6 max-w-sm text-ink/80 lg:max-w-md lg:text-lg" style={{ animationDelay: '120ms' }}>
                Vos souhaits et vos collections, réunis. Chacun garde sa liste
                perso, ici on voit tout ensemble.
              </p>
              <NowSpinning disc={disc} />
            </>
          ) : isFriend ? (
            <>
              <p className="animate-fade-up mb-4 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
                <Avatar member={context.friend} size={30} className="ring-2 ring-ink/40" />
                <span className="min-w-0 truncate">Chez un·e ami·e</span>
              </p>
              <h1 className="font-display animate-fade-up break-words text-[clamp(3.5rem,14vw,9.5rem)] xl:text-[clamp(9.5rem,10vw,12.5rem)] font-black uppercase leading-[0.84]">
                Chez
                <br />
                {context.friend.name}.
              </h1>
              <p className="animate-fade-up mt-6 max-w-sm text-ink/80 lg:max-w-md lg:text-lg" style={{ animationDelay: '120ms' }}>
                Ses souhaits et sa collection. Une idée de cadeau, ou un disque à ajouter à ta propre liste.
              </p>
              <NowSpinning disc={disc} />
            </>
          ) : isMe ? (
            <>
              <p className="animate-fade-up mb-4 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
                Ma liste · {context.me.name}
              </p>
              <h1 className="font-display animate-fade-up text-[clamp(3.5rem,14vw,9.5rem)] xl:text-[clamp(9.5rem,10vw,12.5rem)] font-black uppercase leading-[0.84]">
                Mes
                <br />
                disques.
              </h1>
              <p className="animate-fade-up mt-6 max-w-sm text-ink/80 lg:max-w-md lg:text-lg" style={{ animationDelay: '120ms' }}>
                Ce que tu veux, ce que tu as déjà. Ta liste te suit dans tous
                les salons que tu rejoins.
              </p>
              <NowSpinning disc={disc} />
            </>
          ) : (
            <>
              <h1 className="font-display animate-fade-up text-[clamp(3.5rem,14vw,9.5rem)] xl:text-[clamp(9.5rem,10vw,12.5rem)] font-black uppercase leading-[0.84]">
                Les disques
                <br />
                qu'on veut.
              </h1>
              <p className="animate-fade-up mt-6 max-w-sm text-ink/80 lg:max-w-md lg:text-lg" style={{ animationDelay: '120ms' }}>
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