import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { useToasts } from './hooks/useToasts'
import { useAuth } from './hooks/useAuth'
import { useRooms, previewRoom } from './hooks/useRooms'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import {
  mergeItems, filterByPerson, filterAndSort, getGenres, getTotals,
} from './lib/listUtils'
import { getDetails, itemKey } from './lib/discogs'
import { readCache, writeCache, readJSON, writeJSON, CONTEXT_KEY } from './lib/cache'
import { copyToClipboard } from './lib/share'
import Hero from './components/Hero'
import Marquee from './components/Marquee'
import ShelfTabs from './components/ShelfTabs'
import ListSummary from './components/ListSummary'
import ListToolbar from './components/ListToolbar'
import SearchPanel from './components/SearchPanel'
import VinylCard from './components/VinylCard'
import VinylDetail from './components/VinylDetail'
import ShareDialog from './components/ShareDialog'
import AuthDialog from './components/AuthDialog'
import Toasts from './components/Toasts'
import InstallBanner from './components/InstallBanner'
import OfflineBanner from './components/OfflineBanner'
import { RoomPicker, RoomBar } from './components/Rooms'
import { ConfirmDialog, NoteDialog } from './components/Dialogs'
import { ShareIcon } from './components/Icons'

const topBtn =
  'rounded-md border border-ink/40 px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-ink hover:text-accent'

// Lien d'invitation : https://…/?salon=K7-4QZ
const inviteFromUrl = () => new URLSearchParams(window.location.search).get('salon')
const inviteUrl = (code) => `${window.location.origin}/?salon=${encodeURIComponent(code)}`
function clearInviteFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('salon')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

