import { useState } from 'react'
import { Avatar, AvatarStack } from './Avatar'
import { RoomCover, CrownIcon } from './Rooms'
import { PlusIcon } from './Icons'

const field =
  'w-full min-w-0 rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60'
const primary =
  'shrink-0 rounded-full bg-accent px-5 py-3 text-sm font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50'

const sinceLabel = (iso) => {
  const min = Math.round((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return `il y a ${d} jour${d > 1 ? 's' : ''}`
}

// Demandes reçues pour mes salons (je suis responsable) : accepter / refuser
function IncomingRequests({ list, onAnswer, offline }) {
  const [busy, setBusy] = useState(null)
  async function answer(req, accept) {
    setBusy(`${req.room_id}:${req.person.id}`)
    await onAnswer(req, accept)
    setBusy(null)
  }
  return (
    <section className="rounded-2xl border border-accent/40 bg-surface p-5" aria-labelledby="incoming-title">
      <h2 id="incoming-title" className="flex items-center gap-2 font-display text-2xl font-black uppercase">
        Demandes pour rejoindre
        <span className="rounded-full bg-coral px-2 py-0.5 font-mono text-xs font-bold text-white">{list.length}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">Ces personnes ont tapé le code d’un de tes salons. Elles n’entrent que si tu acceptes.</p>
      <ul className="mt-4 divide-y divide-line">
        {list.map((req) => {
          const key = `${req.room_id}:${req.person.id}`
          return (
            <li key={key} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar member={req.person} size={40} ring={false} />
              <p className="min-w-[10rem] flex-1 text-sm">
                <span className="font-bold">{req.person.name}</span> veut rejoindre{' '}
                <span className="font-bold">« {req.room_name} »</span>
                <span className="block text-xs text-muted">{sinceLabel(req.created_at)}</span>
              </p>
              <div className="flex w-full gap-2 pl-[3.25rem] sm:w-auto sm:pl-0">
                <button
                  onClick={() => answer(req, false)}
                  disabled={offline || busy === key}
                  className="flex-1 rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-red-400 sm:flex-none hover:text-red-500 disabled:opacity-50"
                >
                  Refuser
                </button>
                <button
                  onClick={() => answer(req, true)}
                  disabled={offline || busy === key}
                  className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50 sm:flex-none"
                >
                  {busy === key ? '…' : 'Accepter'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Mes demandes envoyées, en attente de réponse
function MyRequests({ list, onCancel }) {
  return (
    <section aria-labelledby="mine-title">
      <h2 id="mine-title" className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">En attente de réponse</h2>
      <ul className="space-y-2">
        {list.map((req) => (
          <li key={req.room_id} className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
            <RoomCover room={req.room} size="2.75rem" className="shrink-0 rounded-lg text-lg" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-bold">« {req.room_name} »</span>
              <span className="block text-xs text-muted">
                {req.owner_name ? `${req.owner_name} doit accepter ta demande` : 'Le responsable doit accepter ta demande'} · {sinceLabel(req.created_at)}
              </span>
            </p>
            <button onClick={() => onCancel(req)} className="shrink-0 text-sm font-medium text-muted underline-offset-4 transition hover:text-paper hover:underline">
              Annuler
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Page « Salons » : mes salons en grandes pochettes, + rejoindre / créer.
// onJoin(code) et onCreate(name) renvoient un message d'erreur ou null.
// requests : { mine, incoming } — demandes pour rejoindre (envoyées / reçues)
export default function RoomsPage({
  rooms, meId, onOpen, onJoin, onCreate, requests = { mine: [], incoming: [] }, onAnswer, onCancelRequest, offline,
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  async function run(key, action) {
    setBusy(key)
    setError(null)
    const err = await action()
    setBusy(null)
    if (err) setError(err)
    else {
      setCode('')
      setName('')
    }
  }

  return (
    <div className="space-y-10">
      {requests.incoming.length > 0 && <IncomingRequests list={requests.incoming} onAnswer={onAnswer} offline={offline} />}
      {requests.mine.length > 0 && <MyRequests list={requests.mine} onCancel={onCancelRequest} />}
      {rooms.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rooms.map((r) => (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="group block w-full text-left">
                <span className="relative block">
                  {/* Le vinyle sort de la pochette au survol, comme d'un bac */}
                  <span
                    aria-hidden="true"
                    className="vinyl-disc absolute inset-y-[4%] right-0 aspect-square transition-transform duration-500 ease-out group-hover:translate-x-[22%] group-focus-visible:translate-x-[22%]"
                  />
                  <RoomCover
                    room={r}
                    size="100%"
                    className="relative aspect-square !h-auto !w-full rounded-xl text-[clamp(2.5rem,9vw,4.5rem)] shadow-[0_14px_30px_-16px_rgba(0,0,0,0.6)]"
                  />
                </span>
                <span className="mt-3 flex items-center gap-1.5">
                  <span className="truncate font-display text-xl font-black uppercase leading-tight">{r.name}</span>
                  {r.owner_id === meId && (
                    <span title="Tu es responsable de ce salon" className="shrink-0 text-accent">
                      <CrownIcon />
                    </span>
                  )}
                </span>
                <span className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <AvatarStack members={r.members} size={20} max={5} />
                  {r.members.length} membre{r.members.length > 1 ? 's' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-line px-6 py-12 text-center">
          <div className="vinyl-disc mx-auto h-20 w-20 animate-slow-spin" style={{ '--disc-label': '#6aa6d6' }} />
          <p className="mt-5 font-display text-2xl font-black uppercase">Aucun salon pour l’instant</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Un salon met en commun les souhaits et les collections de plusieurs personnes. Crée le tien ou entre le code
            qu’on t’a donné.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) run('join', () => onJoin(code))
          }}
          className="rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="font-display text-2xl font-black uppercase">Rejoindre un salon</h2>
          <p className="mt-1 text-sm text-muted">Entre le code qu’on t’a envoyé : le responsable du salon recevra ta demande.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="K7-4QZ"
              aria-label="Code du salon"
              autoComplete="off"
              autoCapitalize="characters"
              disabled={offline}
              className={`${field} font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal`}
            />
            <button disabled={offline || !!busy || !code.trim()} className={primary}>
              {busy === 'join' ? '…' : 'Demander'}
            </button>
          </div>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) run('create', () => onCreate(name.trim()))
          }}
          className="rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="font-display text-2xl font-black uppercase">Créer un salon</h2>
          <p className="mt-1 text-sm text-muted">Tu recevras un code à donner aux personnes à inviter.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Famille, les potes…"
              aria-label="Nom du salon"
              maxLength={40}
              disabled={offline}
              className={field}
            />
            <button disabled={offline || !!busy || !name.trim()} className={`${primary} flex items-center gap-1.5`}>
              <PlusIcon width={16} height={16} />
              {busy === 'create' ? '…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {offline && <p className="text-sm text-muted">Hors-ligne : rejoindre ou créer un salon est indisponible.</p>}
    </div>
  )
}