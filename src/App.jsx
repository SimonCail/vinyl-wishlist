import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { useToasts } from './hooks/useToasts'
import { useAuth } from './hooks/useAuth'
import { useRooms, previewRoom } from './hooks/useRooms'
import { useFriends } from './hooks/useFriends'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import {
  mergeItems, filterByPerson, filterAndSort, getGenres, getTotals,
} from './lib/listUtils'
import { getDetails, itemKey } from './lib/discogs'
import { readCache, writeCache } from './lib/cache'
import { copyToClipboard } from './lib/share'
import { applyAccent, restoreAccent } from './lib/accent'
import { playAlbum, autoStart, stop as stopPlayer, stopIfPlaying, unlock as unlockPlayer } from './lib/player'
import Hero from './components/Hero'
import { ThemeToggle } from './components/ThemePicker'
import ShelfTabs from './components/ShelfTabs'
import Pagination, { usePageSize } from './components/Pagination'
import Suggestions from './components/Suggestions'
import ListSummary from './components/ListSummary'
import ListToolbar from './components/ListToolbar'
import SearchPanel from './components/SearchPanel'
import VinylCard from './components/VinylCard'
import VinylDetail from './components/VinylDetail'
import ShareDialog from './components/ShareDialog'
import AuthDialog from './components/AuthDialog'
import ProfilePanel from './components/ProfilePanel'
import BarcodeScanner from './components/BarcodeScanner'
import DiscogsImport from './components/DiscogsImport'
import Toasts from './components/Toasts'
import InstallBanner from './components/InstallBanner'
import OfflineBanner from './components/OfflineBanner'
import { RoomCover, CrownIcon, roomColor } from './components/Rooms'
import RoomSettings from './components/RoomSettings'
import FriendsPanel from './components/Friends'
import RoomsPage from './components/RoomsPage'
import { Messenger } from './components/Messages'
import { TopBar, TabBar, PageHeader, headerBtn, headerBtnSolid, sectionOf } from './components/Layout'
import { useMessages, vinylPayload } from './hooks/useMessages'
import { useRoute, matchRoute, paths } from './lib/router'
import { Avatar, AvatarStack } from './components/Avatar'
import { ConfirmDialog, NoteDialog } from './components/Dialogs'
import { ShareIcon } from './components/Icons'

// Disque à compléter : jamais passé par Discogs, ou pochette jamais cherchée.
// cover_url = '' veut dire « cherchée, Discogs n'en a pas » : on ne réessaie pas.
const isIncomplete = (v) => !v.price_updated_at || v.cover_url == null

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

// La couleur du site suit celle du profil (dernière connue, en attendant le profil)
restoreAccent()