export default function App() {
  const auth = useAuth()
  const { me, user } = auth
  const userId = user?.id ?? null
  const { rooms, loaded: roomsLoaded, reload: reloadRooms, ...roomActions } = useRooms(userId)
  const { toasts, toast } = useToasts()
  const online = useOnlineStatus()
  const install = useInstallPrompt()
  const wasOffline = useRef(false)

  const [items, setItems] = useState(readCache)
  const [loading, setLoading] = useState(() => readCache().length === 0)
  const [contextId, setContextId] = useState(() => readJSON(CONTEXT_KEY, 'me'))
  const [tab, setTab] = useState('wish')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [genre, setGenre] = useState('')
  const [person, setPerson] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [leaveTarget, setLeaveTarget] = useState(null)
  const [detailKey, setDetailKey] = useState(null)
  const [refreshing, setRefreshing] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [authMode, setAuthMode] = useState(null) // null = fenêtre fermée
  const [inviteCode, setInviteCode] = useState(inviteFromUrl)
  const [invite, setInvite] = useState(null)

  const room = contextId !== 'me' ? rooms.find((r) => r.id === contextId) ?? null : null

  // --- Espace affiché (mon espace ou un salon), mémorisé sur l'appareil ---
  useEffect(() => {
    writeJSON(CONTEXT_KEY, contextId)
  }, [contextId])

  // Le salon a disparu (quitté depuis un autre appareil…) -> retour à mon espace
  useEffect(() => {
    if (contextId !== 'me' && roomsLoaded && !room) setContextId('me')
  }, [contextId, roomsLoaded, room])

  function selectContext(id) {
    setContextId(id)
    setPerson('')
    setGenre('')
    setSearch('')
  }

  // --- Chargement, temps réel, resynchronisation ---
  // La base ne renvoie que mes disques et ceux des membres de mes salons
  const loadVinyls = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('vinyls')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // Hors-ligne : le bandeau explique déjà la situation, on garde la liste en mémoire
      if (navigator.onLine) toast(error.message, 'error')
    } else {
      setItems(data)
    }
    setLoading(false)
  }, [userId, toast])

  useEffect(() => {
    if (!userId) return
    if (readCache().length === 0) setLoading(true)
    loadVinyls()

    const channel = supabase
      .channel(`vinyls-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vinyls' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) =>
              prev.some((v) => v.id === payload.new.id) ? prev : [payload.new, ...prev]
            )
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) => prev.map((v) => (v.id === payload.new.id ? payload.new : v)))
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((v) => v.id !== payload.old.id))
          }
        }
      )
      // Quelqu'un rejoint ou quitte un de mes salons : on recharge tout
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members' },
        () => {
          reloadRooms()
          loadVinyls()
        }
      )
      .subscribe()

    // Pendant une coupure ou une mise en veille, des événements ont pu être manqués
    const resync = () => {
      reloadRooms()
      loadVinyls()
    }
    const onVisible = () => document.visibilityState === 'visible' && resync()
    window.addEventListener('online', resync)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('online', resync)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [userId, loadVinyls, reloadRooms])

  // Déconnecté : on vide l'écran
  useEffect(() => {
    if (auth.ready && !userId) {
      setItems([])
      setLoading(false)
      setContextId('me')
    }
  }, [auth.ready, userId])

  // Mémorise la liste pour le mode hors-ligne
  useEffect(() => {
    if (userId && !loading) writeCache(items)
  }, [items, loading, userId])

  // Message au retour du réseau
  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      toast('De retour en ligne')
    }
  }, [online, toast])

  // --- Invitation par lien (?salon=CODE) ---
  useEffect(() => {
    if (!inviteCode || !auth.ready) return
    let cancelled = false

    if (!userId) {
      // Pas encore de compte : on montre qui invite, puis l'inscription
      previewRoom(inviteCode).then((p) => {
        if (cancelled) return
        if (p) {
          setInvite(p)
          setAuthMode((m) => m ?? 'signup')
        } else {
          toast("Ce lien d'invitation ne correspond à aucun salon", 'error')
          setInviteCode(null)
          clearInviteFromUrl()
        }
      })
    } else {
      roomActions.join(inviteCode).then(({ room: joined, error }) => {
        if (cancelled) return
        clearInviteFromUrl()
        setInviteCode(null)
        setInvite(null)
        if (error) toast(error, 'error')
        else {
          selectContext(joined.id)
          toast(`Bienvenue dans « ${joined.name} »`)
        }
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, auth.ready, userId])

  // --- Ma liste perso (la même dans tous les espaces) ---
  const myItems = useMemo(() => items.filter((v) => v.owner_id === userId), [items, userId])
  const myByKey = useMemo(() => new Map(myItems.map((v) => [itemKey(v), v])), [myItems])
  const statusOf = (item) => myByKey.get(itemKey(item))?.status ?? null

  function ensureOnline() {
    if (navigator.onLine) return true
    toast('Tu es hors-ligne : modification impossible pour le moment', 'error')
    return false
  }

  // --- Actions (toujours sur MES disques) ---
  async function addItem(item, status) {
    if (!ensureOnline()) return
    // On récupère genres et prix ; si Discogs ne répond pas, l'ajout continue quand même
    let extra = {}
    try {
      const d = await getDetails(item)
      extra = {
        genres: d.genres,
        styles: d.styles,
        lowest_price: d.lowest_price,
        num_for_sale: d.num_for_sale,
        price_updated_at: new Date().toISOString(),
      }
    } catch {
      // pas de détails pour cette fois
    }

    const { data, error } = await supabase
      .from('vinyls')
      .insert({
        discogs_id: item.discogs_id,
        discogs_type: item.discogs_type || 'master',
        artist: item.artist,
        title: item.title,
        year: item.year,
        cover_url: item.cover_url,
        kind: item.kind,
        owner_id: userId,
        added_by: me.name,
        status,
        owned_at: status === 'owned' ? new Date().toISOString() : null,
        ...extra,
      })
      .select()
      .single()

    if (error) {
      toast(error.code === '23505' ? 'Ce disque est déjà dans ta liste.' : error.message, 'error')
      return
    }
    setItems((prev) => (prev.some((v) => v.id === data.id) ? prev : [data, ...prev]))
    toast(`« ${data.title} » ajouté à ${status === 'wish' ? 'tes souhaits' : 'ta collection'}`)
  }

  async function updateVinyl(id, patch) {
    if (!ensureOnline()) return null
    const { data, error } = await supabase
      .from('vinyls')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      toast(error.message, 'error')
      return null
    }
    setItems((prev) => prev.map((v) => (v.id === data.id ? data : v)))
    return data
  }

  // Un souhait exaucé : il passe dans ma collection
  async function gotIt(mine) {
    if (!mine) return
    const data = await updateVinyl(mine.id, {
      status: 'owned',
      owned_at: new Date().toISOString(),
    })
    if (data) toast(`« ${data.title} » rejoint ta collection`)
  }

  // Enregistre en base les infos fraîches venues de Discogs (mes disques seulement)
  async function syncDetails(mine, d) {
    if (mine.owner_id !== userId || !navigator.onLine) return
    await updateVinyl(mine.id, {
      genres: d.genres,
      styles: d.styles,
      lowest_price: d.lowest_price,
      num_for_sale: d.num_for_sale,
      price_updated_at: new Date().toISOString(),
    })
  }

  // Complète mes disques sans infos ; sinon actualise tous mes prix
  async function refreshInfos() {
    if (!ensureOnline()) return
    const stale = myItems.filter((v) => !v.price_updated_at)
    const targets = stale.length ? stale : myItems
    let failed = 0

    for (let i = 0; i < targets.length; i++) {
      setRefreshing({ done: i + 1, total: targets.length })
      try {
        const d = await getDetails(targets[i])
        await syncDetails(targets[i], d)
      } catch {
        failed++
      }
      // Pause pour respecter la limite de 60 requêtes/minute de Discogs
      await new Promise((r) => setTimeout(r, 1200))
    }

    setRefreshing(null)
    if (failed) toast(`${failed} disque(s) n'ont pas pu être mis à jour`, 'error')
    else toast('Infos et prix à jour')
  }

  async function confirmNote(note) {
    const data = await updateVinyl(noteTarget.myItem.id, { note: note || null })
    if (data) toast('Note enregistrée')
    setNoteTarget(null)
  }

  async function confirmDelete() {
    if (!ensureOnline()) {
      setDeleteTarget(null)
      return
    }
    const id = deleteTarget.myItem.id
    const { error } = await supabase.from('vinyls').delete().eq('id', id)
    if (error) toast(error.message, 'error')
    else {
      setItems((prev) => prev.filter((v) => v.id !== id))
      toast('Disque retiré de ta liste')
    }
    setDeleteTarget(null)
  }

  // --- Salons ---
  async function joinRoom(code) {
    const { room: joined, error } = await roomActions.join(code)
    if (error) return error
    selectContext(joined.id)
    loadVinyls()
    toast(`Bienvenue dans « ${joined.name} »`)
    return null
  }

  async function createRoom(name) {
    const { room: created, error } = await roomActions.create(name)
    if (error) return error
    selectContext(created.id)
    toast(`Salon créé : donne le code ${created.code} à tes proches`)
    return null
  }

  async function confirmLeave() {
    const target = leaveTarget
    setLeaveTarget(null)
    if (!ensureOnline()) return
    const { error } = await roomActions.leave(target.id)
    if (error) return toast(error, 'error')
    selectContext('me')
    loadVinyls()
    toast(`Tu as quitté « ${target.name} »`)
  }

  async function copyInvite() {
    const ok = await copyToClipboard(inviteUrl(room.code))
    toast(
      ok ? "Lien d'invitation copié, envoie-le à qui tu veux" : `Code du salon : ${room.code}`,
      ok ? 'success' : 'error'
    )
  }

  // --- Connexion ---
  async function handleSignIn(email, password) {
    const err = await auth.signIn(email, password)
    if (!err) setAuthMode(null)
    return err
  }

  async function handleSignUp(fields) {
    const redirectTo = inviteCode ? inviteUrl(inviteCode) : window.location.origin
    const res = await auth.signUp({ ...fields, redirectTo })
    if (!res.error && !res.needsConfirmation) setAuthMode(null)
    return res
  }

  async function handleUpdatePassword(password) {
    const err = await auth.updatePassword(password)
    if (!err) toast('Mot de passe modifié')
    return err
  }

  async function handleSignOut() {
    await auth.signOut()
    selectContext('me')
    toast('À bientôt !')
  }

  // --- Données dérivées ---
  const members = useMemo(() => (room ? room.members : me ? [me] : []), [room, me])
  const lists = useMemo(
    () => ({
      wish: mergeItems(items, members, 'wish', userId),
      owned: mergeItems(items, members, 'owned', userId),
    }),
    [items, members, userId]
  )
  const all = lists[tab]
  const sharedCount = room ? all.filter((v) => v.owners.length > 1).length : 0
  const memberChips = room
    ? room.members.map((m) => ({
        ...m,
        count: all.filter((v) => v.owners.some((o) => o.id === m.id)).length,
      }))
    : null

  // Un filtre qui ne correspond plus à rien s'annule tout seul
  const genres = useMemo(() => getGenres(all), [all])
  const activeGenre = genres.some((g) => g.name === genre) ? genre : ''
  const activePerson =
    person === '__shared'
      ? sharedCount > 0 ? person : ''
      : members.some((m) => m.id === person) ? person : ''
  const hasFilters = !!(search.trim() || activeGenre || activePerson)

  const visible = useMemo(
    () => filterAndSort(filterByPerson(all, activePerson), { sort, search, genre: activeGenre }),
    [all, activePerson, sort, search, activeGenre]
  )
  const totals = useMemo(() => getTotals(visible), [visible])
  const artistNames = useMemo(
    () => [...new Set([...lists.wish, ...lists.owned].map((v) => v.artist))].slice(0, 24),
    [lists]
  )
  const myCounts = {
    wish: myItems.filter((v) => v.status === 'wish').length,
    owned: myItems.filter((v) => v.status === 'owned').length,
  }
  const missingCount = myItems.filter((v) => !v.price_updated_at).length
  const detailVinyl = detailKey ? all.find((v) => v.key === detailKey) : null

  function resetFilters() {
    setSearch('')
    setGenre('')
    setPerson('')
  }

  // --- Écrans ---
  const authDialog = (authMode || auth.recovering) && (
    <AuthDialog
      key={auth.recovering ? 'recovery' : authMode}
      initialMode={auth.recovering ? 'recovery' : authMode}
      invite={invite}
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onReset={auth.resetPassword}
      onUpdatePassword={handleUpdatePassword}
      onClose={auth.recovering ? undefined : () => setAuthMode(null)}
    />
  )

  if (!auth.ready) {
    return <div className="min-h-screen bg-accent" />
  }

  if (!user) {
    return (
      <div className="min-h-screen pb-20">
        <OfflineBanner online={online} />
        <Hero
          topRight={
            <button onClick={() => setAuthMode('login')} className={topBtn}>
              Se connecter
            </button>
          }
        />
        <main className="mx-auto max-w-5xl px-5 pt-14">
          <div className="animate-pop rounded-3xl border border-line bg-surface p-6 shadow-[0_10px_30px_-18px_rgba(27,36,32,0.4)] sm:p-8">
            <ul className="grid gap-6 sm:grid-cols-3">
              {[
                ['#ec5b3e', 'Tes souhaits', 'Les disques que tu veux, avec ton niveau d’envie et le prix le plus bas du moment.'],
                ['#f1c04e', 'Ta collection', 'Ce que tu as déjà. « Je l’ai » fait passer un souhait exaucé dans ta collection.'],
                ['#6aa6d6', 'Des salons', 'Avec un code, mets tout en commun avec ta moitié, tes amis ou ta famille.'],
              ].map(([color, title, text]) => (
                <li key={title}>
                  <div className="vinyl-disc h-12 w-12" style={{ '--disc-label': color }} />
                  <p className="mt-4 font-display text-2xl font-black uppercase leading-none">{title}</p>
                  <p className="mt-2 text-sm text-muted">{text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setAuthMode('signup')}
                className="rounded-full bg-accent px-6 py-3 font-bold text-ink transition hover:bg-accent-soft"
              >
                Créer mon compte
              </button>
              <button
                onClick={() => setAuthMode('login')}
                className="rounded-full border border-line px-6 py-3 font-medium transition hover:border-accent hover:bg-raised"
              >
                J'ai déjà un compte
              </button>
            </div>
          </div>
        </main>
        {authDialog}
        <Toasts toasts={toasts} />
      </div>
    )
  }

  const context = room ?? { kind: 'me', me }
  const listLabel = tab === 'wish' ? 'Souhaits' : 'Collection'
  const summaryLabel = hasFilters
    ? 'Valeur de la sélection'
    : {
        wish: room ? 'Pour tout offrir au salon' : 'Valeur de mes souhaits',
        owned: room ? 'Valeur de vos collections' : 'Cote de ma collection',
      }[tab]
  const emptyText = {
    wish: room
      ? ['Aucun souhait dans ce salon', 'Ajoute un disque avec la recherche : il apparaît chez toi et ici.']
      : ['Ton bac à souhaits est vide', 'Cherche un artiste plus haut pour ajouter ton premier disque.'],
    owned: room
      ? ['Aucune collection ici pour l’instant', 'Ajoute les disques que tu as déjà avec « Je l’ai » dans la recherche.']
      : ['Ta collection est vide', 'Ajoute les disques que tu as déjà avec « Je l’ai » dans la recherche.'],
  }[tab]

  const gridClass =
    'grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-10 md:grid-cols-4 md:gap-x-12'

  return (
    <div className="min-h-screen pb-20">
      <OfflineBanner online={online} />
      <Hero
        count={lists.wish.length + lists.owned.length}
        context={context}
        compact={!!room}
        topRight={
          <RoomPicker
            me={me}
            myCounts={myCounts}
            rooms={rooms}
            current={context}
            onSelect={selectContext}
            onJoin={joinRoom}
            onCreate={createRoom}
            onLogout={handleSignOut}
            offline={!online}
          />
        }
      />
      <Marquee items={artistNames} />

      <main className="mx-auto max-w-5xl space-y-12 px-5 pt-14">
        <InstallBanner mode={install.mode} onInstall={install.install} onDismiss={install.dismiss} />
        {room && (
          <RoomBar
            room={room}
            meId={userId}
            onCopyInvite={copyInvite}
            onLeave={() => setLeaveTarget(room)}
          />
        )}
        <SearchPanel
          statusOf={statusOf}
          onAdd={addItem}
          onGotIt={(item) => gotIt(myByKey.get(itemKey(item)))}
          onError={(msg) => toast(msg, 'error')}
          offline={!online}
        />

        <section>
          <ShelfTabs
            tab={tab}
            onTab={(t) => {
              setTab(t)
              setDetailKey(null)
            }}
            counts={{ wish: lists.wish.length, owned: lists.owned.length }}
            actions={
              (myItems.length > 0 || all.length > 0) && (
                <div className="flex shrink-0 items-center gap-2">
                  {myItems.length > 0 && (
                    <button
                      onClick={refreshInfos}
                      disabled={!!refreshing}
                      title="Met à jour les prix de tes disques"
                      className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-paper disabled:opacity-60"
                    >
                      {refreshing
                        ? `Mise à jour ${refreshing.done}/${refreshing.total}…`
                        : missingCount > 0
                          ? `Compléter les infos (${missingCount})`
                          : 'Actualiser les prix'}
                    </button>
                  )}
                  <button
                    onClick={() => setShareOpen(true)}
                    disabled={visible.length === 0}
                    className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-xs font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
                  >
                    <ShareIcon width={14} height={14} /> Partager
                  </button>
                </div>
              )
            }
          />

          {all.length > 0 && (
            <>
              <ListSummary
                totals={totals}
                label={summaryLabel}
                note={tab === 'wish' ? 'Somme des offres les moins chères' : 'D’après les offres les moins chères'}
              />
              <ListToolbar
                search={search}
                onSearch={setSearch}
                sort={sort}
                onSort={setSort}
                genres={genres}
                genre={activeGenre}
                onGenre={setGenre}
                person={activePerson}
                onPerson={setPerson}
                members={memberChips}
                meId={userId}
                sharedCount={sharedCount}
                mode={tab}
                hasFilters={hasFilters}
                onReset={resetFilters}
              />
            </>
          )}

          {loading ? (
            <ul className={gridClass}>
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="animate-shimmer">
                  <div className="aspect-square rounded-md bg-raised" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-raised" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-raised" />
                </li>
              ))}
            </ul>
          ) : all.length === 0 ? (
            <div className="py-16 text-center">
              <div
                className="vinyl-disc mx-auto h-24 w-24 animate-slow-spin"
                style={{ '--disc-label': tab === 'wish' ? '#ec5b3e' : '#f1c04e' }}
              />
              <p className="mt-6 font-display text-2xl font-bold uppercase">
                {online ? emptyText[0] : 'Pas de connexion'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {online ? emptyText[1] : 'Reconnecte-toi une première fois pour charger la liste.'}
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-muted">Aucun disque ne correspond à ces filtres.</p>
              <button
                onClick={resetFilters}
                className="mt-3 rounded-full border border-line px-4 py-1.5 text-sm transition hover:border-accent"
              >
                Réinitialiser
              </button>
            </div>
          ) : (
            <ul className={gridClass}>
              {visible.map((v, i) => (
                <VinylCard
                  key={v.key}
                  vinyl={v}
                  index={i}
                  mode={tab}
                  inRoom={!!room}
                  meId={userId}
                  onOpen={() => setDetailKey(v.key)}
                  onDelete={() => setDeleteTarget(v)}
                  onPriority={(p) => updateVinyl(v.myItem.id, { priority: p })}
                  onNote={() => setNoteTarget(v)}
                  onGotIt={() => gotIt(v.myItem)}
                  onMeToo={statusOf(v) ? undefined : () => addItem(v, tab)}
                />
              ))}
            </ul>
          )}
        </section>
      </main>

      {detailVinyl && (
        <VinylDetail
          vinyl={detailVinyl}
          mode={tab}
          inRoom={!!room}
          onSync={syncDetails}
          onClose={() => setDetailKey(null)}
        />
      )}
      {shareOpen && (
        <ShareDialog
          vinyls={visible}
          title={room ? `${listLabel} du salon « ${room.name} »` : tab === 'wish' ? 'Mes souhaits vinyles' : 'Ma collection de vinyles'}
          filtered={hasFilters}
          inviteUrl={room ? inviteUrl(room.code) : null}
          withOwners={!!room}
          onClose={() => setShareOpen(false)}
          onToast={toast}
        />
      )}
      {noteTarget && (
        <NoteDialog vinyl={noteTarget} onConfirm={confirmNote} onClose={() => setNoteTarget(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Retirer ce disque ?"
          message={`« ${deleteTarget.title} » sera retiré de ${tab === 'wish' ? 'tes souhaits' : 'ta collection'}${
            deleteTarget.owners.length > 1 ? ' (les autres membres le gardent)' : ''
          }.`}
          confirmLabel="Retirer"
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {leaveTarget && (
        <ConfirmDialog
          title="Quitter ce salon ?"
          message={`Tu ne verras plus les disques des autres membres de « ${leaveTarget.name} ». Ta liste perso ne change pas. Pour revenir, il faudra le code.`}
          confirmLabel="Quitter"
          onConfirm={confirmLeave}
          onClose={() => setLeaveTarget(null)}
        />
      )}
      {authDialog}

      <Toasts toasts={toasts} />
    </div>
  )
}
