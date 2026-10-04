import { useEffect, useMemo, useRef, useState } from 'react'
import { tasteBatch, peopleSuggestions, mergeSuggestions, verifyVinyl, knownVinyl, albumKeys, norm } from '../lib/suggest'
import { usePlayer, toggle } from '../lib/player'
import { Avatar } from './Avatar'
import { CheckIcon, PlusIcon } from './Icons'

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
)
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
  </svg>
)

function SuggestionCard({ s, status, onAdd }) {
  const player = usePlayer()
  const [busy, setBusy] = useState(null)
  const v = s.item
  const album = { key: s.key, title: v.title, artist: v.artist, cover_url: v.cover_url, deezerId: v.deezer_id }
  const current = player.album?.key === album.key
  const playing = current && (player.status === 'playing' || player.status === 'loading')

  async function add(st) {
    setBusy(st)
    await onAdd(s, st)
    setBusy(null)
  }

  return (
    <li className="w-44 shrink-0 snap-start sm:w-48">
      <div className="group relative">
        <span
          aria-hidden="true"
          className={`vinyl-disc absolute right-[5%] top-[5%] h-[90%] w-[90%] transition-transform duration-500 group-hover:translate-x-[24%] ${
            playing ? 'translate-x-[24%] animate-[rotate-disc_1.8s_linear_infinite]' : ''
          }`}
        />
        {v.cover_url ? (
          <img src={v.cover_url} alt="" loading="lazy" className="relative aspect-square w-full rounded-lg object-cover shadow-md" />
        ) : (
          <span className="relative block aspect-square w-full rounded-lg bg-raised" />
        )}
        {player.enabled && (
          <button
            onClick={() => toggle(album)}
            data-player-control
            aria-label={playing ? 'Mettre en pause' : `Écouter un extrait de ${v.title}`}
            className={`absolute bottom-2 left-2 flex h-10 w-10 items-center justify-center rounded-full bg-ink/90 text-paper shadow-lg backdrop-blur transition hover:scale-105 ${
              playing ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'
            }`}
          >
            {current && player.status === 'loading' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
            ) : playing ? (
              <PauseIcon />
            ) : (
              <PlayIcon />
            )}
          </button>
        )}
      </div>
      <p className="mt-3 truncate text-sm font-bold">{v.title}</p>
      <p className="truncate text-xs text-muted">
        {v.artist}
        {v.year ? ` · ${v.year}` : ''}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-tight text-muted">
        {s.people?.length > 0 && <Avatar member={s.people[0]} size={16} ring={false} />}
        <span className="line-clamp-2">{s.reason}</span>
      </p>
      {current && player.status === 'unavailable' && <p className="mt-1 text-[11px] text-muted">Pas d’extrait trouvé.</p>}
      <div className="mt-2.5">
        {status ? (
          <span className="flex items-center gap-1 text-xs text-muted">
            <CheckIcon width={14} height={14} /> {status === 'owned' ? 'Dans ta collection' : 'Dans tes souhaits'}
          </span>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => add('wish')}
              disabled={!!busy}
              className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
            >
              <PlusIcon width={13} height={13} /> {busy === 'wish' ? '…' : 'Souhait'}
            </button>
            <button
              onClick={() => add('owned')}
              disabled={!!busy}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium transition hover:border-accent disabled:opacity-50"
            >
              {busy === 'owned' ? '…' : 'Je l’ai'}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

const PAGE = 10 // cartes par page
const PEOPLE_PER_PAGE = 3 // dont disques de mes proches, au plus

const Ghost = () => (
  <li aria-hidden="true" className="w-44 shrink-0 animate-shimmer sm:w-48">
    <div className="aspect-square rounded-lg bg-raised" />
    <div className="mt-3 h-3.5 w-3/4 rounded bg-raised" />
    <div className="mt-2 h-3 w-1/2 rounded bg-raised" />
  </li>
)

// « Pour toi » : suggestions d'après mes souhaits, ma collection et mes proches.
// others : [{ vinyl, person }] disques de mes amis et des membres de mes salons.
// Les albums trouvés sur Deezer ne s'affichent qu'une fois vérifiés sur Discogs
// (ils existent en vinyle et ne sont pas déjà chez moi).
// « Autres idées » passe à des disques jamais montrés ; on va chercher plus
// loin (fournée suivante) quand il en reste peu.
export default function Suggestions({ myItems, others, statusOf, onAdd, online }) {
  const [batches, setBatches] = useState([]) // fournées Deezer déjà chargées
  const [want, setWant] = useState(1) // combien de fournées on veut
  const [batchLoading, setBatchLoading] = useState(false)
  const [error, setError] = useState(null)
  const [round, setRound] = useState(0)
  const [seen, setSeen] = useState(() => new Set()) // déjà montrés (pages précédentes)
  const [restarted, setRestarted] = useState(false)
  const [checked, setChecked] = useState(() => new Map()) // deezer_id → fiche vinyle Discogs ou null
  const [checking, setChecking] = useState(false)
  // Ajoutés depuis cette liste : on les garde affichés (avec « Dans tes souhaits »)
  const [added, setAdded] = useState(() => new Set())

  async function add(s, st) {
    const keys = [...albumKeys(s.vinyl), ...albumKeys(s.item)]
    setAdded((a) => new Set([...a, ...keys])) // avant l'ajout, pour que la carte ne saute pas
    const res = await onAdd(s.vinyl, st)
    if (!res) {
      setAdded((a) => {
        const n = new Set(a)
        keys.forEach((k) => n.delete(k))
        return n
      })
    }
    return res
  }

  // Mes goûts ne changent qu'avec mes disques : on repart de zéro seulement dans ce cas
  const tasteSig = useMemo(
    () => myItems.map((v) => `${v.discogs_type}:${v.discogs_id}:${v.status}`).sort().join(','),
    [myItems]
  )
  const itemsRef = useRef(myItems)
  itemsRef.current = myItems
  useEffect(() => {
    setBatches([])
    setWant(1)
    setError(null)
  }, [tasteSig])

  // Charger la fournée suivante quand on en veut une de plus
  const more = batches.length === 0 || batches[batches.length - 1].more
  useEffect(() => {
    if (!online || myItems.length === 0 || batchLoading || batches.length >= want || !more) return
    let cancelled = false
    setBatchLoading(true)
    tasteBatch(itemsRef.current, batches.length)
      .then((b) => !cancelled && (setBatches((list) => [...list, b]), setError(null)))
      .catch((e) => !cancelled && (setError(e.message), setWant(batches.length))) // on arrête là
      .finally(() => !cancelled && setBatchLoading(false))
    return () => {
      cancelled = true
      setBatchLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, batches.length, online, more, tasteSig])

  // Mes disques, sauf ceux que je viens d'ajouter d'ici
  const mine = useMemo(() => myItems.filter((v) => !albumKeys(v).some((k) => added.has(k))), [myItems, added])

  // Les pistes venues de mes goûts (toutes les fournées, dans l'ordre), sans ce que j'ai déjà
  const tasteCandidates = useMemo(
    () => mergeSuggestions([batches.flatMap((b) => b.items)], mine, 1000),
    [batches, mine]
  )
  // Ce qu'ont mes proches, en commençant par les artistes que j'écoute
  const peopleCandidates = useMemo(() => {
    const myArtists = new Set(myItems.map((v) => norm(v.artist)))
    return mergeSuggestions([peopleSuggestions(others, myArtists)], mine, 60)
  }, [others, myItems, mine])

  // Vérification sur Discogs des albums venus de Deezer (gardée 14 jours).
  // Si Discogs ne répond pas, on réessaie un peu plus tard.
  const [retry, setRetry] = useState(0)
  const [failed, setFailed] = useState(0)
  const [errored, setErrored] = useState(() => new Set()) // Discogs n'a pas répondu pour ceux-là
  useEffect(() => {
    if (!online) return
    let cancelled = false
    let timer
    const fromCache = new Map()
    const todo = []
    for (const s of tasteCandidates) {
      const known = knownVinyl(s.item)
      if (known) fromCache.set(s.item.deezer_id, known.vinyl)
      else todo.push(s.item)
    }
    if (fromCache.size) setChecked((m) => new Map([...m, ...fromCache]))
    setChecking(todo.length > 0)
    let left = todo.length
    let errors = 0
    todo.forEach((item) =>
      verifyVinyl(item)
        .then((d) => !cancelled && setChecked((m) => new Map(m).set(item.deezer_id, d)))
        .catch(() => {
          errors++
          if (!cancelled) setErrored((e) => new Set(e).add(item.deezer_id))
        })
        .finally(() => {
          if (cancelled || --left > 0) return
          setChecking(false)
          setFailed(errors)
          if (errors && retry < 3)
            timer = setTimeout(() => {
              setErrored(new Set())
              setRetry((r) => r + 1)
            }, 30000)
        })
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tasteCandidates, online, retry])

  // Déjà chez moi ?
  const statusByKey = useMemo(() => {
    const m = new Map()
    for (const v of myItems) albumKeys(v).forEach((k) => m.set(k, v.status))
    return m
  }, [myItems])

  // Ce qui reste à montrer (vérifié, pas chez moi, jamais montré)
  const pool = useMemo(() => {
    const mineKeys = new Set(mine.flatMap(albumKeys))
    const mineIds = new Set(mine.map((v) => `${v.discogs_type || 'master'}:${v.discogs_id}`))
    const taken = new Set()
    const keep = (s, vinyl) => {
      if (!vinyl) return null // pas encore vérifié, ou pas de vinyle
      const id = `${vinyl.discogs_type || 'master'}:${vinyl.discogs_id}`
      const keys = [id, ...albumKeys(vinyl), ...albumKeys(s.item)]
      if (mineIds.has(id) || keys.some((k) => mineKeys.has(k) || taken.has(k))) return null
      keys.forEach((k) => taken.add(k))
      if (keys.some((k) => seen.has(k))) return null
      return { ...s, vinyl, keys }
    }
    return {
      taste: tasteCandidates.map((s) => keep(s, checked.get(s.item.deezer_id))).filter(Boolean),
      people: peopleCandidates.map((s) => keep(s, s.item)).filter(Boolean),
      // Pistes pas encore vérifiées et jamais montrées : elles arriveront bientôt
      waiting: tasteCandidates.filter((s) => !checked.has(s.item.deezer_id) && !errored.has(s.item.deezer_id)).length,
    }
  }, [tasteCandidates, peopleCandidates, checked, errored, mine, seen])

  // La page affichée : on la fige au moment où on change de page, puis on la
  // complète au fur et à mesure que des idées sont vérifiées (sans tout mélanger)
  const [frozen, setFrozen] = useState({ page: '', items: [] })
  const pageId = `${round}|${tasteSig}`
  const shown = frozen.page === pageId ? frozen.items : []
  const list = useMemo(() => {
    const out = [...shown]
    const has = new Set(out.flatMap((s) => s.keys))
    const fresh = (s) => !s.keys.some((k) => has.has(k))
    const people = pool.people.filter(fresh)
    let peopleCount = out.filter((s) => s.item.discogs_id && s.people).length
    for (const s of pool.taste.filter(fresh)) {
      if (out.length >= PAGE) break
      // Un disque d'un proche toutes les 3-4 cartes
      if (peopleCount < PEOPLE_PER_PAGE && people.length && out.length % 4 === 3) {
        out.push(people.shift())
        peopleCount++
        if (out.length >= PAGE) break
      }
      out.push(s)
    }
    // Plus rien à venir d'après mes goûts : on complète avec mes proches
    // (tant que des idées arrivent, ils gardent leur place, une carte sur quatre)
    const coming = pool.waiting > 0 || batchLoading || (more && !error && pool.taste.length < PAGE)
    while (out.length < PAGE && people.length && !coming) {
      out.push(people.shift())
      peopleCount++
    }
    return out
  }, [shown, pool, batchLoading, more, error])
  useEffect(() => {
    if (list.length !== shown.length) setFrozen({ page: pageId, items: list })
  }, [list, shown.length, pageId])

  // Il reste peu d'idées d'avance : on prépare la fournée suivante
  const ahead = pool.taste.length - list.filter((s) => !s.item.discogs_id).length + pool.waiting
  useEffect(() => {
    if (ahead < PAGE * 2 && more && want <= batches.length) setWant(batches.length + 1)
  }, [ahead, more, want, batches.length])

  // La page suivante est-elle prête ? (sinon le bouton attend, plutôt que d'afficher une page vide)
  const onPage = new Set(list.flatMap((s) => s.keys))
  const notOnPage = (s) => !s.keys.some((k) => onPage.has(k))
  const nextReady = pool.taste.filter(notOnPage).length + Math.min(PEOPLE_PER_PAGE, pool.people.filter(notOnPage).length)
  const stillComing = pool.waiting > 0 || batchLoading || (more && !error)
  const canAdvance = nextReady >= Math.min(6, PAGE) || !stillComing

  function otherIdeas() {
    if (!canAdvance) return
    const nextSeen = new Set(seen)
    list.forEach((s) => s.keys.forEach((k) => nextSeen.add(k)))
    const leftTaste = pool.taste.filter((s) => !s.keys.some((k) => nextSeen.has(k))).length
    const leftPeople = pool.people.filter((s) => !s.keys.some((k) => nextSeen.has(k))).length
    // Tout vu, rien d'autre à aller chercher : on recommence depuis le début
    if (!leftTaste && !leftPeople && !pool.waiting && !more) {
      setSeen(new Set())
      setRestarted(true)
    } else {
      setSeen(nextSeen)
      setRestarted(false)
    }
    setRound((r) => r + 1)
  }

  if (myItems.length === 0) return null
  const busy = batchLoading || pool.waiting > 0
  const loading = online && list.length === 0 && (busy || (batches.length === 0 && !error))
  const ghosts = online && !loading && busy ? Math.max(0, PAGE - list.length) : 0
  const tasteShown = list.some((s) => !s.item.discogs_id)

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-black uppercase leading-none sm:text-4xl">Pour toi</h2>
          <p className="mt-1.5 text-sm text-muted">D’après tes souhaits, ta collection et ce qu’ont tes proches.</p>
        </div>
        {list.length > 0 && (
          <button
            onClick={otherIdeas}
            disabled={!canAdvance}
            aria-busy={!canAdvance}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium transition hover:border-accent disabled:cursor-wait disabled:opacity-60 disabled:hover:border-line"
          >
            <span className={canAdvance ? '' : 'animate-spin'}>
              <RefreshIcon />
            </span>
            {canAdvance ? 'Autres idées' : 'Je cherche…'}
          </button>
        )}
      </div>

      {loading ? (
        <ul className="no-scrollbar -mx-5 flex gap-4 overflow-hidden px-5 sm:mx-0 sm:px-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Ghost key={i} />
          ))}
        </ul>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">
          {error
            ? `Suggestions indisponibles pour le moment (${error}).`
            : !online
              ? 'Reconnecte-toi pour voir des suggestions.'
              : 'Ajoute quelques disques de plus pour avoir des suggestions.'}
        </p>
      ) : (
        <ul key={round} className="no-scrollbar page-in -mx-5 flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0">
          {list.map((s) => (
            <SuggestionCard
              key={s.key}
              s={s}
              status={statusOf(s.vinyl) || albumKeys(s.vinyl).map((k) => statusByKey.get(k)).find(Boolean) || null}
              onAdd={add}
            />
          ))}
          {Array.from({ length: ghosts }).map((_, i) => (
            <Ghost key={`ghost-${i}`} />
          ))}
        </ul>
      )}
      {restarted && <p className="text-xs text-muted">Tu as fait le tour de tes suggestions : on reprend depuis le début.</p>}
      {!busy && failed > 0 && !tasteShown && list.length > 0 && (
        <p className="text-xs text-muted">Discogs ne répond pas pour l’instant : les idées d’après tes goûts arrivent dans un moment.</p>
      )}
    </section>
  )
}