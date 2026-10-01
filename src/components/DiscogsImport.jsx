import { useEffect, useMemo, useState } from 'react'
import Cover from './Cover'
import { CloseIcon, CheckIcon } from './Icons'
import { cleanDiscogsUsername, fetchDiscogsList, itemKey } from '../lib/discogs'
import { readJSON, writeJSON } from '../lib/cache'

const USER_KEY = 'vinyl-wishlist-discogs-user'

const field =
  'w-full rounded-2xl border border-ink/25 bg-ink/10 px-4 py-3 text-ink outline-none transition placeholder:text-ink/50 focus:border-ink/60 focus:bg-ink/15'

function Toggle({ checked, onChange, title, hint, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex flex-1 items-start gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${
        checked ? 'border-sun bg-ink/15' : 'border-ink/25 hover:border-ink/50'
      }`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-sun bg-sun text-paper' : 'border-ink/50'}`}>
        {checked && <CheckIcon width={14} height={14} />}
      </span>
      <span>
        <span className="block font-display text-lg font-black uppercase leading-none">{title}</span>
        <span className="mt-1 block text-xs text-ink/70">{hint}</span>
      </span>
    </button>
  )
}

function Progress({ value, label }) {
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/15">
        <div className="h-full rounded-full bg-sun transition-[width] duration-300" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <p className="mt-2 font-mono text-xs text-ink/75">{label}</p>
    </div>
  )
}

function Stat({ n, label, muted }) {
  return (
    <div className={`rounded-2xl p-3 ${muted ? 'bg-ink/5' : 'bg-ink/15'}`}>
      <p className={`font-display text-3xl font-black leading-none ${muted ? 'text-ink/60' : ''}`}>{n}</p>
      <p className="mt-1 text-xs leading-snug text-ink/75">{label}</p>
    </div>
  )
}