export default function App() {
  const auth = useAuth()
  const { me, user } = auth
  const userId = user?.id ?? null

  // Couleur du site = couleur choisie dans le profil
  useEffect(() => {
    if (me?.color) applyAccent(me.color)
  }, [me?.color])
  const { rooms, loaded: roomsLoaded, reload: reloadRooms, ...roomActions } = useRooms(userId)
  const { toasts, toast } = useToasts()
  const online = useOnlineStatus()
  const install = useInstallPrompt()
  const wasOffline = useRef(false)

  const [items, setItems] = useState(readCache)
  const [loading, setLoading] = useState(() => readCache().length === 0)
  // Page affichée (voir lib/router.js)
  const { path, navigate } = useRoute()
  const route = matchRoute(path)
  // Espace dont on montre les disques : 'me', l'id d'un salon, ou 'friend:<id>'
  const contextId = route.name === 'room' ? route.id : route.name === 'friend' ? `friend:${route.id}` : 'me'
  const isListPage = route.name === 'home' || route.name === 'room' || route.name === 'friend'
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
  const [profileOpen, setProfileOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(false)

  // Espace affiché : 'me', l'id d'un salon, ou 'friend:<id>' (les disques d'un ami)
  const friendsApi = useFriends(userId)
  const reloadFriends = friendsApi.reload
  const messagesApi = useMessages(userId)
  const friendId = contextId.startsWith('friend:') ? contextId.slice(7) : null
  const friend = friendId ? friendsApi.friends.find((f) => f.id === friendId) ?? null : null
  const room = contextId !== 'me' && !friendId ? rooms.find((r) => r.id === contextId) ?? null : null

  // Nouvelle page : on repart du haut
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [path])

  // Le salon a disparu (quitté depuis un autre appareil…) -> retour à ma liste
  useEffect(() => {
    if (friendId) {
      // L'ami a disparu (retiré depuis un autre appareil…) -> retour à ma liste
      if (friendsApi.loaded && !friend) navigate(paths.friends, { replace: true })
    } else if (contextId !== 'me' && roomsLoaded && !room) navigate(paths.rooms, { replace: true })
  }, [contextId, roomsLoaded, room, friendId, friend, friendsApi.loaded, navigate])

  // Aller voir une liste : 'me', l'id d'un salon, ou 'friend:<id>'
  function selectContext(id) {
    navigate(id === 'me' ? paths.home : id.startsWith('friend:') ? paths.friend(id.slice(7)) : paths.room(id))
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
      // Un salon renommé, recoloré, avec un nouveau code ou un nouveau responsable
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => reloadRooms()
      )
      // Demande d'ami reçue, acceptée ou retirée : la liste d'amis et les disques visibles changent
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => {
          reloadFriends()
          loadVinyls()
        }
      )
      .subscribe()

    // Pendant une coupure ou une mise en veille, des événements ont pu être manqués
    const resync = () => {
      reloadRooms()
      reloadFriends()
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
  }, [userId, loadVinyls, reloadRooms, reloadFriends])

  // Déconnecté : on vide l'écran
  useEffect(() => {
    if (auth.ready && !userId) {
      setItems([])
      setLoading(false)
      navigate(paths.home, { replace: true })
    }
  }, [auth.ready, userId, navigate])

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
  // Mes disques à partager dans un message (souhaits et collection)
  const myVinylsToShare = useMemo(
    () => myItems.map((v) => ({ ...vinylPayload(v), status: v.status })),
    [myItems]
  )
  // Pochettes des derniers souhaits de chacun (pour donner des idées dans les messages)
  const coversByOwner = useMemo(() => {
    const map = new Map()
    for (const v of items) {
      if (v.status !== 'wish' || !v.cover_url) continue
      const list = map.get(v.owner_id) ?? []
      if (list.length < 3) list.push(v.cover_url)
      map.set(v.owner_id, list)
    }
    return map
  }, [items])
  const coversOf = useCallback((id) => coversByOwner.get(id) ?? [], [coversByOwner])

  // Page Amis : chiffres de chacun, disques en commun, derniers ajouts
  const friendStats = useMemo(() => {
    const map = new Map()
    const myKeys = new Set(myItems.map((v) => itemKey(v)))
    for (const v of items) {
      if (v.owner_id === userId) continue
      const st = map.get(v.owner_id) ?? { wish: 0, owned: 0, covers: [], ownedCovers: [], common: 0 }
      st[v.status === 'owned' ? 'owned' : 'wish']++
      if (v.cover_url) {
        const list = v.status === 'owned' ? st.ownedCovers : st.covers
        if (list.length < 4) list.push(v.cover_url)
      }
      if (myKeys.has(itemKey(v))) st.common++
      map.set(v.owner_id, st)
    }
    return map
  }, [items, myItems, userId])
  const statsOf = useCallback((id) => {
    const st = friendStats.get(id)
    if (!st) return { wish: 0, owned: 0, covers: [], common: 0 }
    return { ...st, covers: st.covers.length ? st.covers : st.ownedCovers }
  }, [friendStats])
  const friendActivity = useMemo(() => {
    const byId = new Map(friendsApi.friends.map((f) => [f.id, f]))
    return items
      .filter((v) => byId.has(v.owner_id))
      .sort((a, b) => new Date(b.owned_at || b.created_at) - new Date(a.owned_at || a.created_at))
      .slice(0, 12)
      .map((vinyl) => ({ vinyl, friend: byId.get(vinyl.owner_id) }))
  }, [items, friendsApi.friends])

  // Poser un disque sur la platine (profil) : on lance ses extraits si le son est activé
  function setTurntable(value) {
    unlockPlayer()
    auth.updateProfile({ turntable: value })
    if (value?.mode === 'disc' && value.title && value.artist) {
      playAlbum({ key: value.key, title: value.title, artist: value.artist, cover_url: value.cover_url })
    } else if (!value) {
      stopPlayer()
    }
  }

  // Inviter quelqu'un : partage du lien de l'app (ou copie)
  async function inviteFriend() {
    const url = window.location.origin
    const text = `Rejoins-moi sur Vinyl Wishlist pour partager nos listes de vinyles : ajoute « ${me.name} » en ami.`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Vinyl Wishlist', text, url })
        return
      } catch {
        // partage annulé : on copie le lien à la place
      }
    }
    const ok = await copyToClipboard(`${text} ${url}`)
    toast(ok ? 'Lien copié, envoie-le à qui tu veux' : url)
  }
  // Tous les profils connus (amis, demandes, membres de mes salons) : pour les messages
  const people = useMemo(() => {
    const map = new Map()
    rooms.forEach((r) => r.members.forEach((m) => map.set(m.id, m)))
    ;[...friendsApi.outgoing, ...friendsApi.incoming, ...friendsApi.friends].forEach((p) => map.set(p.id, p))
    return map
  }, [rooms, friendsApi.friends, friendsApi.incoming, friendsApi.outgoing])
  // Suggestions : les disques de mes proches (amis et membres de mes salons)
  const othersForSuggestions = useMemo(
    () =>
      items
        .filter((v) => v.owner_id !== userId && people.has(v.owner_id))
        .map((vinyl) => ({ vinyl, person: people.get(vinyl.owner_id) })),
    [items, userId, people]
  )

  const myByKey = useMemo(() => new Map(myItems.map((v) => [itemKey(v), v])), [myItems])
  const statusOf = (item) => myByKey.get(itemKey(item))?.status ?? null

  function ensureOnline() {
    if (navigator.onLine) return true
    toast('Tu es hors-ligne : modification impossible pour le moment', 'error')
    return false
  }

  // --- Actions (toujours sur MES disques) ---
  async function addItem(item, status) {
    if (!ensureOnline()) return null
    // On récupère genres, prix et pochette ; si Discogs ne répond pas, l'ajout continue quand même
    let extra = {}
    try {
      const d = await getDetails(item)
      extra = {
        genres: d.genres,
        styles: d.styles,
        lowest_price: d.lowest_price,
        num_for_sale: d.num_for_sale,
        price_updated_at: new Date().toISOString(),
        // Pochette de la fiche album si la recherche n'en avait pas
        ...(!item.cover_url ? { cover_url: d.cover_url || '' } : {}),
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
      return null
    }
    setItems((prev) => (prev.some((v) => v.id === data.id) ? prev : [data, ...prev]))
    toast(`« ${data.title} » ajouté à ${status === 'wish' ? 'tes souhaits' : 'ta collection'}`)
    return data
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
    if (!mine) return null
    const data = await updateVinyl(mine.id, {
      status: 'owned',
      owned_at: new Date().toISOString(),
    })
    if (data) toast(`« ${data.title} » rejoint ta collection`)
    return data
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
      // Pochette manquante : on prend celle de la fiche Discogs ('' si elle n'en a pas)
      ...(!mine.cover_url ? { cover_url: d.cover_url || '' } : {}),
    })
  }

  // Complète mes disques sans infos ou sans pochette ; sinon actualise tous mes prix
  async function refreshInfos() {
    if (!ensureOnline()) return
    const stale = myItems.filter(isIncomplete)
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

  // Import Discogs : ajoute les nouveaux disques par paquets de 100 et passe en
  // collection les souhaits déjà possédés. onProgress(n) suit l'avancement.
  async function importItems({ inserts, upgrades }, onProgress) {
    if (!navigator.onLine) throw new Error('Pas de connexion internet.')
    const now = new Date().toISOString()
    const rows = inserts.map(({ item, status }) => ({
      discogs_id: item.discogs_id,
      discogs_type: item.discogs_type,
      artist: item.artist,
      title: item.title,
      year: item.year,
      cover_url: item.cover_url,
      kind: item.kind,
      genres: item.genres,
      styles: item.styles,
      owner_id: userId,
      added_by: me.name,
      status,
      owned_at: status === 'owned' ? item.added_at || now : null,
      created_at: item.added_at || now, // garde l'ordre d'ajout de Discogs
    }))

    let done = 0
    const added = []
    for (let i = 0; i < rows.length; i += 100) {
      const { data, error } = await supabase
        .from('vinyls')
        .upsert(rows.slice(i, i + 100), {
          onConflict: 'owner_id,discogs_type,discogs_id',
          ignoreDuplicates: true, // déjà là (ajouté entre-temps ailleurs) : on n'y touche pas
        })
        .select()
      if (error) throw new Error(`Import interrompu après ${done} disques : ${error.message}`)
      added.push(...data)
      done += Math.min(100, rows.length - i)
      onProgress(done)
    }

    const ids = upgrades.map((it) => myByKey.get(itemKey(it))?.id).filter(Boolean)
    const upgraded = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase
        .from('vinyls')
        .update({ status: 'owned', owned_at: now })
        .in('id', ids.slice(i, i + 100))
        .select()
      if (error) throw new Error(`Import interrompu : ${error.message}`)
      upgraded.push(...data)
      done += Math.min(100, ids.length - i)
      onProgress(done)
    }

    setItems((prev) => {
      const byId = new Map(prev.map((v) => [v.id, v]))
      for (const v of [...added, ...upgraded]) byId.set(v.id, v)
      return [...byId.values()]
    })
    return { added: added.length, upgraded: upgraded.length }
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
            // Si c'était le disque de la platine, on revient à l'étiquette classique
      if (me?.turntable?.mode === 'disc' && me.turntable.key === deleteTarget.key) {
        auth.updateProfile({ turntable: null })
      }
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

  // Réglages du salon (réservés au responsable) : on recharge les disques
  // quand la liste des membres change, pour retirer ceux d'un membre parti
  const roomSettingsActions = {
    update: roomActions.update,
    uploadCover: roomActions.uploadCover,
    regenerateCode: roomActions.regenerateCode,
    transfer: roomActions.transfer,
    removeMember: async (roomId, memberId) => {
      const res = await roomActions.removeMember(roomId, memberId)
      if (!res.error) loadVinyls()
      return res
    },
    remove: async (roomId) => {
      const res = await roomActions.remove(roomId)
      if (!res.error) {
        selectContext('me')
        loadVinyls()
      }
      return res
    },
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

  // --- Mon profil ---
  // Après un changement, on recharge les salons pour que les autres membres
  // (et mes avatars dans les salons) affichent la nouvelle version
  async function saveProfile(patch) {
    const err = await auth.updateProfile(patch)
    if (!err) reloadRooms()
    return err
  }

  async function setPhoto(blob) {
    const err = await auth.setAvatar(blob)
    if (!err) reloadRooms()
    return err
  }

  async function setArtist(choice) {
    const err = await auth.setArtistAvatar(choice)
    if (!err) reloadRooms()
    return err
  }

  async function removePhoto() {
    const err = await auth.removeAvatar()
    if (!err) reloadRooms()
    return err
  }

  async function deleteAccount() {
    const err = await auth.deleteAccount()
    if (!err) {
      setProfileOpen(false)
      selectContext('me')
      applyAccent(null)
      toast('Ton compte a été supprimé')
    }
    return err
  }

  async function handleSignOut() {
    setProfileOpen(false)
    await auth.signOut()
    applyAccent(null) // retour au vert du site
    selectContext('me')
    toast('À bientôt !')
  }

  // --- Données dérivées ---
  const members = useMemo(
    () => (room ? room.members : friend ? [friend] : me ? [me] : []),
    [room, friend, me]
  )
  // Liste partagée (salon) ou de quelqu'un d'autre (ami) : les disques des autres sont en lecture seule
  const shared = !!room || !!friend
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

  // Pages : on affiche les disques par paquets, avec 1, 2, 3… en bas
  const pageSize = usePageSize()
  const [page, setPage] = useState(1)
  const listRef = useRef(null)
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, pageCount) // ex. après une suppression sur la dernière page
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  // Retour à la page 1 quand on change d'onglet, d'espace, de tri ou de filtre
  useEffect(() => {
    setPage(1)
  }, [tab, contextId, sort, search, activeGenre, activePerson])
  function goToPage(n) {
    setPage(n)
    // On remonte en haut de la liste (sans repartir tout en haut du site)
    const top = listRef.current?.getBoundingClientRect().top
    if (top != null && top < 0) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  const myCounts = {
    wish: myItems.filter((v) => v.status === 'wish').length,
    owned: myItems.filter((v) => v.status === 'owned').length,
  }
  const missingCount = myItems.filter(isIncomplete).length

  // Disque sur la platine du haut (réglage du profil)
  const [spinSeed] = useState(() => Math.random())
  const myDiscs = useMemo(
    () =>
      [...myItems]
        .filter((v) => v.cover_url)
        .sort((a, b) => (a.status === b.status ? (a.created_at < b.created_at ? 1 : -1) : a.status === 'owned' ? -1 : 1))
        .map((v) => ({ key: itemKey(v), cover_url: v.cover_url, title: v.title, artist: v.artist, status: v.status })),
    [myItems]
  )
  const turntable = me?.turntable
  const platine = useMemo(() => {
        // Le disque choisi ne tourne que s'il est encore dans ma collection
    if (turntable?.mode === 'disc' && turntable.cover_url) {
      const stillOwned = myDiscs.some((d) => d.key === turntable.key && d.status === 'owned')
      return stillOwned || loading ? turntable : null
    }
    if (turntable?.mode === 'random') {
      const owned = myDiscs.filter((d) => d.status === 'owned')
      const pool = owned.slice().sort((a, b) => (a.key < b.key ? -1 : 1))
      if (pool.length) return pool[Math.floor(spinSeed * pool.length)]
    }
    return null
  }, [turntable, myDiscs, spinSeed, loading])

  // À l'ouverture : le disque de la platine se lance tout seul (si le son est
  // activé dans le profil). Une seule fois par ouverture de l'app.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || loading || !platine?.title || !platine?.artist) return
    autoStarted.current = true
    autoStart({ key: platine.key, title: platine.title, artist: platine.artist, cover_url: platine.cover_url })
  }, [platine, loading])

  // Le disque quitte la platine (retiré de la collection, passé en souhait…) :
  // sa musique s'arrête aussi. Les extraits lancés ailleurs (suggestions) continuent.
  const platineKey = platine?.key ?? null
  const prevPlatineKey = useRef(platineKey)
  useEffect(() => {
    const prev = prevPlatineKey.current
    prevPlatineKey.current = platineKey
    if (prev && prev !== platineKey) stopIfPlaying(prev)
  }, [platineKey])
  // Artistes proposés comme avatar : ceux de mes listes et de mes salons, les plus présents d'abord
  const pickerArtists = useMemo(() => {
    const counts = new Map()
    for (const v of items) {
      if (v.artist && v.artist !== 'Artiste inconnu') counts.set(v.artist, (counts.get(v.artist) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [items])
  const detailVinyl = detailKey ? all.find((v) => v.key === detailKey) : null

  // Pochettes proposées pour le salon : celles des disques de ses membres.
  // (Elle tourne sur la platine du haut si on n'a pas choisi de disque dans son profil.)
  const roomCovers = useMemo(() => {
    if (!room) return []
    const ids = new Set(room.members.map((m) => m.id))
    const seen = new Set()
    return items
      .filter((v) => ids.has(v.owner_id) && v.cover_url)
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'owned' ? -1 : 1))
      .filter((v) => {
        const key = itemKey(v)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((v) => ({ key: itemKey(v), cover_url: v.cover_url, title: v.title, artist: v.artist }))
  }, [room, items])

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
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <button onClick={() => setAuthMode('login')} className={topBtn}>
                Se connecter
              </button>
            </div>
          }
        />
        <main className="mx-auto max-w-[88rem] sm:px-8 lg:px-14 px-5 pt-14">
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

  const context = room ?? (friend ? { kind: 'friend', id: friend.id, friend } : { kind: 'me', me })
  const listLabel = tab === 'wish' ? 'Souhaits' : 'Collection'
  const summaryLabel = hasFilters
    ? 'Valeur de la sélection'
    : {
        wish: room ? 'Pour tout offrir au salon' : friend ? `Pour tout offrir à ${friend.name}` : 'Valeur de mes souhaits',
        owned: room ? 'Valeur de vos collections' : friend ? 'Cote de sa collection' : 'Cote de ma collection',
      }[tab]
  const emptyText = friend
    ? {
        wish: [`${friend.name} n’a pas encore de souhaits`, 'Reviens plus tard, ou glisse-lui l’idée d’en ajouter.'],
        owned: [`La collection de ${friend.name} est vide`, 'Aucun disque marqué « Je l’ai » pour l’instant.'],
      }[tab]
    : {
    wish: room
      ? ['Aucun souhait dans ce salon', 'Ajoute un disque avec la recherche : il apparaît chez toi et ici.']
      : ['Ton bac à souhaits est vide', 'Cherche un artiste plus haut pour ajouter ton premier disque.'],
    owned: room
      ? ['Aucune collection ici pour l’instant', 'Ajoute les disques que tu as déjà avec « Je l’ai » dans la recherche.']
      : ['Ta collection est vide', 'Ajoute les disques que tu as déjà avec « Je l’ai » dans la recherche.'],
  }[tab]

  const gridClass =
    'grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-10 md:grid-cols-4 md:gap-x-12 xl:grid-cols-5'

  // Barre du haut / onglets : où aller
  const section = sectionOf(route.name)
  const badges = { friends: friendsApi.incoming.length, messages: messagesApi.unreadTotal }
  const goSection = (name) => navigate({ home: paths.home, rooms: paths.rooms, friends: paths.friends, messages: paths.messages }[name])
  const chatFriend = route.name === 'chat' ? people.get(route.id) ?? null : null
  const isMessenger = route.name === 'messages' || route.name === 'chat'

  return (
    <div className={`min-h-screen ${route.name === 'chat' ? 'pb-0' : isMessenger ? 'pb-24 lg:pb-0' : 'pb-28 md:pb-20'}`}>
      <OfflineBanner online={online} />
      <TopBar
        section={section}
        spinKey={path}
        badges={badges}
        me={me}
        onNavigate={goSection}
        onProfile={() => setProfileOpen(true)}
      />

      {/* --- En-tête de la page --- */}
      {route.name === 'home' && (
        <Hero
          count={lists.wish.length + lists.owned.length}
          context={context}
          disc={platine}
        />
      )}
      {room && (
        <PageHeader
          discColor={roomColor(room)}
          media={
            <button
              onClick={() => room.owner_id === userId && setRoomSettingsOpen(true)}
              title={room.owner_id === userId ? 'Gérer le salon' : undefined}
              className={room.owner_id === userId ? 'block transition hover:scale-[1.03]' : 'block cursor-default'}
            >
              <RoomCover room={room} size={84} className="rounded-2xl ring-4 ring-ink/25 shadow-xl shadow-black/30" />
            </button>
          }
          title={room.name}
          subtitle={
            <span className="flex items-center gap-2.5">
              <AvatarStack members={room.members} size={26} max={6} />
              {room.members.length} membre{room.members.length > 1 ? 's' : ''}
              {room.owner_id === userId && (
                <span className="flex items-center gap-1 text-ink/70">
                  · <CrownIcon width={13} height={13} /> tu es responsable
                </span>
              )}
            </span>
          }
          actions={
            <>
              <button onClick={copyInvite} className={headerBtn} aria-label={`Copier le lien d'invitation (code ${room.code})`}>
                <span className="font-mono tracking-wider">{room.code}</span>
              </button>
              {room.owner_id === userId && (
                <button onClick={() => setRoomSettingsOpen(true)} className={headerBtnSolid}>
                  <CrownIcon width={14} height={14} /> Gérer
                </button>
              )}
              <button onClick={() => setLeaveTarget(room)} className={headerBtn}>
                Quitter
              </button>
            </>
          }
        />
      )}
      {friend && (
        <PageHeader
          discColor={friend.color}
          media={<Avatar member={friend} size={84} ring={false} className="ring-4 ring-ink/25 shadow-xl shadow-black/30" />}
          title={<>Chez {friend.name}</>}
          subtitle="Ses souhaits et sa collection. Une idée de cadeau, ou un disque à ajouter à ta liste."
          actions={
            <button onClick={() => navigate(paths.chat(friend.id))} className={headerBtnSolid}>
              Lui écrire
            </button>
          }
        />
      )}
      {route.name === 'rooms' && (
        <PageHeader
          discColor="#6aa6d6"
          title="Salons"
          subtitle="Vos souhaits et vos collections mis en commun, par code."
        />
      )}
      {route.name === 'friends' && (
        <PageHeader
          discColor="#f09aaa"
          title="Amis"
          subtitle="Regarde ce que veulent tes proches, et ce qu’ils ont déjà."
        />
      )}

      <main
        key={route.name === 'room' || route.name === 'friend' ? path : isMessenger ? 'messenger' : route.name}
        className={isMessenger ? 'page-in' : 'page-in mx-auto max-w-[88rem] space-y-12 px-5 pt-10 sm:px-8 sm:pt-14 lg:px-14'}
      >
        {!isMessenger && (
          <InstallBanner mode={install.mode} onInstall={install.install} onDismiss={install.dismiss} />
        )}

        {/* --- Salons --- */}
        {route.name === 'rooms' && (
          <RoomsPage
            rooms={rooms}
            meId={userId}
            onOpen={(id) => selectContext(id)}
            onJoin={joinRoom}
            onCreate={createRoom}
            offline={!online}
          />
        )}

        {/* --- Amis --- */}
        {route.name === 'friends' && (
          <FriendsPanel
            friends={friendsApi}
            onOpenFriend={(id) => selectContext(`friend:${id}`)}
            onMessage={(id) => navigate(paths.chat(id))}
            statsOf={statsOf}
            activity={friendActivity}
            onInvite={inviteFriend}
            onToast={toast}
            offline={!online}
          />
        )}

        {/* --- Messages : liste + conversation --- */}
        {isMessenger && (
          <Messenger
            activeId={route.name === 'chat' ? route.id : null}
            activeFriend={chatFriend}
            conversations={messagesApi.conversations}
            friends={friendsApi.friends}
            people={people}
            meId={userId}
            missing={messagesApi.missing}
            coversOf={coversOf}
            onOpen={(id) => navigate(paths.chat(id), { replace: route.name === 'chat' && window.matchMedia('(min-width: 1024px)').matches })}
            onFindFriends={() => navigate(paths.friends)}
            threadProps={{
              isFriend: chatFriend ? friendsApi.relationOf(chatFriend.id) === 'friend' : false,
              messages: chatFriend ? messagesApi.thread(chatFriend.id) : [],
              meId: userId,
              myVinyls: myVinylsToShare,
              statusOf,
              onSend: messagesApi.send,
              onRetry: messagesApi.retry,
              onMarkRead: messagesApi.markRead,
              onAddVinyl: (v) => addItem(v, 'wish'),
              onBack: () => navigate(paths.messages),
              onOpenFriend: (id) => selectContext(`friend:${id}`),
              offline: !online,
            }}
          />
        )}

        {/* --- Une liste de disques : la mienne, un salon, un ami --- */}
        {isListPage && (
        <>
        {!friend && (
        <SearchPanel
          statusOf={statusOf}
          onAdd={addItem}
          onGotIt={(item) => gotIt(myByKey.get(itemKey(item)))}
          onError={(msg) => toast(msg, 'error')}
          onScan={() => setScannerOpen(true)}
          offline={!online}
        />
        )}
        {!friend && myItems.length < 10 && !loading && (
          <p className="-mt-8 text-sm text-muted">
            Déjà un compte Discogs ?{' '}
            <button onClick={() => setImportOpen(true)} className="font-medium text-accent underline-offset-4 hover:underline">
              Importer ta collection et ta wantlist
            </button>
          </p>
        )}

        <section ref={listRef} className="scroll-mt-4">
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
            <>
            <ul className={gridClass}>
              {pageItems.map((v, i) => (
                <VinylCard
                  key={v.key}
                  vinyl={v}
                  index={i}
                  mode={tab}
                  inRoom={shared}
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
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={visible.length}
              pageSize={pageSize}
              onPage={goToPage}
            />
            </>
          )}
        </section>

        {/* Suggestions, sous ma liste */}
        {route.name === 'home' && !loading && (
          <Suggestions
            myItems={myItems}
            others={othersForSuggestions}
            statusOf={statusOf}
            onAdd={addItem}
            online={online}
          />
        )}
        </>
        )}
      </main>

      {detailVinyl && (
        <VinylDetail
          vinyl={detailVinyl}
          mode={tab}
          inRoom={shared}
          canAdd={!statusOf(detailVinyl)}
          onSync={syncDetails}
          onClose={() => setDetailKey(null)}
          onPriority={(p) => updateVinyl(detailVinyl.myItem.id, { priority: p })}
          onGotIt={() => gotIt(detailVinyl.myItem)}
          onNote={() => setNoteTarget(detailVinyl)}
          onMeToo={() => addItem(detailVinyl, tab)}
        />
      )}
      {shareOpen && (
        <ShareDialog
          vinyls={visible}
          title={
            room
              ? `${listLabel} du salon « ${room.name} »`
              : friend
                ? `${listLabel} de ${friend.name}`
                : tab === 'wish' ? 'Mes souhaits vinyles' : 'Ma collection de vinyles'
          }
          filtered={hasFilters}
          inviteUrl={room ? inviteUrl(room.code) : null}
          withOwners={!!room}
          onClose={() => setShareOpen(false)}
          onToast={toast}
        />
      )}
      {importOpen && (
        <DiscogsImport
          statusOf={statusOf}
          onImport={importItems}
          onCompletePrices={() => {
            setImportOpen(false)
            if (!refreshing) refreshInfos()
          }}
          onClose={() => setImportOpen(false)}
          offline={!online}
        />
      )}
      {scannerOpen && (
        <BarcodeScanner
          statusOf={statusOf}
          onAdd={addItem}
          onGotIt={(item) => gotIt(myByKey.get(itemKey(item)))}
          onClose={() => setScannerOpen(false)}
          offline={!online}
        />
      )}
      {profileOpen && me && (
        <ProfilePanel
          me={me}
          email={user.email}
          myCounts={myCounts}
          rooms={rooms}
          offline={!online}
          onSaveProfile={saveProfile}
          onSetPhoto={setPhoto}
          onSetArtist={setArtist}
          myArtists={pickerArtists}
          myDiscs={myDiscs.filter((d) => d.status === 'owned')}
          onSetTurntable={setTurntable}
          onRemovePhoto={removePhoto}
          onChangeEmail={auth.changeEmail}
          onChangePassword={auth.changePassword}
          onLogout={handleSignOut}
          onImport={() => {
            setProfileOpen(false)
            setImportOpen(true)
          }}
          onDeleteAccount={deleteAccount}
          onClose={() => setProfileOpen(false)}
          onToast={toast}
        />
      )}
      {roomSettingsOpen && room && room.owner_id === userId && (
        <RoomSettings
          room={room}
          meId={userId}
          covers={roomCovers}
          actions={roomSettingsActions}
          onCopyInvite={copyInvite}
          onClose={() => setRoomSettingsOpen(false)}
          onToast={toast}
          offline={!online}
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
          message={`Tu ne verras plus les disques des autres membres de « ${leaveTarget.name} ». Ta liste perso ne change pas. Pour revenir, il faudra le code.${
            leaveTarget.owner_id === userId && leaveTarget.members.length > 1
              ? ' Tu es responsable : le membre le plus ancien prendra le relais.'
              : leaveTarget.members.length <= 1
                ? ' Tu es le dernier membre : le salon sera supprimé.'
                : ''
          }`}
          confirmLabel="Quitter"
          onConfirm={confirmLeave}
          onClose={() => setLeaveTarget(null)}
        />
      )}
      {authDialog}

      {/* Onglets du bas sur téléphone (cachés dans une conversation, qui a sa zone d'écriture) */}
      {route.name !== 'chat' && <TabBar section={section} badges={badges} onNavigate={goSection} />}

      <div className="toasts-above-tabs">
        <Toasts toasts={toasts} />
      </div>
    </div>
  )
}