import { useEffect, useRef, useState } from 'react'
import { AvatarStack } from './Avatar'
import { CloseIcon } from './Icons'
import { pseudoError, emailError, emailSuggestion, passwordError, PASSWORD_RULES, PSEUDO_MAX, PASSWORD_MAX } from '../lib/validation'

// Texte en 16 px : tous les champs ont la même hauteur, et l'iPhone ne zoome pas en touchant un champ
const fieldBase =
  'w-full rounded-2xl border border-line bg-ink px-4 py-2.5 text-base font-normal text-paper outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15'
const field = `mt-1.5 ${fieldBase}`
const fieldError = 'border-red-500 focus:border-red-500 focus:ring-red-500/15'

const TITLES = {
  login: ['Re-bonjour.', 'Connecte-toi pour retrouver tes disques et tes salons.'],
  signup: ['Ton bac à toi.', 'Tes souhaits et ta collection te suivent dans tous les salons que tu rejoins.'],
  forgot: ['Mot de passe oublié.', 'Indique ton email : tu recevras un lien pour en choisir un nouveau.'],
  recovery: ['Nouveau mot de passe.', 'Choisis ton nouveau mot de passe.'],
}

const EyeIcon = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
)

const Err = ({ id, children }) =>
  children ? (
    <span id={id} role="alert" className="mt-1.5 block text-xs font-normal text-red-500">
      {children}
    </span>
  ) : null

