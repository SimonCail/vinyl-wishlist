import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import AvatarCropper from './AvatarCropper'
import ArtistAvatarPicker from './ArtistAvatarPicker'
import SpinningDisc from './SpinningDisc'
import { ThemeSettings } from './ThemePicker'
import { CloseIcon, CheckIcon } from './Icons'
import { loadPhoto, exportAvatar } from '../lib/avatar'

// Couleurs proposées pour l'avatar (celles du site)
const COLORS = ['#ec5b3e', '#e58a4e', '#f1c04e', '#b9cf5a', '#6fbf98', '#6aa6d6', '#f09aaa']

const field =
  'mt-1.5 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-paper outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60'
const primaryBtn =
  'rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50'
const ghostBtn =
  'rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-accent hover:bg-raised disabled:opacity-50'

function CameraIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

const DISCOGS_IMAGE = /^https:\/\/i\.discogs\.com\//
const norm = (t = '') => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Choix du disque qui tourne sur la platine en haut de la page
function TurntableSettings({ value, myDiscs, onChange, offline }) {
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(null) // clé en cours d'enregistrement
  const [error, setError] = useState(null)
  const mode = value?.mode ?? 'classic'

  const discs = useMemo(() => {
    const q = norm(filter.trim())
    return myDiscs
      .filter((d) => d.cover_url && DISCOGS_IMAGE.test(d.cover_url))
      .filter((d) => !q || norm(`${d.title} ${d.artist}`).includes(q))
      .slice(0, 60)
  }, [myDiscs, filter])

  async function choose(next, key) {
    setBusy(key)
    setError(null)
    const err = await onChange(next)
    setBusy(null)
    if (err) setError(err)
  }

  const preview =
    mode === 'disc' ? value.cover_url : mode === 'random' ? myDiscs.find((d) => d.cover_url)?.cover_url : null
  const label =
    mode === 'disc' ? `${value.title}${value.artist ? ` — ${value.artist}` : ''}`
    : mode === 'random' ? 'Un disque de ta collection, différent à chaque visite'
    : 'L’étiquette corail d’origine'

  const option = (active) =>
    `rounded-full border px-3.5 py-1.5 text-sm transition disabled:opacity-50 ${
      active ? 'border-accent bg-accent font-bold text-ink' : 'border-line text-muted hover:border-accent hover:text-paper'
    }`

  return (
    <div>
      <div className="flex items-center gap-4">
        <SpinningDisc cover={preview} className="h-20 w-20 shrink-0" spin="animate-slow-spin" />
        <div className="min-w-0">
          <p className="font-display text-lg font-black uppercase leading-tight">
            {mode === 'disc' ? 'Ton disque' : mode === 'random' ? 'Au hasard' : 'Classique'}
          </p>
          <p className="truncate text-sm text-muted">{label}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Disque de la platine">
        <button role="radio" aria-checked={mode === 'classic'} disabled={offline || !!busy} onClick={() => choose(null, 'classic')} className={option(mode === 'classic')}>
          Classique
        </button>
        <button role="radio" aria-checked={mode === 'random'} disabled={offline || !!busy || !myDiscs.some((d) => d.cover_url)} onClick={() => choose({ mode: 'random' }, 'random')} className={option(mode === 'random')}>
          Au hasard
        </button>
      </div>

      {myDiscs.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted">Ou choisis un de tes disques</p>
            {myDiscs.length > 12 && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrer…"
                aria-label="Filtrer mes disques"
                className="w-36 rounded-full border border-line bg-ink px-3 py-1 text-sm outline-none focus:border-accent"
              />
            )}
          </div>
          <ul className="nice-scroll mt-2 grid max-h-56 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
            {discs.map((d) => {
              const active = mode === 'disc' && value.key === d.key
              return (
                <li key={d.key}>
                  <button
                    onClick={() =>
                      choose({ mode: 'disc', key: d.key, cover_url: d.cover_url, title: d.title.slice(0, 200), artist: (d.artist || '').slice(0, 200) }, d.key)
                    }
                    disabled={offline || !!busy}
                    aria-pressed={active}
                    aria-label={`${d.title} — ${d.artist}`}
                    title={`${d.title} — ${d.artist}`}
                    className={`relative block aspect-square w-full overflow-hidden rounded-md transition hover:scale-105 disabled:cursor-wait ${
                      active ? 'ring-4 ring-accent ring-offset-2 ring-offset-surface' : 'ring-1 ring-black/10'
                    } ${busy === d.key ? 'animate-shimmer' : ''}`}
                  >
                    <img src={d.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center bg-accent/50 text-ink">
                        <CheckIcon width={20} height={20} />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
            {discs.length === 0 && <li className="col-span-full py-4 text-center text-sm text-muted">Aucun disque avec pochette ne correspond.</li>}
          </ul>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}

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

// Petit formulaire qui s'ouvre sur place (email, mot de passe)
function Expandable({ label, value, open, onToggle, children }) {
  return (
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="truncate text-sm text-muted">{value}</p>
        </div>
        <button onClick={onToggle} className="shrink-0 text-sm font-medium text-accent hover:underline">
          {open ? 'Annuler' : 'Modifier'}
        </button>
      </div>
      {open && <div className="animate-pop mt-3">{children}</div>}
    </div>
  )
}

export default function ProfilePanel({
  me, email, myCounts, rooms, myArtists, myDiscs = [], offline, onSetTurntable,
  onSaveProfile, onSetPhoto, onSetArtist, onRemovePhoto, onChangeEmail, onChangePassword,
  onLogout, onImport, onDeleteAccount, onClose, onToast,
}) {
  const [name, setName] = useState(me.name)
  const [color, setColor] = useState(me.color)
  const [saving, setSaving] = useState(false)
  const [profileError, setProfileError] = useState(null)

  const [photo, setPhoto] = useState(null) // photo choisie, en cours de recadrage
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const fileRef = useRef(null)
  const [artistOpen, setArtistOpen] = useState(false)
  const [artistBusy, setArtistBusy] = useState(false)
  const [artistError, setArtistError] = useState(null)

  const [open, setOpen] = useState(null) // 'email' | 'password' | 'delete'
  const [newEmail, setNewEmail] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const [formInfo, setFormInfo] = useState(null)
  const [deleteWord, setDeleteWord] = useState('')

  // Fermeture avec Échap (sauf pendant un envoi)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !photo && !artistOpen && !photoBusy && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, photo, artistOpen, photoBusy, busy])

  // Libère l'aperçu local quand il n'est plus utile
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo])

  function toggle(section) {
    setOpen((o) => (o === section ? null : section))
    setFormError(null)
    setFormInfo(null)
    setCurrentPw('')
    setNewPw('')
    setNewEmail('')
    setDeleteWord('')
  }

  // --- Photo ---
  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // pour pouvoir rechoisir la même photo
    if (!file) return
    setPhotoError(null)
    try {
      setPhoto(await loadPhoto(file))
    } catch (err) {
      setPhotoError(err.message)
    }
  }

  // Cadrage validé dans l'éditeur : on produit la photo finale puis on l'envoie
  async function confirmPhoto(view) {
    setPhotoBusy(true)
    setPhotoError(null)
    let err
    try {
      err = await onSetPhoto(await exportAvatar(photo, view))
    } catch (e) {
      err = e.message
    }
    setPhotoBusy(false)
    if (err) setPhotoError(err)
    else {
      setPhoto(null)
      onToast('Nouvelle photo enregistrée')
    }
  }

  function cancelPhoto() {
    setPhoto(null)
    setPhotoError(null)
  }

  // Avatar d'artiste choisi dans la grille
  async function confirmArtist(choice) {
    setArtistBusy(true)
    setArtistError(null)
    const err = await onSetArtist(choice)
    setArtistBusy(false)
    if (err) setArtistError(err)
    else {
      setArtistOpen(false)
      onToast(`Avatar : ${choice.label}`)
    }
  }

  async function removePhoto() {
    setPhotoBusy(true)
    const err = await onRemovePhoto()
    setPhotoBusy(false)
    if (err) setPhotoError(err)
    else onToast('Avatar retiré')
  }

  // --- Prénom & couleur ---
  const dirty = name.trim() !== me.name || color !== me.color
  async function saveProfile(e) {
    e.preventDefault()
    if (!name.trim()) return setProfileError('Ton prénom ne peut pas être vide.')
    setSaving(true)
    setProfileError(null)
    const err = await onSaveProfile({ name: name.trim(), color })
    setSaving(false)
    if (err) setProfileError(err)
    else onToast('Profil enregistré')
  }

  // --- Email / mot de passe / suppression ---
  async function run(action) {
    setBusy(true)
    setFormError(null)
    setFormInfo(null)
    await action()
    setBusy(false)
  }

  const submitEmail = (e) => {
    e.preventDefault()
    run(async () => {
      const res = await onChangeEmail(newEmail)
      if (res.error) setFormError(res.error)
      else setFormInfo(res.info)
    })
  }

  const submitPassword = (e) => {
    e.preventDefault()
    run(async () => {
      const err = await onChangePassword(currentPw, newPw)
      if (err) setFormError(err)
      else {
        toggle('password')
        onToast('Mot de passe modifié')
      }
    })
  }

  const submitDelete = (e) => {
    e.preventDefault()
    run(async () => {
      const err = await onDeleteAccount()
      if (err) setFormError(err)
    })
  }

  // Ce qu'on affiche dans le grand avatar : l'aperçu en attente, sinon le profil
  const shown = {
    ...me,
    name: name.trim() || me.name,
    color,
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => !photo && !artistOpen && !photoBusy && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mon profil"
        className="animate-pop nice-scroll max-h-[94vh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-ink shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : grande pochette verte avec le disque à ta couleur */}
        <header className="relative overflow-hidden bg-accent px-6 pb-7 pt-5 text-ink sm:px-8">
          <div
            aria-hidden="true"
            className="vinyl-disc animate-disc pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 opacity-40 sm:opacity-100"
            style={{ '--disc-label': color }}
          />
          <div className="relative flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink/70">Mon profil</span>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-full p-1.5 text-ink/80 transition hover:bg-ink/15 hover:text-ink"
            >
              <CloseIcon width={20} height={20} />
            </button>
          </div>

          <div className="relative mt-6 flex flex-col items-start gap-5 sm:flex-row sm:items-end">
            <div className="relative shrink-0">
              {/* Toute la photo est cliquable pour en choisir une nouvelle */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={offline || photoBusy}
                aria-label="Changer la photo"
                title="Changer la photo"
                className="group relative block rounded-full transition hover:scale-[1.03] disabled:opacity-60"
              >
                <Avatar
                  member={shown}
                  size={136}
                  ring={false}
                  className="block ring-4 ring-ink shadow-xl shadow-black/30"
                />
                <span className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-sun text-paper shadow-lg ring-4 ring-accent transition group-hover:scale-110">
                  <CameraIcon />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickPhoto}
                aria-label="Choisir une photo dans la galerie"
              />
            </div>

            <div className="min-w-0 pb-1">
              <h2 className="font-display break-words text-5xl font-black uppercase leading-[0.85] sm:text-6xl">
                {name.trim() || me.name}
              </h2>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/75">
                {myCounts.wish} souhait{myCounts.wish > 1 ? 's' : ''} · {myCounts.owned} en collection ·{' '}
                {rooms.length} salon{rooms.length > 1 ? 's' : ''}
              </p>
              {me.avatar_label && (
                <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/75">
                  Avatar · {me.avatar_label}
                </p>
              )}
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <button
                onClick={() => {
                  setArtistError(null)
                  setArtistOpen(true)
                }}
                disabled={offline || photoBusy}
                className="font-medium underline-offset-4 hover:underline disabled:opacity-60"
              >
                {me.avatar_url ? 'Changer d’artiste' : 'Choisir un artiste'}
              </button>
              {(me.avatar_path || me.avatar_url) && (
                <button
                  onClick={removePhoto}
                  disabled={offline || photoBusy}
                  className="text-ink/70 underline-offset-4 hover:text-ink hover:underline disabled:opacity-60"
                >
                  {photoBusy ? '…' : me.avatar_url ? 'Retirer l’artiste' : 'Retirer la photo'}
                </button>
              )}
            </div>
          {photoError && !photo && (
            <p className="relative mt-3 rounded-xl bg-ink px-3 py-2 text-sm text-red-600">{photoError}</p>
          )}
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          {offline && (
            <p className="rounded-2xl bg-raised px-4 py-3 text-sm text-muted">
              Hors-ligne : les modifications du profil sont désactivées.
            </p>
          )}

          {/* Prénom + couleur */}
          <Section title="Ton profil">
            <form onSubmit={saveProfile}>
              <label className="block text-xs font-medium text-muted">
                Prénom
                <input
                  className={field}
                  value={name}
                  maxLength={30}
                  disabled={offline}
                  autoComplete="given-name"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <fieldset className="mt-4">
                <legend className="text-xs font-medium text-muted">Ta couleur</legend>
                <div className="mt-2 flex flex-wrap gap-2.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      disabled={offline}
                      aria-label={`Couleur ${c}`}
                      aria-pressed={color === c}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-paper transition hover:scale-110 ${
                        color === c ? 'ring-2 ring-paper ring-offset-2 ring-offset-surface' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <CheckIcon width={16} height={16} />}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Elle te repère dans les salons, et remplace la photo si tu n'en as pas.
                </p>
              </fieldset>

              {profileError && <p className="mt-3 text-sm text-red-600">{profileError}</p>}
              <div className="mt-5 flex items-center gap-3">
                <button disabled={!dirty || saving || offline} className={primaryBtn}>
                  {saving ? '…' : 'Enregistrer'}
                </button>
                {dirty && !saving && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(me.name)
                      setColor(me.color)
                    }}
                    className="text-sm text-muted hover:text-paper"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </Section>

          {/* Platine */}
          <Section title="Sur la platine">
            <TurntableSettings
              value={me.turntable}
              myDiscs={myDiscs}
              onChange={async (next) => {
                const err = await onSetTurntable(next)
                if (!err) onToast(next?.mode === 'disc' ? `Sur la platine : ${next.title}` : next?.mode === 'random' ? 'Platine : au hasard' : 'Platine : classique')
                return err
              }}
              offline={offline}
            />
          </Section>

          {/* Jour / nuit */}
          <Section title="Apparence">
            <ThemeSettings />
          </Section>

          {/* Import */}
          <Section title="Discogs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm text-muted">
                Ramène ta collection et ta wantlist Discogs dans ta liste, en une fois.
              </p>
              <button onClick={onImport} disabled={offline} className={primaryBtn}>
                Importer
              </button>
            </div>
          </Section>

          {/* Connexion */}
          <Section title="Connexion">
            <Expandable label="Email" value={email} open={open === 'email'} onToggle={() => toggle('email')}>
              {formInfo ? (
                <p className="rounded-2xl bg-accent/10 p-4 text-sm leading-relaxed text-accent">{formInfo}</p>
              ) : (
                <form onSubmit={submitEmail} className="space-y-3">
                  <label className="block text-xs font-medium text-muted">
                    Nouvel email
                    <input type="email" autoComplete="email" className={field} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="toi@exemple.fr" disabled={offline} />
                  </label>
                  {formError && <p className="text-sm text-red-600">{formError}</p>}
                  <button disabled={busy || !newEmail.trim() || offline} className={primaryBtn}>
                    {busy ? '…' : 'Recevoir le lien de confirmation'}
                  </button>
                </form>
              )}
            </Expandable>

            <Expandable label="Mot de passe" value="••••••••" open={open === 'password'} onToggle={() => toggle('password')}>
              <form onSubmit={submitPassword} className="space-y-3">
                <label className="block text-xs font-medium text-muted">
                  Mot de passe actuel
                  <input type="password" autoComplete="current-password" className={field} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} disabled={offline} />
                </label>
                <label className="block text-xs font-medium text-muted">
                  Nouveau mot de passe
                  <input type="password" autoComplete="new-password" minLength={6} className={field} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="6 caractères minimum" disabled={offline} />
                </label>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <button disabled={busy || !currentPw || newPw.length < 6 || offline} className={primaryBtn}>
                  {busy ? '…' : 'Changer le mot de passe'}
                </button>
              </form>
            </Expandable>
          </Section>

          {/* Sortie */}
          <div className="flex flex-col gap-3 px-1 pb-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={onLogout} className={ghostBtn}>
              Se déconnecter
            </button>
            {open !== 'delete' && (
              <button onClick={() => toggle('delete')} className="text-left text-sm text-muted underline-offset-4 hover:text-red-600 hover:underline">
                Supprimer mon compte
              </button>
            )}
          </div>

          {open === 'delete' && (
            <form onSubmit={submitDelete} className="animate-pop rounded-2xl border border-red-500/40 bg-red-500/5 p-5">
              <p className="font-display text-xl font-black uppercase leading-tight">Supprimer ton compte ?</p>
              <p className="mt-2 text-sm text-muted">
                Tes souhaits, ta collection, ta photo et ta place dans tes salons seront effacés
                définitivement. Les autres membres gardent leurs listes.
              </p>
              <label className="mt-4 block text-xs font-medium text-muted">
                Tape <span className="font-mono font-bold text-paper">SUPPRIMER</span> pour confirmer
                <input className={field} value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} autoComplete="off" disabled={offline} />
              </label>
              {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => toggle('delete')} className={ghostBtn}>
                  Annuler
                </button>
                <button
                  disabled={busy || deleteWord.trim().toUpperCase() !== 'SUPPRIMER' || offline}
                  className="rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
                >
                  {busy ? '…' : 'Supprimer définitivement'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {artistOpen && (
        <ArtistAvatarPicker
          myArtists={myArtists}
          currentUrl={me.avatar_url}
          busy={artistBusy}
          error={artistError}
          onConfirm={confirmArtist}
          onCancel={() => setArtistOpen(false)}
        />
      )}
      {photo && (
        <AvatarCropper
          photo={photo}
          busy={photoBusy}
          error={photoError}
          onConfirm={confirmPhoto}
          onCancel={cancelPhoto}
        />
      )}
    </div>
  )
}
