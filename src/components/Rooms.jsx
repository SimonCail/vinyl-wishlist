import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarStack } from './Avatar'
import { CheckIcon, ChevronIcon, PlusIcon, CopyIcon, CloseIcon } from './Icons'

// Couleurs proposées pour un salon (celles du site)
export const ROOM_COLORS = ['#ec5b3e', '#e58a4e', '#f1c04e', '#b9cf5a', '#6fbf98', '#6aa6d6', '#f09aaa']

// Couleur d'un salon : celle choisie par le responsable, sinon une couleur
// tirée de son identifiant (toujours la même pour un salon donné)
export function roomColor(room) {
  if (room?.color) return room.color
  let h = 0
  for (const ch of String(room?.id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ROOM_COLORS[h % ROOM_COLORS.length]
}

// Pochette d'un salon : l'image choisie, sinon un carré à sa couleur avec l'initiale
export function RoomCover({ room, size = 36, className = '' }) {
  const [failed, setFailed] = useState(null)
  const showImage = room.cover_url && failed !== room.cover_url
  return (
    <span
      aria-hidden="true"
      className={`keep-day relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-display font-black uppercase text-paper shadow-[0_4px_12px_-6px_rgba(0,0,0,0.5)] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.46, backgroundColor: roomColor(room) }}
    >
      {showImage ? (
        <img
          src={room.cover_url}
          alt=""
          loading="lazy"
          draggable="false"
          onError={() => setFailed(room.cover_url)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        (room.name || '?').trim()[0]
      )}
    </span>
  )
}

// Petite couronne : le responsable du salon
export function CrownIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M3 8.5 7.5 12 12 5l4.5 7L21 8.5 19 18H5L3 8.5Z" />
    </svg>
  )
}

// Petit disque à ta couleur : symbole de « Ma liste »
function MyDisc({ color, size }) {
  return (
    <span
      aria-hidden="true"
      className="vinyl-disc block shrink-0"
      style={{ width: size, height: size, '--disc-label': color }}
    />
  )
}

function Row({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-current={active || undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active ? 'bg-accent/10' : 'hover:bg-raised'
      }`}
    >
      {children}
      {active && <CheckIcon width={16} height={16} className="ml-auto shrink-0 text-accent" />}
    </button>
  )
}

// Sélecteur « où je regarde » : ma liste perso ou un de mes salons,
// + rejoindre / créer un salon. (Le compte, lui, est dans le bouton avatar.)
export function RoomPicker({ me, myCounts, rooms, current, onSelect, onJoin, onCreate, offline }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [newName, setNewName] = useState(null) // null = formulaire de création fermé
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const rootRef = useRef(null)

  // Fermeture au clic en dehors et avec Échap
  useEffect(() => {
    if (!open) return
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    setOpen((o) => !o)
    setError(null)
    setNewName(null)
  }

  function choose(id) {
    onSelect(id)
    setOpen(false)
  }

  async function run(action) {
    setBusy(true)
    setError(null)
    const err = await action()
    setBusy(false)
    if (err) setError(err)
    else {
      setOpen(false)
      setCode('')
      setNewName(null)
    }
  }

  const isRoom = current.kind === 'room'

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-11 items-center gap-2.5 rounded-full border pl-1.5 pr-3.5 text-sm font-medium transition ${
          open ? 'border-ink bg-ink text-accent' : 'border-ink/40 text-ink hover:bg-ink hover:text-accent'
        }`}
      >
        {isRoom ? (
          <RoomCover room={current} size={30} className="rounded-full" />
        ) : (
          <MyDisc color={me.color} size={30} />
        )}
        <span className="max-w-[6.5rem] truncate sm:max-w-[10rem]">{isRoom ? current.name : 'Ma liste'}</span>
        <ChevronIcon width={14} height={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-pop absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-line bg-surface p-2 text-paper shadow-[0_24px_60px_-20px_rgba(27,36,32,0.6)]"
        >
          <Row active={!isRoom} onClick={() => choose('me')}>
            <MyDisc color={me.color} size={34} />
            <span className="min-w-0">
              <span className="block font-display text-base font-bold leading-tight">Ma liste</span>
              <span className="block font-mono text-[11px] text-muted">
                {myCounts.wish} souhait{myCounts.wish > 1 ? 's' : ''} · {myCounts.owned} dans la collection
              </span>
            </span>
          </Row>

          {rooms.length > 0 && (
            <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.15em] text-muted">
              Mes salons
            </p>
          )}
          <div className="nice-scroll max-h-[40vh] overflow-y-auto">
            {rooms.map((r) => (
              <Row key={r.id} active={isRoom && current.id === r.id} onClick={() => choose(r.id)}>
                <RoomCover room={r} size={38} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-display text-base font-bold leading-tight">{r.name}</span>
                    {r.owner_id === me.id && (
                      <span title="Tu es responsable de ce salon" className="shrink-0 text-accent">
                        <CrownIcon />
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted">
                    <AvatarStack members={r.members} size={16} max={5} />
                    {r.members.length} membre{r.members.length > 1 ? 's' : ''}
                  </span>
                </span>
              </Row>
            ))}
          </div>

          <div className="mt-2 border-t border-line px-1 pt-3">
            {newName === null ? (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (code.trim()) run(() => onJoin(code))
                  }}
                >
                  <label htmlFor="room-code" className="px-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted">
                    Rejoindre un salon
                  </label>
                  <div className="mt-2 flex gap-2 px-1">
                    <input
                      id="room-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Code (ex. K7-4QZ)"
                      autoComplete="off"
                      maxLength={10}
                      disabled={offline}
                      className="w-full min-w-0 rounded-xl border border-line bg-ink px-3 py-2 font-mono text-sm uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/70 focus:border-accent"
                    />
                    <button
                      disabled={busy || !code.trim() || offline}
                      className="shrink-0 rounded-full bg-accent px-4 text-sm font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
                    >
                      {busy ? '…' : 'Rejoindre'}
                    </button>
                  </div>
                </form>
                <button
                  onClick={() => {
                    setError(null)
                    setNewName(`Salon de ${me.name}`)
                  }}
                  disabled={offline}
                  className="mb-1 mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-muted transition hover:bg-raised hover:text-paper disabled:opacity-50"
                >
                  <PlusIcon width={16} height={16} /> Créer un salon
                </button>
              </>
            ) : (
              <form
                className="pb-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(() => onCreate(newName))
                }}
              >
                <div className="flex items-center justify-between px-2">
                  <label htmlFor="room-name" className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted">
                    Nouveau salon
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewName(null)}
                    aria-label="Annuler"
                    className="rounded-full p-1 text-muted transition hover:bg-raised hover:text-paper"
                  >
                    <CloseIcon width={14} height={14} />
                  </button>
                </div>
                <div className="mt-2 flex gap-2 px-1">
                  <input
                    id="room-name"
                    autoFocus
                    value={newName}
                    maxLength={40}
                    onChange={(e) => setNewName(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full min-w-0 rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <button
                    disabled={busy || !newName.trim()}
                    className="shrink-0 rounded-full bg-accent px-4 text-sm font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
                  >
                    {busy ? '…' : 'Créer'}
                  </button>
                </div>
                <p className="mt-2 px-2 text-xs text-muted">
                  Tu recevras un code à donner aux personnes à inviter.
                </p>
              </form>
            )}
            {error && <p className="px-2 pb-2 pt-1 text-sm text-red-500">{error}</p>}
            {offline && <p className="px-2 pb-2 text-xs text-muted">Indisponible hors-ligne.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// Encart d'un salon : pochette, nom, membres, code d'invitation,
// « Gérer » pour le responsable et « Quitter » pour tout le monde
export function RoomBar({ room, meId, onCopyInvite, onLeave, onManage }) {
  const isOwner = room.owner_id === meId
  return (
    <div className="animate-pop flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-[0_10px_30px_-18px_rgba(27,36,32,0.4)]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
        <span className="flex min-w-0 items-center gap-3">
          <RoomCover room={room} size={44} />
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-black uppercase leading-none">{room.name}</span>
            <span className="mt-1 block font-mono text-[11px] text-muted">
              {room.members.length} membre{room.members.length > 1 ? 's' : ''}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {room.members.map((m) => (
            <span key={m.id} className="flex items-center gap-2 text-sm">
              <span className="relative">
                <Avatar member={m} size={26} ring={false} />
                {m.id === room.owner_id && (
                  <span
                    title="Responsable du salon"
                    className="keep-day absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sun text-paper ring-2 ring-surface"
                  >
                    <CrownIcon width={10} height={10} />
                  </span>
                )}
              </span>
              <span className="font-medium">{m.id === meId ? `${m.name} (toi)` : m.name}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onCopyInvite}
          aria-label={`Copier le lien d'invitation (code ${room.code})`}
          title="Copier le lien d'invitation"
          className="flex items-center gap-2 rounded-full border border-dashed border-accent/60 px-3 py-1 font-mono text-sm font-medium tracking-wider text-accent transition hover:bg-accent/10"
        >
          {room.code} <CopyIcon width={14} height={14} />
        </button>
        {isOwner && onManage && (
          <button
            onClick={onManage}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-xs font-bold text-ink transition hover:bg-accent-soft"
          >
            <CrownIcon width={12} height={12} /> Gérer
          </button>
        )}
        <button
          onClick={onLeave}
          className="rounded-full px-2.5 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-500"
        >
          Quitter
        </button>
      </div>
    </div>
  )
}
