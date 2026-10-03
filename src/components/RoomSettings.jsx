import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { RoomCover, CrownIcon, ROOM_COLORS, roomColor } from './Rooms'
import { CloseIcon, CheckIcon, CopyIcon } from './Icons'
import PhotoCropper from './PhotoCropper'

const field =
  'w-full rounded-2xl border border-line bg-ink px-4 py-3 text-paper outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60'
const primaryBtn =
  'rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50'
const ghostBtn =
  'rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-accent hover:bg-raised disabled:opacity-50'

const DISCOGS_IMAGE = /^https:\/\/i\.discogs\.com\//
const norm = (t = '') => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </svg>
)

function Section({ title, children, aside }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

// Fenêtre « Gérer le salon », réservée au responsable :
// nom, couleur, pochette, code d'invitation, membres, suppression.
// actions : { update, uploadCover, regenerateCode, removeMember, transfer, remove } (voir useRooms),
// chacune renvoie { error? }. covers : pochettes des disques des membres du salon.
export default function RoomSettings({ room, meId, covers = [], actions, onCopyInvite, onClose, onToast, offline }) {
  const [name, setName] = useState(room.name)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(null) // ce qui est en cours d'enregistrement
  const [error, setError] = useState(null)
  const [photoFile, setPhotoFile] = useState(null) // photo de la galerie en cours de recadrage
  const [confirm, setConfirm] = useState(null) // { kind: 'code' | 'remove' | 'transfer' | 'delete', member? }
  const [deleteWord, setDeleteWord] = useState('')

  // Le nom affiché suit les changements venus d'ailleurs, sauf pendant la saisie
  useEffect(() => setName(room.name), [room.name])

  // Fermeture avec Échap (sauf pendant un enregistrement)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || busy) return
      if (photoFile) setPhotoFile(null) // Échap ferme d'abord le recadrage
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose, photoFile])

  const coverChoices = useMemo(() => {
    const q = norm(filter.trim())
    return covers
      .filter((c) => c.cover_url && DISCOGS_IMAGE.test(c.cover_url))
      .filter((c) => !q || norm(`${c.title} ${c.artist}`).includes(q))
      .slice(0, 60)
  }, [covers, filter])

  const isPhoto = room.cover_url?.includes('/room-covers/')
  function pickPhoto(e) {
    const f = e.target.files?.[0]
    e.target.value = '' // pour pouvoir rechoisir la même photo
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Choisis une image.')
    if (f.size > 25 * 1024 * 1024) return setError('Photo trop lourde (25 Mo max).')
    setError(null)
    setPhotoFile(f)
  }
  async function sendPhoto(blob) {
    if (await run('photo', () => actions.uploadCover(room.id, blob), 'Photo du salon mise à jour')) setPhotoFile(null)
  }

  async function run(key, action, success) {
    setBusy(key)
    setError(null)
    const res = await action()
    setBusy(null)
    if (res?.error) {
      setError(res.error)
      return false
    }
    if (success) onToast(typeof success === 'function' ? success(res) : success)
    return true
  }

  const nameDirty = name.trim() && name.trim() !== room.name
  const saveName = (e) => {
    e.preventDefault()
    if (!nameDirty) return
    run('name', () => actions.update(room.id, { name: name.trim() }), 'Salon renommé')
  }

  const others = room.members.filter((m) => m.id !== meId)
  const disabled = offline || !!busy

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gérer le salon"
        className="animate-pop nice-scroll max-h-[94vh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-ink shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : pochette du salon sur un vinyle à sa couleur */}
        <header className="relative overflow-hidden bg-accent px-6 pb-7 pt-5 text-ink sm:px-8">
          <div
            aria-hidden="true"
            className="vinyl-disc animate-disc pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 opacity-40 sm:opacity-100"
            style={{ '--disc-label': roomColor(room) }}
          />
          <div className="relative flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
              <CrownIcon width={12} height={12} /> Gérer le salon
            </span>
            <button
              onClick={onClose}
              disabled={!!busy}
              aria-label="Fermer"
              className="rounded-full p-1.5 text-ink/80 transition hover:bg-ink/15 hover:text-ink"
            >
              <CloseIcon width={20} height={20} />
            </button>
          </div>
          <div className="relative mt-6 flex items-end gap-5">
            {/* Clic sur la pochette (ou l'appareil photo) : choisir une photo, comme pour le profil */}
            <label
              title="Changer la photo du salon"
              className={`group relative shrink-0 ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
            >
              <input
                type="file"
                accept="image/*"
                onChange={pickPhoto}
                disabled={disabled}
                aria-label="Changer la photo du salon"
                className="sr-only"
              />
              <RoomCover
                room={room}
                size={104}
                className="rounded-2xl ring-4 ring-ink shadow-xl shadow-black/30 transition group-hover:brightness-90"
              />
              <span className="keep-day absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper shadow-lg ring-4 ring-accent transition group-hover:scale-110">
                {busy === 'photo' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
                ) : (
                  <CameraIcon />
                )}
              </span>
            </label>
            <div className="min-w-0 pb-1">
              <h2 className="font-display break-words text-4xl font-black uppercase leading-[0.88] sm:text-5xl">{room.name}</h2>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/75">
                {room.members.length} membre{room.members.length > 1 ? 's' : ''} · code {room.code}
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          {offline && (
            <p className="rounded-2xl bg-raised px-4 py-3 text-sm text-muted">
              Hors-ligne : les réglages du salon sont désactivés.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Nom + couleur */}
          <Section title="Le salon">
            <form onSubmit={saveName}>
              <label className="block text-xs font-medium text-muted">
                Nom
                <div className="mt-1.5 flex gap-2">
                  <input
                    className={field}
                    value={name}
                    maxLength={40}
                    disabled={offline}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button disabled={!nameDirty || disabled} className={`${primaryBtn} shrink-0`}>
                    {busy === 'name' ? '…' : 'Renommer'}
                  </button>
                </div>
              </label>
            </form>

            <fieldset className="mt-5">
              <legend className="text-xs font-medium text-muted">Couleur</legend>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {ROOM_COLORS.map((c) => {
                  const active = roomColor(room) === c && !!room.color
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => run('color', () => actions.update(room.id, { color: c }), 'Couleur enregistrée')}
                      disabled={disabled}
                      aria-label={`Couleur ${c}`}
                      aria-pressed={active}
                      className={`keep-day flex h-9 w-9 items-center justify-center rounded-full text-paper transition hover:scale-110 disabled:opacity-60 ${
                        active ? 'ring-2 ring-paper ring-offset-2 ring-offset-surface' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {active && <CheckIcon width={16} height={16} />}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                Elle colore la pochette du salon quand il n’a pas d’image, et l’étiquette du disque en haut de la page.
              </p>
            </fieldset>
          </Section>

          {/* Pochette */}
          <Section
            title="Pochette"
            aside={
              room.cover_url && (
                <button
                  onClick={() => run('cover', () => actions.update(room.id, { cover_url: null }), 'Pochette retirée')}
                  disabled={disabled}
                  className="text-xs font-medium text-muted underline-offset-4 hover:text-paper hover:underline"
                >
                  Retirer l’image
                </button>
              )
            }
          >
            {covers.length === 0 ? (
              <p className="text-sm text-muted">
                Touche la pochette en haut pour mettre une photo, ou ajoutez des disques au salon :
                leurs pochettes pourront aussi servir d’image.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-muted">
                    Choisis parmi les disques du salon, ou touche la pochette en haut pour une photo
                  </p>
                  {covers.length > 12 && (
                    <input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Filtrer…"
                      aria-label="Filtrer les pochettes"
                      className="w-36 rounded-full border border-line bg-ink px-3 py-1 text-sm outline-none focus:border-accent"
                    />
                  )}
                </div>
                <ul className="nice-scroll mt-2 grid max-h-56 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
                  {coverChoices.map((c) => {
                    const active = room.cover_url === c.cover_url
                    return (
                      <li key={c.key}>
                        <button
                          onClick={() =>
                            run(c.key, () => actions.update(room.id, { cover_url: c.cover_url }), `Pochette : ${c.title}`)
                          }
                          disabled={disabled}
                          aria-pressed={active}
                          aria-label={`${c.title} — ${c.artist}`}
                          title={`${c.title} — ${c.artist}`}
                          className={`relative block aspect-square w-full overflow-hidden rounded-md transition hover:scale-105 disabled:cursor-wait ${
                            active ? 'ring-4 ring-accent ring-offset-2 ring-offset-surface' : 'ring-1 ring-black/10'
                          } ${busy === c.key ? 'animate-shimmer' : ''}`}
                        >
                          <img src={c.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          {active && (
                            <span className="absolute inset-0 flex items-center justify-center bg-accent/50 text-ink">
                              <CheckIcon width={20} height={20} />
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                  {coverChoices.length === 0 && (
                    <li className="col-span-full py-4 text-center text-sm text-muted">Aucune pochette ne correspond.</li>
                  )}
                </ul>
              </>
            )}
          </Section>

          {/* Code d'invitation */}
          <Section title="Invitation">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-dashed border-accent/60 px-3.5 py-1.5 font-mono text-sm font-medium tracking-wider text-accent">
                {room.code}
              </span>
              <button onClick={onCopyInvite} className={`${ghostBtn} flex items-center gap-1.5`}>
                <CopyIcon width={14} height={14} /> Copier le lien
              </button>
              {confirm?.kind !== 'code' && (
                <button onClick={() => setConfirm({ kind: 'code' })} disabled={disabled} className={ghostBtn}>
                  Changer le code
                </button>
              )}
            </div>
            {confirm?.kind === 'code' && (
              <div className="animate-pop mt-4 rounded-2xl bg-raised p-4">
                <p className="text-sm">
                  L’ancien code et les anciens liens d’invitation ne marcheront plus.
                  Les membres actuels restent dans le salon.
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setConfirm(null)} className={ghostBtn}>Annuler</button>
                  <button
                    onClick={async () => {
                      if (await run('code', () => actions.regenerateCode(room.id), (r) => `Nouveau code : ${r.code}`)) {
                        setConfirm(null)
                      }
                    }}
                    disabled={disabled}
                    className={primaryBtn}
                  >
                    {busy === 'code' ? '…' : 'Générer un nouveau code'}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Membres */}
          <Section title="Membres" aside={<span className="font-mono text-xs text-muted">{room.members.length}</span>}>
            <ul className="-my-1 divide-y divide-line">
              {room.members.map((m) => {
                const isOwner = m.id === room.owner_id
                const open = confirm?.member?.id === m.id
                return (
                  <li key={m.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar member={m} size={34} ring={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {m.name}
                          {m.id === meId && <span className="text-muted"> (toi)</span>}
                        </p>
                        {isOwner && (
                          <span className="keep-day mt-0.5 inline-flex items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-[11px] font-bold text-paper">
                            <CrownIcon width={10} height={10} /> Responsable
                          </span>
                        )}
                      </div>
                      {m.id !== meId && !open && (
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          <button
                            onClick={() => setConfirm({ kind: 'transfer', member: m })}
                            disabled={disabled}
                            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-raised hover:text-paper disabled:opacity-50"
                          >
                            Passer la main
                          </button>
                          <button
                            onClick={() => setConfirm({ kind: 'remove', member: m })}
                            disabled={disabled}
                            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                          >
                            Retirer
                          </button>
                        </div>
                      )}
                    </div>
                    {open && (
                      <div className="animate-pop mt-3 rounded-2xl bg-raised p-4">
                        <p className="text-sm">
                          {confirm.kind === 'remove'
                            ? `${m.name} ne verra plus les disques du salon. Sa liste perso ne change pas. Pour revenir, il lui faudra le code.`
                            : `${m.name} devient responsable du salon. Tu restes membre, mais tu ne pourras plus le gérer.`}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => setConfirm(null)} className={ghostBtn}>Annuler</button>
                          <button
                            onClick={async () => {
                              const ok =
                                confirm.kind === 'remove'
                                  ? await run('member', () => actions.removeMember(room.id, m.id), `${m.name} a été retiré du salon`)
                                  : await run('member', () => actions.transfer(room.id, m.id), `${m.name} est maintenant responsable`)
                              if (ok) {
                                setConfirm(null)
                                if (confirm.kind === 'transfer') onClose()
                              }
                            }}
                            disabled={disabled}
                            className={
                              confirm.kind === 'remove'
                                ? 'rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-50'
                                : primaryBtn
                            }
                          >
                            {busy === 'member' ? '…' : confirm.kind === 'remove' ? `Retirer ${m.name}` : `Confier à ${m.name}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {others.length === 0 && (
              <p className="mt-3 text-sm text-muted">Tu es seul·e pour l’instant : partage le code pour inviter tes proches.</p>
            )}
          </Section>

          {/* Suppression */}
          <div className="px-1 pb-2 pt-1">
            {confirm?.kind !== 'delete' ? (
              <button
                onClick={() => {
                  setDeleteWord('')
                  setConfirm({ kind: 'delete' })
                }}
                disabled={offline}
                className="text-left text-sm text-muted underline-offset-4 hover:text-red-600 hover:underline"
              >
                Supprimer le salon
              </button>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (await run('delete', () => actions.remove(room.id), `« ${room.name} » a été supprimé`)) onClose()
                }}
                className="animate-pop rounded-2xl border border-red-500/40 bg-red-500/5 p-5"
              >
                <p className="font-display text-xl font-black uppercase leading-tight">Supprimer « {room.name} » ?</p>
                <p className="mt-2 text-sm text-muted">
                  Le salon disparaît pour tout le monde. Les souhaits et collections de chacun ne bougent pas.
                </p>
                <label className="mt-4 block text-xs font-medium text-muted">
                  Tape <span className="font-mono font-bold text-paper">SUPPRIMER</span> pour confirmer
                  <input className={`${field} mt-1.5`} value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} autoComplete="off" />
                </label>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setConfirm(null)} className={ghostBtn}>Annuler</button>
                  <button
                    disabled={disabled || deleteWord.trim().toUpperCase() !== 'SUPPRIMER'}
                    className="rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
                  >
                    {busy === 'delete' ? '…' : 'Supprimer le salon'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Recadrage de la photo choisie, par-dessus la fenêtre */}
      {photoFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            e.stopPropagation()
            if (busy !== 'photo') setPhotoFile(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Recadrer la photo du salon"
            className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-display text-2xl font-black uppercase">Photo du salon</h3>
            <PhotoCropper
              file={photoFile}
              busy={busy === 'photo'}
              onConfirm={sendPhoto}
              onCancel={() => setPhotoFile(null)}
            />
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
