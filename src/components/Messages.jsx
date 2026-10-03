import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from './Icons'
import { RecordIcon } from './Layout'

// --- Dates ---
const sameDay = (a, b) => a.toDateString() === b.toDateString()
function dayLabel(d) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(d, today)) return 'Aujourd’hui'
  if (sameDay(d, yesterday)) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
const timeLabel = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
function shortWhen(iso) {
  const d = new Date(iso)
  const today = new Date()
  if (sameDay(d, today)) return timeLabel(d)
  const diff = (today - d) / 86400000
  if (diff < 6) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
const preview = (m, meId) =>
  `${m.sender === meId ? 'Toi : ' : ''}${m.vinyl ? `disque partagé, ${m.vinyl.title}` : m.body}`

const SendIcon = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
)
const BackIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

// ---------------------------------------------------------------------------
// Petite rangée de pochettes (les derniers souhaits de quelqu'un)
function CoverStrip({ covers, size = 28 }) {
  if (!covers?.length) return null
  return (
    <span className="flex shrink-0 items-center">
      {covers.slice(0, 3).map((url, i) => (
        <img
          key={url + i}
          src={url}
          alt=""
          loading="lazy"
          className={`rounded-[3px] object-cover shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)] ring-2 ring-surface ${i ? '-ml-2' : ''}`}
          style={{ width: size, height: size, transform: `rotate(${(i - 1) * 6}deg)` }}
        />
      ))}
    </span>
  )
}