// Import d'une collection et/ou d'une wantlist Discogs publiques.
// statusOf(item) -> 'wish' | 'owned' | null pour MA liste.
// onImport(plan, onProgress) enregistre et renvoie { added, upgraded }.
export default function DiscogsImport({ statusOf, onImport, onCompletePrices, onClose, offline }) {
  const [username, setUsername] = useState(() => readJSON(USER_KEY, ''))
  const [wantOwned, setWantOwned] = useState(true)
  const [wantWish, setWantWish] = useState(true)
  const [step, setStep] = useState('form') // form | reading | preview | saving | done
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ label: '', value: 0 })
  const [lists, setLists] = useState(null) // { owned, wish } : résultats de fetchDiscogsList
  const [upgradeWishes, setUpgradeWishes] = useState(true)
  const [result, setResult] = useState(null)

  const busy = step === 'reading' || step === 'saving'

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // Ce qui sera fait, disque par disque
  const plan = useMemo(() => {
    if (!lists) return null
    const inserts = []
    const upgrades = []
    let already = 0
    const ownedKeys = new Set()
    for (const item of lists.owned?.items || []) {
      ownedKeys.add(itemKey(item))
      const status = statusOf(item)
      if (status === 'owned') already++
      else if (status === 'wish') {
        if (upgradeWishes) upgrades.push(item)
        else already++
      }
      else inserts.push({ item, status: 'owned' })
    }
    for (const item of lists.wish?.items || []) {
      if (ownedKeys.has(itemKey(item))) continue // dans les deux listes : la collection gagne
      if (statusOf(item)) already++
      else inserts.push({ item, status: 'wish' })
    }
    const skipped = (lists.owned?.skipped || 0) + (lists.wish?.skipped || 0)
    return {
      inserts,
      upgrades,
      already,
      skipped,
      newOwned: inserts.filter((x) => x.status === 'owned').length,
      newWish: inserts.filter((x) => x.status === 'wish').length,
    }
  }, [lists, statusOf, upgradeWishes])

  async function read(e) {
    e.preventDefault()
    const user = cleanDiscogsUsername(username)
    if (!user) return setError('Indique ton nom d’utilisateur Discogs.')
    setError(null)
    setStep('reading')
    writeJSON(USER_KEY, user)
    const found = {}
    try {
      const kinds = [wantOwned && 'owned', wantWish && 'wish'].filter(Boolean)
      for (const kind of kinds) {
        const label = kind === 'owned' ? 'ta collection' : 'ta wantlist'
        setProgress({ label: `Lecture de ${label}…`, value: 0 })
        found[kind] = await fetchDiscogsList(user, kind, ({ done, total }) =>
          setProgress({ label: `Lecture de ${label} · ${done} / ${total}`, value: total ? done / total : 1 })
        )
      }
      setLists(found)
      setStep('preview')
    } catch (err) {
      setError(err.message)
      setStep('form')
    }
  }

  async function save() {
    setStep('saving')
    setError(null)
    const total = plan.inserts.length + plan.upgrades.length
    setProgress({ label: `Import · 0 / ${total}`, value: 0 })
    try {
      const res = await onImport(
        { inserts: plan.inserts, upgrades: plan.upgrades },
        (done) => setProgress({ label: `Import · ${done} / ${total}`, value: total ? done / total : 1 })
      )
      setResult(res)
      setStep('done')
    } catch (err) {
      setError(err.message || 'L’import a échoué. Réessaie.')
      setStep('preview')
    }
  }

  const preview = plan ? [...plan.inserts.map((x) => x.item), ...plan.upgrades].slice(0, 12) : []
  const toDo = plan ? plan.inserts.length + plan.upgrades.length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importer depuis Discogs"
        className="animate-pop flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-accent text-ink shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/70">Depuis Discogs</p>
            <h3 className="mt-1 font-display text-4xl font-black uppercase leading-[0.85] sm:text-5xl">
              {step === 'done' ? 'C’est rangé.' : 'Ramène tes disques.'}
            </h3>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Fermer" className="-mr-1 rounded-full p-1.5 text-ink/80 transition hover:bg-ink/15 hover:text-ink disabled:opacity-40">
            <CloseIcon width={22} height={22} />
          </button>
        </div>

        <div className="nice-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3 sm:px-7">
          {/* 1. Nom d'utilisateur */}
          {(step === 'form' || step === 'reading') && (
            <form onSubmit={read} className="space-y-4">
              <p className="text-sm text-ink/80">
                Ta collection et ta wantlist Discogs arrivent d’un coup dans ta liste. Rien n’est modifié sur Discogs.
              </p>
              <label className="block text-xs font-medium text-ink/75">
                Ton nom d’utilisateur Discogs (ou le lien de ton profil)
                <input
                  className={`${field} mt-1.5`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex. pseudo_vinyles"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  disabled={busy}
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Toggle checked={wantOwned} onChange={setWantOwned} disabled={busy} title="Collection" hint="→ dans ta collection" />
                <Toggle checked={wantWish} onChange={setWantWish} disabled={busy} title="Wantlist" hint="→ dans tes souhaits" />
              </div>
              {error && <p className="rounded-xl bg-ink px-3 py-2 text-sm text-red-600">{error}</p>}
              {step === 'reading' ? (
                <Progress value={progress.value} label={progress.label} />
              ) : (
                <button
                  disabled={!username.trim() || (!wantOwned && !wantWish) || offline}
                  className="w-full rounded-full bg-ink py-3 font-bold text-accent transition hover:bg-surface disabled:opacity-50"
                >
                  {offline ? 'Indisponible hors-ligne' : 'Voir ce qui sera importé'}
                </button>
              )}
              <p className="text-xs text-ink/60">
                Seules les listes publiques sont lisibles. Les CD et cassettes sont ignorés.
              </p>
            </form>
          )}

          {/* 2. Aperçu */}
          {(step === 'preview' || step === 'saving') && plan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {lists.owned && <Stat n={plan.newOwned} label="nouveaux dans ta collection" />}
                {lists.wish && <Stat n={plan.newWish} label="nouveaux dans tes souhaits" />}
                {plan.upgrades.length > 0 && <Stat n={plan.upgrades.length} label="souhaits que tu as déjà : passent en collection" />}
                <Stat n={plan.already} label="déjà dans ta liste" muted />
                {plan.skipped > 0 && <Stat n={plan.skipped} label="CD, cassettes… ignorés" muted />}
              </div>

              {preview.length > 0 && (
                <ul className="grid grid-cols-6 gap-1.5" aria-label="Aperçu">
                  {preview.map((it) => (
                    <li key={itemKey(it)} title={`${it.artist} – ${it.title}`}>
                      <Cover url={it.cover_url} className="aspect-square w-full overflow-hidden rounded-md ring-1 ring-ink/20" />
                    </li>
                  ))}
                </ul>
              )}

              {lists.owned && (plan.upgrades.length > 0 || !upgradeWishes) && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={upgradeWishes} onChange={(e) => setUpgradeWishes(e.target.checked)} disabled={busy} className="h-4 w-4 accent-[var(--color-sun)]" />
                  Passer en collection les souhaits que j’ai déjà sur Discogs
                </label>
              )}

              {error && <p className="rounded-xl bg-ink px-3 py-2 text-sm text-red-600">{error}</p>}

              {step === 'saving' ? (
                <Progress value={progress.value} label={progress.label} />
              ) : toDo === 0 ? (
                <div className="space-y-2">
                  <p className="rounded-2xl bg-ink/15 p-4 text-sm">Tout est déjà dans ta liste, rien à importer.</p>
                  <button onClick={() => setStep('form')} className="w-full rounded-full border border-ink/40 py-2.5 text-sm font-medium transition hover:bg-ink/10">
                    Changer de compte
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setStep('form')} className="rounded-full border border-ink/40 px-4 py-3 text-sm font-medium transition hover:bg-ink/10">
                    Retour
                  </button>
                  <button onClick={save} disabled={offline} className="flex-1 rounded-full bg-ink py-3 font-bold text-accent transition hover:bg-surface disabled:opacity-50">
                    Importer {toDo} disque{toDo > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Terminé */}
          {step === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl bg-ink/15 p-4">
                <span className="vinyl-disc animate-slow-spin block h-14 w-14 shrink-0" style={{ '--disc-label': '#f1c04e' }} />
                <p className="text-sm leading-relaxed">
                  <span className="font-display text-2xl font-black">{result.added}</span> disque{result.added > 1 ? 's' : ''} ajouté{result.added > 1 ? 's' : ''}
                  {result.upgraded > 0 && (
                    <>
                      , <span className="font-display text-2xl font-black">{result.upgraded}</span> souhait{result.upgraded > 1 ? 's' : ''} passé{result.upgraded > 1 ? 's' : ''} en collection
                    </>
                  )}
                  .
                </p>
              </div>
              {result.added > 0 && (
                <p className="text-sm text-ink/80">
                  Les prix ne viennent pas avec l’import. « Compléter les infos » va les chercher, un disque par seconde environ : tu peux laisser tourner.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                {result.added > 0 && (
                  <button onClick={onCompletePrices} className="flex-1 rounded-full bg-ink py-3 font-bold text-accent transition hover:bg-surface">
                    Compléter les prix maintenant
                  </button>
                )}
                <button onClick={onClose} className="flex-1 rounded-full border border-ink/40 py-3 text-sm font-medium transition hover:bg-ink/10">
                  Voir ma liste
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
