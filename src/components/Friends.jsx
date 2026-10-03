import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { CloseIcon, SearchIcon } from './Icons'

export const FriendsIcon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 14.2a4.5 4.5 0 0 1 5 4.3" />
  </svg>
)

const ShareLinkIcon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
)

// « il y a 3 j »
function ago(iso) {
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 3600) return `il y a ${Math.max(1, Math.round(d / 60))} min`
  if (d < 86400) return `il y a ${Math.round(d / 3600)} h`
  if (d < 86400 * 30) return `il y a ${Math.round(d / 86400)} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const smallBtn = 'rounded-full px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-50'
const primary = `${smallBtn} bg-accent text-ink hover:bg-accent-soft`
const ghost = `${smallBtn} border border-line font-medium hover:border-accent`



// Page « Amis » : rechercher quelqu'un, demandes reçues/envoyées, mes amis,
// et ce qui bouge chez eux.
// friends : le résultat de useFriends(). onOpenFriend(id) : voir ses disques ;
// onMessage(id) : lui écrire. statsOf(id) : { wish, owned, covers, common } ;
// activity : [{ vinyl, friend }] derniers disques ajoutés par mes amis ;
// onInvite : partager le lien de l'app.
export default function FriendsPanel({
  friends, onOpenFriend, onMessage, onToast, offline,
  statsOf = () => ({ wish: 0, owned: 0, covers: [], common: 0 }), activity = [], onInvite,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(null) // id de la personne en cours
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const requestId = useRef(0)

  // Recherche après une petite pause de frappe
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearched(false)
      setSearching(false)
      return
    }
    const id = ++requestId.current
    setSearching(true)
    const timer = setTimeout(async () => {
      const res = await friends.search(q)
      if (id !== requestId.current) return
      setSearching(false)
      setSearched(true)
      setResults(res.results)
      setError(res.error ?? null)
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function run(id, action, success) {
    setBusy(id)
    setError(null)
    const res = await action()
    setBusy(null)
    if (res?.error) {
      setError(res.error)
      return null
    }
    if (success) onToast(typeof success === 'function' ? success(res) : success)
    return res
  }

  const disabled = offline || !!busy
  const { friends: list, incoming, outgoing, relationOf } = friends

  function relationButton(person) {
    const rel = relationOf(person.id)
    if (rel === 'friend') {
      return (
        <button onClick={() => onOpenFriend(person.id)} className={ghost}>
          Voir ses disques
        </button>
      )
    }
    if (rel === 'outgoing') return <span className="text-xs text-muted">Demande envoyée</span>
    if (rel === 'incoming') {
      return (
        <button
          onClick={() => run(person.id, () => friends.accept(person.id), `${person.name} et toi êtes amis`)}
          disabled={disabled}
          className={primary}
        >
          {busy === person.id ? '…' : 'Accepter'}
        </button>
      )
    }
    return (
      <button
        onClick={() =>
          run(person.id, () => friends.send(person.id), (r) =>
            r.status === 'accepted' ? `${person.name} et toi êtes amis` : `Demande envoyée à ${person.name}`
          )
        }
        disabled={disabled}
        className={primary}
      >
        {busy === person.id ? '…' : 'Ajouter'}
      </button>
    )
  }

  const searching_ = query.trim().length >= 2

  return (
    <div className="space-y-10">
      {/* --- Recherche + inviter --- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={offline || friends.missing}
            placeholder="Trouver quelqu’un par son prénom…"
            aria-label="Chercher un utilisateur"
            autoComplete="off"
            enterKeyHint="search"
            className="w-full rounded-2xl border border-line bg-surface py-4 pl-14 pr-12 text-base shadow-[0_10px_30px_-14px_rgba(27,36,32,0.35)] outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
          {searching ? (
            <span className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-accent" />
          ) : (
            query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-raised hover:text-paper"
              >
                <CloseIcon width={16} height={16} />
              </button>
            )
          )}

          {/* Résultats sous la barre */}
          {searching_ && (searched || results.length > 0) && (
            <div className="animate-pop mt-2 overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)]">
              {results.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">Personne ne s’appelle « {query.trim()} ».</p>
              ) : (
                <ul>
                  {results.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-raised">
                      <Avatar member={p} size={40} ring={false} />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      {relationButton(p)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {onInvite && (
          <button
            onClick={onInvite}
            className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 py-4 text-sm font-bold transition hover:border-accent"
          >
            <ShareLinkIcon /> Inviter un ami
          </button>
        )}
      </div>

      {friends.missing && (
        <p className="rounded-2xl bg-raised px-4 py-3 text-sm">Lance d’abord le script 9-amis.sql dans Supabase.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* --- Demandes reçues : bien en vue --- */}
      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl font-black uppercase">
            {incoming.length > 1 ? `${incoming.length} demandes d’ami` : 'Une demande d’ami'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {incoming.map((p) => (
              <li
                key={p.id}
                className="animate-pop flex items-center gap-4 rounded-2xl border-2 border-accent/50 bg-accent/8 p-4"
              >
                <Avatar member={p} size={52} ring={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl font-black uppercase leading-tight">{p.name}</p>
                  <p className="text-xs text-muted">veut être ton ami·e</p>
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      onClick={() => run(p.id, () => friends.accept(p.id), `${p.name} et toi êtes amis`)}
                      disabled={disabled}
                      className={primary}
                    >
                      {busy === p.id ? '…' : 'Accepter'}
                    </button>
                    <button
                      onClick={() => run(p.id, () => friends.remove(p.id), 'Demande refusée')}
                      disabled={disabled}
                      className={ghost}
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Mes amis : une « pochette » par ami --- */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-black uppercase">
            Mes amis <span className="text-muted">{list.length || ''}</span>
          </h2>
        </div>

        {list.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-line px-6 py-12 text-center">
            <div className="relative mx-auto h-24 w-40">
              <span className="vinyl-disc absolute left-0 top-2 h-20 w-20 animate-disc" style={{ '--disc-label': '#f09aaa' }} />
              <span className="vinyl-disc absolute right-0 top-2 h-20 w-20 animate-disc" style={{ '--disc-label': '#6aa6d6' }} />
            </div>
            <p className="mt-4 font-display text-3xl font-black uppercase leading-none">Les disques, c’est mieux à plusieurs</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Ajoute tes proches pour voir ce qu’ils veulent, ce qu’ils ont déjà, et ne plus jamais offrir un disque en double.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => inputRef.current?.focus()}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-soft"
              >
                Chercher un prénom
              </button>
              {onInvite && (
                <button onClick={onInvite} className="rounded-full border border-line px-5 py-2.5 text-sm font-medium transition hover:border-accent">
                  Envoyer le lien de l’app
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => {
              const st = statsOf(p.id)
              if (confirmRemove === p.id) {
                return (
                  <li key={p.id} className="animate-pop flex flex-col justify-center gap-3 rounded-3xl border border-line bg-surface p-5">
                    <p className="text-sm">Retirer {p.name} de tes amis ? Vous ne verrez plus vos disques.</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => setConfirmRemove(null)} className={ghost}>Annuler</button>
                      <button
                        onClick={async () => {
                          if (await run(p.id, () => friends.remove(p.id), `${p.name} ne fait plus partie de tes amis`)) setConfirmRemove(null)
                        }}
                        disabled={disabled}
                        className={`${smallBtn} bg-red-500 text-white hover:bg-red-400`}
                      >
                        Retirer
                      </button>
                    </div>
                  </li>
                )
              }
              return (
                <li key={p.id} className="group relative overflow-hidden rounded-3xl border border-line bg-surface">
                  {/* Bandeau à sa couleur, avec ses derniers souhaits en éventail */}
                  <button
                    onClick={() => onOpenFriend(p.id)}
                    className="relative block h-32 w-full overflow-hidden text-left"
                    style={{ background: `color-mix(in oklab, ${p.color || '#ec5b3e'} 35%, var(--color-surface))` }}
                    aria-label={`Voir les disques de ${p.name}`}
                  >
                    <span
                      aria-hidden="true"
                      className="vinyl-disc absolute -right-10 -top-10 h-44 w-44 transition-transform duration-700 group-hover:rotate-45"
                      style={{ '--disc-label': p.color || '#ec5b3e' }}
                    />
                    {st.covers.length > 0 && (
                      <span className="absolute bottom-3 left-[5.5rem] flex">
                        {st.covers.slice(0, 4).map((url, i) => (
                          <img
                            key={url + i}
                            src={url}
                            alt=""
                            loading="lazy"
                            className={`h-14 w-14 rounded-md object-cover shadow-lg ring-2 ring-surface transition-transform duration-300 group-hover:-translate-y-1 ${i ? '-ml-5' : ''}`}
                            style={{ transform: `rotate(${(i - 1.5) * 5}deg)`, transitionDelay: `${i * 40}ms` }}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                  <div className="relative px-5 pb-5">
                    <Avatar member={p} size={64} ring={false} className="-mt-10 ring-4 ring-surface" />
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <button onClick={() => onOpenFriend(p.id)} className="min-w-0 text-left">
                        <p className="truncate font-display text-2xl font-black uppercase leading-tight">{p.name}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {st.wish} souhait{st.wish > 1 ? 's' : ''} · {st.owned} en collection
                        </p>
                      </button>
                      <button
                        onClick={() => setConfirmRemove(p.id)}
                        disabled={disabled}
                        aria-label={`Retirer ${p.name} de mes amis`}
                        title="Retirer de mes amis"
                        className="shrink-0 rounded-full p-1.5 text-muted opacity-60 transition hover:bg-raised hover:text-paper hover:opacity-100"
                      >
                        <CloseIcon width={16} height={16} />
                      </button>
                    </div>
                    {st.common > 0 && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs">
                        <span className="keep-day h-2 w-2 rounded-full bg-sun" />
                        {st.common} disque{st.common > 1 ? 's' : ''} en commun avec toi
                      </p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => onMessage(p.id)} className={`${primary} flex-1 py-2`}>
                        Écrire
                      </button>
                      <button onClick={() => onOpenFriend(p.id)} className={`${ghost} flex-1 py-2`}>
                        Ses disques
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* --- Du nouveau chez tes amis --- */}
      {activity.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-2xl font-black uppercase">Du nouveau chez tes amis</h2>
          <ul className="no-scrollbar -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
            {activity.map(({ vinyl, friend }) => (
              <li key={vinyl.id} className="w-40 shrink-0 snap-start sm:w-44">
                <button onClick={() => onOpenFriend(friend.id)} className="group block w-full text-left">
                  <span className="relative block">
                    <span
                      aria-hidden="true"
                      className="vinyl-disc absolute right-[5%] top-[5%] h-[90%] w-[90%] transition-transform duration-500 group-hover:translate-x-[22%]"
                    />
                    {vinyl.cover_url ? (
                      <img src={vinyl.cover_url} alt="" loading="lazy" className="relative aspect-square w-full rounded-lg object-cover shadow-md" />
                    ) : (
                      <span className="relative block aspect-square w-full rounded-lg bg-raised" />
                    )}
                    <Avatar member={friend} size={30} ring={false} className="absolute -bottom-2 left-1.5 ring-2 ring-ink" />
                  </span>
                  <span className="mt-3 block truncate text-sm font-bold">{vinyl.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {friend.name} · {vinyl.status === 'owned' ? 'l’a eu' : 'le veut'} · {ago(vinyl.owned_at || vinyl.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Demandes envoyées --- */}
      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">En attente de réponse</h2>
          <ul className="flex flex-wrap gap-2">
            {outgoing.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1.5">
                <Avatar member={p} size={30} ring={false} />
                <span className="text-sm font-medium">{p.name}</span>
                <button
                  onClick={() => run(p.id, () => friends.remove(p.id), 'Demande annulée')}
                  disabled={disabled}
                  aria-label={`Annuler la demande à ${p.name}`}
                  title="Annuler la demande"
                  className="rounded-full p-1 text-muted hover:bg-raised hover:text-paper"
                >
                  <CloseIcon width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