// Liste des conversations (colonne de gauche sur ordinateur, page entière sur téléphone)
// coversOf(id) : pochettes des derniers souhaits de la personne
function ConversationList({ conversations, friends, people, meId, activeId, coversOf, onOpen, onFindFriends }) {
  const [q, setQ] = useState('')
  const norm = (t = '') => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const match = (p) => !q.trim() || norm(p.name).includes(norm(q.trim()))
  const withConv = new Set(conversations.map((c) => c.otherId))
  const convs = conversations
    .map((c) => ({ ...c, person: people.get(c.otherId) ?? { id: c.otherId, name: 'Ancien ami', color: '#9aa398' } }))
    .filter((c) => match(c.person))
  const others = friends.filter((f) => !withConv.has(f.id) && match(f))
  const unreadTotal = conversations.reduce((n, c) => n + c.unread, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-4 pt-6 lg:px-5 lg:pt-5">
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-5xl font-black uppercase leading-[0.85] lg:text-4xl">Messages</h1>
          {unreadTotal > 0 && (
            <span className="mb-1 text-sm font-medium text-accent">
              {unreadTotal} non lu{unreadTotal > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {(conversations.length > 0 || friends.length > 4) && (
          <label className="relative mt-4 block">
            <SearchIcon width={18} height={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Chercher un ami"
              aria-label="Chercher dans les conversations"
              className="w-full rounded-full border border-line bg-ink py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent"
            />
          </label>
        )}
      </div>

      <div className="nice-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-6 lg:px-2">
        {convs.length > 0 && (
          <ul className="space-y-0.5">
            {convs.map((c) => {
              const unread = c.unread > 0
              const active = c.otherId === activeId
              const v = c.last.vinyl
              return (
                <li key={c.otherId}>
                  <button
                    onClick={() => onOpen(c.otherId)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      active ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-raised'
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Avatar member={c.person} size={52} ring={false} />
                      {unread && (
                        <span className="keep-day absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-coral ring-2 ring-surface" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-[15px] ${unread ? 'font-bold' : 'font-semibold'}`}>{c.person.name}</span>
                        <span className={`shrink-0 text-xs ${unread ? 'font-bold text-accent' : 'text-muted'}`}>
                          {shortWhen(c.last.created_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        {v?.cover_url && <img src={v.cover_url} alt="" className="h-5 w-5 shrink-0 rounded-[3px] object-cover" />}
                        <span className={`truncate text-sm ${unread ? 'font-medium text-paper' : 'text-muted'}`}>
                          {v
                            ? `${c.last.sender === meId ? 'Tu as partagé' : 'A partagé'} « ${v.title} »`
                            : `${c.last.sender === meId ? 'Toi : ' : ''}${c.last.body}`}
                        </span>
                        {c.unread > 1 && (
                          <span className="keep-day ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 font-mono text-[10px] font-bold text-white">
                            {c.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {others.length > 0 && (
          <>
            <p className="px-3 pb-2 pt-5 text-sm font-medium text-muted">
              {convs.length ? 'Tes autres amis' : 'Commence une conversation'}
            </p>
            <ul className="space-y-0.5">
              {others.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => onOpen(f.id)}
                    aria-current={f.id === activeId ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      f.id === activeId ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-raised'
                    }`}
                  >
                    <Avatar member={f} size={52} ring={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{f.name}</span>
                      <span className="block truncate text-sm text-muted">Écris-lui un premier message</span>
                    </span>
                    <CoverStrip covers={coversOf(f.id)} size={26} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {friends.length === 0 && conversations.length === 0 && (
          <div className="mx-3 mt-2 rounded-3xl border border-dashed border-line px-5 py-10 text-center">
            <div className="relative mx-auto h-20 w-28">
              <span className="absolute left-0 top-2 h-16 w-16 rotate-[-8deg] rounded-md bg-raised shadow" />
              <span className="vinyl-disc absolute right-0 top-0 h-20 w-20 animate-slow-spin" style={{ '--disc-label': '#f1c04e' }} />
            </div>
            <p className="mt-5 font-display text-2xl font-black uppercase leading-none">Personne à qui écrire</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
              Les messages se font entre amis. Ajoute quelqu’un pour parler disques et cadeaux.
            </p>
            <button
              onClick={onFindFriends}
              className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-soft"
            >
              Trouver des amis
            </button>
          </div>
        )}
        {(friends.length > 0 || conversations.length > 0) && convs.length === 0 && others.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted">Personne ne s’appelle comme ça.</p>
        )}
      </div>
    </div>
  )
}

// Colonne de droite quand aucune conversation n'est ouverte (ordinateur)
function EmptyPane({ friends, coversOf, onOpen }) {
  const suggestions = friends.slice(0, 3)
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      {/* La platine : un vinyle qui tourne doucement, prêt à jouer */}
      <div className="relative h-44 w-56">
        <span className="absolute bottom-0 left-0 h-36 w-36 rotate-[-6deg] rounded-lg bg-raised shadow-lg ring-1 ring-line" />
        <span
          className="vinyl-disc absolute right-0 top-0 h-40 w-40 animate-disc"
          style={{ '--disc-label': 'var(--user-accent-bg, #1d4a3a)' }}
        />
      </div>
      <p className="mt-8 font-display text-3xl font-black uppercase leading-none">Choisis une conversation</p>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Parle de vos trouvailles, demande une idée de cadeau, ou envoie un disque avec le bouton vinyle.
      </p>
      {suggestions.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {suggestions.map((f) => (
            <button
              key={f.id}
              onClick={() => onOpen(f.id)}
              className="flex items-center gap-3 rounded-full border border-line bg-ink py-1.5 pl-1.5 pr-4 text-sm font-medium transition hover:border-accent"
            >
              <Avatar member={f} size={32} ring={false} />
              Écrire à {f.name}
              <CoverStrip covers={coversOf(f.id)} size={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// La messagerie : liste + conversation côte à côte sur ordinateur,
// l'une puis l'autre sur téléphone.
export function Messenger({
  activeId, activeFriend, conversations, friends, people, meId, missing, coversOf,
  onOpen, onFindFriends, threadProps,
}) {
  if (missing) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="rounded-2xl bg-raised px-4 py-3 text-sm">Lance d’abord le script 10-messages.sql dans Supabase.</p>
      </div>
    )
  }
  const open = !!activeId
  return (
    <div
      className={`mx-auto grid max-w-[88rem] lg:h-[calc(100dvh-4rem)] lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-6 lg:px-14 lg:py-6 ${
        open ? 'h-[calc(100dvh-4rem)]' : ''
      }`}
    >
      <aside
        className={`${open ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col lg:overflow-hidden lg:rounded-3xl lg:border lg:border-line lg:bg-surface`}
      >
        <ConversationList
          conversations={conversations}
          friends={friends}
          people={people}
          meId={meId}
          activeId={activeId}
          coversOf={coversOf}
          onOpen={onOpen}
          onFindFriends={onFindFriends}
        />
      </aside>
      <section
        className={`${open ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col overflow-hidden lg:rounded-3xl lg:border lg:border-line lg:bg-surface`}
      >
        {open && activeFriend ? (
          <ChatThread key={activeId} friend={activeFriend} coversOf={coversOf} {...threadProps} />
        ) : open ? (
          <p className="m-auto text-muted">Chargement…</p>
        ) : (
          <EmptyPane friends={friends} coversOf={coversOf} onOpen={onOpen} />
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Un disque partagé dans la conversation
function VinylMessage({ vinyl, mine, status, onAdd }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className={`w-60 rounded-2xl border p-3 ${mine ? 'border-accent/40 bg-accent/10' : 'border-line bg-surface'}`}>
      <div className="group relative mr-10">
        {/* Le disque dépasse de sa pochette */}
        <span
          aria-hidden="true"
          className="vinyl-disc absolute inset-y-[5%] right-0 aspect-square translate-x-[30%] transition-transform duration-500 group-hover:translate-x-[42%]"
        />
        {vinyl.cover_url ? (
          <img src={vinyl.cover_url} alt="" loading="lazy" className="relative aspect-square w-full rounded-md object-cover shadow-md" />
        ) : (
          <span className="relative block aspect-square w-full rounded-md bg-raised" />
        )}
      </div>
      <p className="mt-3 truncate font-display text-lg font-black uppercase leading-tight">{vinyl.title}</p>
      <p className="truncate text-sm text-muted">
        {vinyl.artist}
        {vinyl.year ? ` · ${vinyl.year}` : ''}
      </p>
      {!mine && (
        <div className="mt-3">
          {status ? (
            <span className="flex items-center gap-1 text-xs text-muted">
              <CheckIcon width={14} height={14} /> {status === 'owned' ? 'Dans ta collection' : 'Dans tes souhaits'}
            </span>
          ) : (
            <button
              onClick={async () => {
                setBusy(true)
                await onAdd(vinyl)
                setBusy(false)
              }}
              disabled={busy}
              className="flex items-center gap-1 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
            >
              <PlusIcon width={13} height={13} /> {busy ? 'Ajout…' : 'Ajouter à mes souhaits'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Choisir un de mes disques à envoyer
function DiscPicker({ vinyls, onPick, onClose }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const norm = (t = '') => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = vinyls.filter((v) => !q.trim() || norm(`${v.title} ${v.artist}`).includes(norm(q.trim()))).slice(0, 80)

  return (
    <div className="animate-pop absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2 border-b border-line p-2">
        <SearchIcon width={18} height={18} className="ml-2 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Partager un de tes disques…"
          aria-label="Chercher dans tes disques"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted/70"
        />
        <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-paper">
          <CloseIcon width={16} height={16} />
        </button>
      </div>
      <ul className="nice-scroll max-h-72 overflow-y-auto p-1.5">
        {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Aucun disque trouvé.</li>}
        {list.map((v) => (
          <li key={`${v.discogs_type}:${v.discogs_id}`}>
            <button
              onClick={() => onPick(v)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-raised"
            >
              {v.cover_url ? (
                <img src={v.cover_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded object-cover" />
              ) : (
                <span className="h-11 w-11 shrink-0 rounded bg-raised" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{v.title}</span>
                <span className="block truncate text-xs text-muted">{v.artist}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted">{v.status === 'owned' ? 'Collection' : 'Souhait'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Une conversation
const STARTERS = ['Salut ! Tu écoutes quoi en ce moment ?', 'J’ai vu un disque qui va te plaire', 'Une idée de cadeau pour toi ?']

export function ChatThread({
  friend, isFriend, messages, meId, myVinyls, statusOf, coversOf,
  onSend, onRetry, onMarkRead, onAddVinyl, onBack, onOpenFriend, offline,
}) {
  const [text, setText] = useState('')
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState(null)
  const textRef = useRef(null)
  const scrollRef = useRef(null)
  const firstScroll = useRef(true)

  // Arrivée : tout en bas sans animation ; nouveaux messages : en douceur
  const count = messages.length
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? 'instant' : 'smooth' })
    firstScroll.current = false
  }, [count])

  // Messages reçus : marqués comme lus dès qu'ils sont affichés
  const unseen = messages.some((m) => m.sender === friend.id && !m.read_at)
  useEffect(() => {
    if (unseen && document.visibilityState === 'visible') onMarkRead(friend.id)
  }, [unseen, friend.id, onMarkRead])

  // Zone de texte qui grandit avec le message (jusqu'à 6 lignes)
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  async function submit(payload) {
    setError(null)
    if (payload.body !== undefined) setText('')
    const res = await onSend(friend.id, payload)
    if (res?.error) setError(res.error)
    textRef.current?.focus({ preventScroll: true })
  }

  function onKeyDown(e) {
    // Entrée envoie sur ordinateur ; Maj+Entrée pour aller à la ligne
    const desktop = window.matchMedia('(hover: hover)').matches
    if (e.key === 'Enter' && !e.shiftKey && desktop && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (text.trim()) submit({ body: text })
    }
  }

  const groups = useMemo(() => {
    const out = []
    for (const m of messages) {
      const d = new Date(m.created_at)
      const last = out[out.length - 1]
      if (!last || !sameDay(last.day, d)) out.push({ day: d, items: [m] })
      else last.items.push(m)
    }
    return out
  }, [messages])
  const lastMine = [...messages].reverse().find((m) => m.sender === meId)
  const canWrite = isFriend && !offline
  const covers = coversOf(friend.id)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* En-tête de la conversation */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-ink px-3 py-2.5 lg:bg-surface lg:px-5 lg:py-3.5">
        <button onClick={onBack} aria-label="Retour aux messages" className="rounded-full p-2 text-paper transition hover:bg-raised lg:hidden">
          <BackIcon />
        </button>
        <Avatar member={friend} size={44} ring={false} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-2xl font-black uppercase leading-none">{friend.name}</span>
          {isFriend && (
            <button onClick={() => onOpenFriend(friend.id)} className="mt-0.5 text-xs text-muted underline-offset-4 hover:text-paper hover:underline">
              Voir ses disques
            </button>
          )}
        </span>
        {isFriend && covers?.length > 0 && (
          <button
            onClick={() => onOpenFriend(friend.id)}
            title={`Les derniers souhaits de ${friend.name}`}
            className="hidden items-center gap-3 rounded-full border border-line py-1.5 pl-2 pr-4 text-xs font-medium text-muted transition hover:border-accent hover:text-paper sm:flex"
          >
            <CoverStrip covers={covers} size={24} />
            Ses souhaits
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="nice-scroll min-h-0 flex-1 overflow-y-auto px-4 lg:px-6">
        <div className="mx-auto max-w-2xl space-y-5 py-6">
          {messages.length === 0 && (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <div className="relative isolate pr-14">
                <span className="vinyl-disc absolute bottom-0 right-0 h-[5.5rem] w-[5.5rem] animate-disc ring-1 ring-line" style={{ '--disc-label': friend.color }} />
                <Avatar member={friend} size={88} ring={false} className="relative ring-4 ring-surface" />
              </div>
              <p className="mt-6 font-display text-3xl font-black uppercase leading-none">Dis bonjour à {friend.name}</p>
              {covers?.length > 0 ? (
                <button onClick={() => onOpenFriend(friend.id)} className="mt-4 flex flex-col items-center gap-2 text-sm text-muted hover:text-paper sm:flex-row sm:gap-3">
                  <CoverStrip covers={covers} size={30} />
                  Ses derniers souhaits : une idée de cadeau ?
                </button>
              ) : (
                <p className="mt-2 max-w-xs text-sm text-muted">Ou envoie-lui un de tes disques avec le bouton vinyle.</p>
              )}
              {canWrite && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {STARTERS.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setText(t)
                        textRef.current?.focus()
                      }}
                      className="rounded-full border border-line bg-surface px-4 py-2 text-sm transition hover:border-accent"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {groups.map((g, gi) => (
            <section key={`${g.day.toDateString()}-${gi}`} className="space-y-1.5">
              <p className="flex items-center gap-3 py-2 text-xs font-medium text-muted first-letter:uppercase">
                <span className="h-px flex-1 bg-line" />
                <span className="first-letter:uppercase">{dayLabel(g.day)}</span>
                <span className="h-px flex-1 bg-line" />
              </p>
              {g.items.map((m, i) => {
                const mine = m.sender === meId
                const prev = g.items[i - 1]
                const next = g.items[i + 1]
                const firstOfRun = !prev || prev.sender !== m.sender
                const lastOfRun = !next || next.sender !== m.sender
                return (
                  <div
                    key={m.id}
                    className={`msg-in flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${lastOfRun ? 'pb-2' : ''}`}
                  >
                    {/* Avatar à côté du dernier message d'une série reçue */}
                    {!mine && (
                      <span className="w-7 shrink-0">{lastOfRun && <Avatar member={friend} size={28} ring={false} />}</span>
                    )}
                    <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      {m.vinyl && <VinylMessage vinyl={m.vinyl} mine={mine} status={statusOf(m.vinyl)} onAdd={onAddVinyl} />}
                      {m.body && (
                        <p
                          className={`whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-snug ${
                            mine ? 'bg-accent text-ink' : 'border border-line bg-surface lg:bg-ink'
                          } ${
                            mine
                              ? `rounded-3xl ${firstOfRun ? '' : 'rounded-tr-md'} ${lastOfRun ? 'rounded-br-md' : 'rounded-br-md'}`
                              : `rounded-3xl ${firstOfRun ? '' : 'rounded-tl-md'} ${lastOfRun ? 'rounded-bl-md' : 'rounded-bl-md'}`
                          } ${m.pending ? 'opacity-60' : ''} ${m.vinyl ? 'mt-1.5' : ''}`}
                        >
                          {m.body}
                        </p>
                      )}
                      {m.failed ? (
                        <button onClick={() => onRetry(m)} className="mt-1 text-xs font-medium text-red-600 underline-offset-4 hover:underline">
                          Non envoyé · Réessayer
                        </button>
                      ) : (
                        lastOfRun && (
                          <span className="mt-1 px-1 text-[11px] text-muted">
                            {m.pending ? 'Envoi…' : timeLabel(new Date(m.created_at))}
                            {mine && m.id === lastMine?.id && m.read_at && ' · Vu'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </div>

      {/* Écrire */}
      <div className="shrink-0 border-t border-line bg-ink px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:bg-surface lg:px-5 lg:pb-4">
        {!isFriend ? (
          <p className="py-2 text-center text-sm text-muted">Vous n’êtes plus amis : tu ne peux plus lui écrire.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (text.trim()) submit({ body: text })
            }}
            className="relative mx-auto flex max-w-2xl items-end gap-2"
          >
            {picker && (
              <DiscPicker
                vinyls={myVinyls}
                onClose={() => setPicker(false)}
                onPick={(v) => {
                  setPicker(false)
                  submit({ vinyl: v })
                }}
              />
            )}
            <button
              type="button"
              onClick={() => setPicker((o) => !o)}
              disabled={!canWrite || myVinyls.length === 0}
              aria-label="Partager un de mes disques"
              title={myVinyls.length ? 'Partager un de mes disques' : 'Ajoute des disques à ta liste pour les partager'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
                picker ? 'border-accent bg-accent text-ink' : 'border-line text-paper hover:border-accent'
              }`}
            >
              <RecordIcon className={picker ? 'animate-rotate' : ''} />
            </button>
            <textarea
              ref={textRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={2000}
              disabled={!canWrite}
              placeholder={offline ? 'Hors-ligne' : `Écrire à ${friend.name}…`}
              aria-label="Message"
              className="nice-scroll max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-line bg-surface px-4 py-2.5 text-[15px] leading-snug outline-none transition placeholder:text-muted/70 focus:border-accent lg:bg-ink"
            />
            <button
              disabled={!canWrite || !text.trim()}
              aria-label="Envoyer"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-ink transition hover:bg-accent-soft disabled:opacity-40"
            >
              <SendIcon />
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
