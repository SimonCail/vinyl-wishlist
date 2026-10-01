import { useState } from 'react'
import { AvatarStack } from './Avatar'
import { CloseIcon } from './Icons'

const field =
  'mt-1.5 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-paper outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15'

const TITLES = {
  login: ['Re-bonjour.', 'Connecte-toi pour retrouver tes disques et tes salons.'],
  signup: ['Ton bac à toi.', 'Tes souhaits et ta collection te suivent dans tous les salons que tu rejoins.'],
  forgot: ['Mot de passe oublié.', 'Indique ton email : tu recevras un lien pour en choisir un nouveau.'],
  recovery: ['Nouveau mot de passe.', 'Choisis ton nouveau mot de passe (6 caractères minimum).'],
}

// Connexion, création de compte, mot de passe oublié / nouveau mot de passe.
// invite : { name, members } quand on arrive par le lien d'un salon
export default function AuthDialog({
  initialMode = 'login', invite, onSignIn, onSignUp, onReset, onUpdatePassword, onClose,
}) {
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  function switchTo(m) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    let err = null
    if (mode === 'login') {
      err = await onSignIn(email.trim(), password)
    } else if (mode === 'signup') {
      const res = await onSignUp({ name: name.trim(), email: email.trim(), password })
      err = res.error
      if (!err && res.needsConfirmation) {
        setInfo(`Presque fini ! Clique sur le lien envoyé à ${email.trim()} pour activer ton compte${invite ? ' et rejoindre le salon' : ''}.`)
      }
    } else if (mode === 'forgot') {
      err = await onReset(email.trim())
      if (!err) setInfo(`Si un compte existe pour ${email.trim()}, un lien vient de lui être envoyé.`)
    } else if (mode === 'recovery') {
      err = await onUpdatePassword(password)
    }
    setBusy(false)
    if (err) setError(err)
  }

  const [title, subtitle] = TITLES[mode]
  const tabs = mode === 'login' || mode === 'signup'
  const submitLabel = {
    login: 'Se connecter',
    signup: invite ? 'Créer et rejoindre le salon' : 'Créer mon compte',
    forgot: 'Envoyer le lien',
    recovery: 'Enregistrer',
  }[mode]
  const canSubmit =
    !busy &&
    (mode === 'recovery'
      ? password.length >= 6
      : email.trim() && (mode === 'forgot' || password) && (mode !== 'signup' || name.trim()))

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop nice-scroll max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-line bg-surface shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {invite && mode !== 'recovery' && (
          <div className="flex items-center gap-3 bg-accent px-6 py-4 text-ink">
            <AvatarStack members={invite.members} size={30} />
            <p className="text-sm leading-snug">
              <span className="font-bold">{invite.members[0]?.name}</span> t'invite dans
              le salon <span className="font-bold">« {invite.name} »</span>
            </p>
          </div>
        )}

        <div className="relative p-6">
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition hover:bg-raised hover:text-paper"
            >
              <CloseIcon width={18} height={18} />
            </button>
          )}

          {tabs && (
            <div role="tablist" className="mb-5 mr-8 flex rounded-full bg-raised p-1 text-sm">
              {[
                ['login', 'Connexion'],
                ['signup', 'Créer un compte'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={mode === v}
                  onClick={() => switchTo(v)}
                  className={`flex-1 rounded-full py-2 font-medium transition ${
                    mode === v ? 'bg-surface font-bold text-paper shadow' : 'text-muted hover:text-paper'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          <h3 className="font-display text-3xl font-black uppercase leading-[0.9]">{title}</h3>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>

          {info ? (
            <p className="mt-5 rounded-2xl bg-accent/10 p-4 text-sm leading-relaxed text-accent">{info}</p>
          ) : (
            <form className="mt-5 space-y-3" onSubmit={submit}>
              {mode === 'signup' && (
                <label className="block text-xs font-medium text-muted">
                  Prénom
                  <input
                    className={field}
                    value={name}
                    maxLength={30}
                    autoComplete="given-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Comme tes proches t'appellent"
                  />
                </label>
              )}
              {mode !== 'recovery' && (
                <label className="block text-xs font-medium text-muted">
                  Email
                  <input
                    type="email"
                    className={field}
                    value={email}
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="toi@exemple.fr"
                  />
                </label>
              )}
              {mode !== 'forgot' && (
                <label className="block text-xs font-medium text-muted">
                  {mode === 'recovery' ? 'Nouveau mot de passe' : 'Mot de passe'}
                  <input
                    type="password"
                    className={field}
                    value={password}
                    minLength={mode === 'login' ? undefined : 6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? '' : '6 caractères minimum'}
                  />
                </label>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                disabled={!canSubmit}
                className="mt-2 w-full rounded-full bg-accent py-3 font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
              >
                {busy ? '…' : submitLabel}
              </button>
            </form>
          )}

          {mode === 'login' && !info && (
            <button
              onClick={() => switchTo('forgot')}
              className="mt-3 w-full text-center text-xs text-muted underline-offset-2 hover:text-paper hover:underline"
            >
              Mot de passe oublié ?
            </button>
          )}
          {mode === 'forgot' && (
            <button
              onClick={() => switchTo('login')}
              className="mt-3 w-full text-center text-xs text-muted underline-offset-2 hover:text-paper hover:underline"
            >
              ← Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