// Connexion, création de compte, mot de passe oublié / nouveau mot de passe.
// invite : { name, members } quand on arrive par le lien d'un salon
// onCheckPseudo(pseudo) → 'free' | 'taken' | 'unknown' : vérifie en direct que le pseudo est libre
export default function AuthDialog({
  initialMode = 'login', invite, onSignIn, onSignUp, onReset, onUpdatePassword, onClose, onCheckPseudo,
}) {
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)
  const [touched, setTouched] = useState({}) // champs quittés au moins une fois
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const refs = { name: useRef(null), email: useRef(null), password: useRef(null), confirm: useRef(null) }

  const creating = mode === 'signup' || mode === 'recovery' // un nouveau mot de passe est choisi
  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }))
  const shown = (k) => submitted || touched[k]

  // Pseudo déjà pris ? On vérifie pendant qu'on tape (seulement s'il respecte les règles)
  const [taken, setTaken] = useState(false)
  const latest = useRef('')
  useEffect(() => {
    const pseudo = name.trim()
    latest.current = pseudo
    setTaken(false)
    if (mode !== 'signup' || !onCheckPseudo || pseudoError(pseudo)) return
    const timer = setTimeout(async () => {
      const res = await onCheckPseudo(pseudo).catch(() => 'unknown')
      if (latest.current === pseudo) setTaken(res === 'taken')
    }, 400)
    return () => clearTimeout(timer)
  }, [name, mode, onCheckPseudo])

  // Erreurs de chaque champ
  const ruleError = mode === 'signup' ? pseudoError(name) : null
  const errors = {
    name: mode !== 'signup' ? null : ruleError || (taken ? 'Ce pseudo est déjà pris, choisis-en un autre.' : null),
    email: mode === 'recovery' ? null : emailError(email),
    password:
      mode === 'forgot' ? null : creating ? passwordError(password) : password ? null : 'Indique ton mot de passe.',
    confirm: !creating ? null : !confirm ? 'Confirme ton mot de passe.' : confirm !== password ? 'Les deux mots de passe ne sont pas identiques.' : null,
  }
  // Ce qu'on affiche : après avoir quitté le champ (ou validé) ; « déjà pris » et
  // les caractères interdits tout de suite
  const visible = {
    name:
      errors.name &&
      (shown('name') || taken || (name.trim() && ruleError && !/Au moins|Choisis/.test(ruleError)))
        ? errors.name
        : null,
    email: shown('email') ? errors.email : null,
    // Nouveau mot de passe : la liste des règles suffit (sauf espaces / trop long)
    password: !errors.password
      ? null
      : creating
        ? shown('password') && !pwFocus && !/règles|Choisis/.test(errors.password) ? errors.password : null
        : submitted ? errors.password : null,
    confirm: errors.confirm && (shown('confirm') || (confirm && !password.startsWith(confirm))) ? errors.confirm : null,
  }
  const suggestion = mode !== 'recovery' && touched.email ? emailSuggestion(email) : null

  function switchTo(m) {
    setMode(m)
    setError(null)
    setInfo(null)
    setSubmitted(false)
    setTouched({})
    setConfirm('')
  }

  async function submit(e) {
    e.preventDefault()
    setSubmitted(true)
    // Le premier champ à corriger reçoit le curseur
    const first = ['name', 'email', 'password', 'confirm'].find((k) => errors[k])
    if (first) {
      refs[first].current?.focus()
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    const mail = email.trim().toLowerCase()
    let err = null
    if (mode === 'login') {
      err = await onSignIn(mail, password)
    } else if (mode === 'signup') {
      const res = await onSignUp({ name: name.trim(), email: mail, password })
      err = res.error
      if (!err && res.needsConfirmation) {
        setInfo(`Presque fini ! Clique sur le lien envoyé à ${mail} pour activer ton compte${invite ? ' et rejoindre le salon' : ''}.`)
      }
    } else if (mode === 'forgot') {
      err = await onReset(mail)
      if (!err) setInfo(`Si un compte existe pour ${mail}, un lien vient de lui être envoyé.`)
    } else if (mode === 'recovery') {
      err = await onUpdatePassword(password)
    }
    setBusy(false)
    if (err && /pseudo/i.test(err) && /pris/i.test(err)) setTaken(true)
    else if (err) setError(err)
  }

  const [title, subtitle] = TITLES[mode]
  const tabs = mode === 'login' || mode === 'signup'
  const submitLabel = {
    login: 'Se connecter',
    signup: invite ? 'Créer et rejoindre le salon' : 'Créer mon compte',
    forgot: 'Envoyer le lien',
    recovery: 'Enregistrer',
  }[mode]
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length

  // L'œil d'un champ mot de passe (chaque champ a le sien)
  const eye = (shown, toggle) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // garde le curseur dans le champ (rien ne bouge sous le doigt)
      onClick={toggle}
      aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      aria-pressed={shown}
      className="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-raised hover:text-paper"
    >
      <EyeIcon off={shown} />
    </button>
  )

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
            <form className="mt-5 space-y-3" onSubmit={submit} noValidate>
              {mode === 'signup' && (
                <div>
                <label className="block text-xs font-medium text-muted">
                  Pseudo
                  <input
                    ref={refs.name}
                    className={`${field} ${visible.name ? fieldError : ''}`}
                    value={name}
                    maxLength={PSEUDO_MAX}
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={!!visible.name}
                    aria-describedby={visible.name ? 'err-name' : undefined}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={touch('name')}
                    placeholder="3 à 20 caractères, sans espace"
                  />
                </label>
                <Err id="err-name">{visible.name}</Err>
                </div>
              )}

              {mode !== 'recovery' && (
                <div>
                <label className="block text-xs font-medium text-muted">
                  Email
                  <input
                    ref={refs.email}
                    type="email"
                    inputMode="email"
                    className={`${field} ${visible.email ? fieldError : ''}`}
                    value={email}
                    maxLength={254}
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={!!visible.email}
                    aria-describedby={visible.email ? 'err-email' : undefined}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={touch('email')}
                    placeholder="toi@exemple.fr"
                  />
                </label>
                  <Err id="err-email">{visible.email}</Err>
                  {!visible.email && suggestion && (
                    <span className="mt-1.5 block text-xs font-normal text-muted">
                      Tu voulais dire{' '}
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setEmail(suggestion)} className="font-bold text-paper underline underline-offset-2">
                        {suggestion}
                      </button>{' '}
                      ?
                    </span>
                  )}
                </div>
              )}

              {mode !== 'forgot' && (
                <div>
                  <label htmlFor="auth-password" className="block text-xs font-medium text-muted">
                    {mode === 'recovery' ? 'Nouveau mot de passe' : 'Mot de passe'}
                  </label>
                  {/* L'œil est centré sur le champ */}
                  <div className="relative mt-1.5">
                      <input
                        ref={refs.password}
                        type={showPassword ? 'text' : 'password'}
                        id="auth-password"
                        className={`${fieldBase} pr-12 ${visible.password ? fieldError : ''}`}
                        value={password}
                        maxLength={PASSWORD_MAX}
                        autoComplete={creating ? 'new-password' : 'current-password'}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-invalid={!!visible.password}
                        aria-describedby={creating ? 'pw-rules' : visible.password ? 'err-password' : undefined}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setPwFocus(true)}
                        onBlur={() => {
                          setPwFocus(false)
                          touch('password')()
                        }}
                      />
                    {eye(showPassword, () => setShowPassword((v) => !v))}
                  </div>
                  <Err id="err-password">{visible.password}</Err>

                  {/* Les règles se cochent au fur et à mesure */}
                  {creating && (pwFocus || password || submitted) && (
                    <div id="pw-rules" className="mt-2.5">
                      <div className="flex gap-1" aria-hidden="true">
                        {PASSWORD_RULES.map((r, i) => (
                          <span
                            key={r.id}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i < passed ? (passed === PASSWORD_RULES.length ? 'bg-accent' : passed >= 3 ? 'bg-sun' : 'bg-red-500') : 'bg-raised'
                            }`}
                          />
                        ))}
                      </div>
                      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {PASSWORD_RULES.map((r) => {
                          const okRule = r.test(password)
                          return (
                            <li key={r.id} className={`flex items-center gap-1.5 ${okRule ? 'text-accent' : submitted ? 'text-red-500' : 'text-muted'}`}>
                              <span aria-hidden="true" className="w-3 text-center">{okRule ? '✓' : '•'}</span>
                              {r.label}
                              <span className="sr-only">{okRule ? ' : respecté' : ' : manquant'}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {creating && (
                <div>
                <label htmlFor="auth-confirm" className="block text-xs font-medium text-muted">
                  Confirme le mot de passe
                </label>
                <div className="relative mt-1.5">
                  <input
                    ref={refs.confirm}
                    id="auth-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    className={`${fieldBase} pr-12 ${visible.confirm ? fieldError : ''}`}
                    value={confirm}
                    maxLength={PASSWORD_MAX}
                    autoComplete="new-password"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={!!visible.confirm}
                    aria-describedby={visible.confirm ? 'err-confirm' : undefined}
                    onChange={(e) => setConfirm(e.target.value)}
                    onBlur={touch('confirm')}
                  />
                  {eye(showConfirm, () => setShowConfirm((v) => !v))}
                </div>
                <Err id="err-confirm">{visible.confirm}</Err>
                </div>
              )}

              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

              <button
                disabled={busy}
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