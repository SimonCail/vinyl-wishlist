import { useState } from 'react'

function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const secondaryBtn =
  'flex-1 rounded-full border border-line py-2.5 font-medium transition hover:bg-raised'

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <div className="mt-6 flex gap-2">
        <button onClick={onClose} className={secondaryBtn}>
          Annuler
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-full bg-red-500 py-2.5 font-bold text-white transition hover:bg-red-400"
        >
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  )
}

export function NoteDialog({ vinyl, onConfirm, onClose }) {
  const [note, setNote] = useState(vinyl.note || '')

  function submit(e) {
    e.preventDefault()
    onConfirm(note.trim())
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="font-display text-xl font-bold">Une précision ?</h3>
        <p className="mt-1 truncate text-sm text-muted">
          {vinyl.title} · {vinyl.artist}
        </p>
        <textarea
          autoFocus
          rows={3}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. : pressage colorée si possible"
          className="mt-4 w-full resize-none rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Annuler
          </button>
          <button
            type="submit"
            className="flex-1 rounded-full bg-accent py-2.5 font-bold text-ink transition hover:bg-accent-soft"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </Overlay>
  )
}

export function NameDialog({ item, onConfirm, onClose }) {
  const [name, setName] = useState('')

  function submit(e) {
    e.preventDefault()
    if (name.trim()) onConfirm(name.trim())
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="font-display text-xl font-bold">Comment tu t'appelles ?</h3>
        <p className="mt-2 text-sm text-muted">
          Ton prénom apparaîtra sur les disques que tu ajoutes, pour savoir
          qui a eu l'idée. On ne te le redemandera plus.
        </p>
        <p className="mt-1 truncate text-xs text-muted/70">
          Pour ajouter : {item.title}
        </p>
        <input
          autoFocus
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ton prénom"
          className="mt-4 w-full rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Annuler
          </button>
          <button
            type="submit"
            className="flex-1 rounded-full bg-accent py-2.5 font-bold text-ink transition hover:bg-accent-soft"
          >
            Ajouter le disque
          </button>
        </div>
      </form>
    </Overlay>
  )
}
export function LoginDialog({ onSubmit, onClose }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!code) return
    setBusy(true)
    setError(null)
    const err = await onSubmit(code)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="font-display text-xl font-bold">Entrer le code</h3>
        <p className="mt-2 text-sm text-muted">
          Le code partagé permet d'ajouter, modifier et retirer des disques.
          On ne te le redemandera pas sur cet appareil.
        </p>
        <input
          autoFocus
          type="password"
          autoComplete="current-password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code d'accès"
          className="mt-4 w-full rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy || !code}
            className="flex-1 rounded-full bg-accent py-2.5 font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? '…' : 'Valider'}
          </button>
        </div>
      </form>
    </Overlay>
  )
}