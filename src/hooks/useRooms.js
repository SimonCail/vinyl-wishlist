import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROOMS_KEY, readJSON, writeJSON } from '../lib/cache'

function roomMessage(error) {
  if (!error) return null
  const msg = error.message || ''
  if (msg.includes('room_not_found')) return 'Aucun salon avec ce code.'
  if (msg.includes('join_request_required')) return 'Recharge la page pour avoir la dernière version de l’app.'
  if (msg.includes('request_not_found')) return 'Cette demande n’existe plus (annulée entre-temps ?).'
  if (msg.includes('not_room_owner')) return 'Seul le responsable du salon peut faire ça.'
  if (msg.includes('cannot_remove_self')) return 'Pour partir toi-même, utilise « Quitter le salon ».'
  if (msg.includes('not_a_member')) return 'Cette personne ne fait plus partie du salon.'
  // Fonction ou colonne absente : le script 6 n'a pas encore été lancé
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42703' || /function .* does not exist|could not find the function/i.test(msg)) {
    return 'Lance d’abord le script 6-gestion-salons.sql dans Supabase.'
  }
  // Photo du salon (stockage Supabase)
  if (/bucket not found/i.test(msg) || /rooms_cover_source|rooms_cover_discogs/.test(msg)) {
    return 'Lance d’abord le script 8-photo-salon.sql dans Supabase.'
  }
  if (/tenant/i.test(msg)) return 'Le stockage de photos de Supabase ne répond pas pour l’instant (même souci que pour la photo de profil).'
  if (/exceeded the maximum allowed size|payload too large/i.test(msg)) return 'Photo trop lourde, essaie une autre image.'
  if (/row-level security|unauthorized|403/i.test(msg)) return 'Seul le responsable du salon peut changer sa photo.'
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return msg || 'Ça n’a pas marché, réessaie.'
}

// Dossier de stockage des photos de salon (script 8)
const COVER_BUCKET = 'room-covers'

// Colonnes à lire, de la plus complète à la plus courte : tant qu'un script SQL
// (4, 6…) n'est pas lancé, on se rabat sur ce qui existe déjà.
const ROOM_COLS = ['id, name, code, created_at, created_by, color, cover_url', 'id, name, code, created_at, created_by']
const PROFILE_COLS = ['id, name, color, avatar_path, avatar_url, avatar_label', 'id, name, color, avatar_path']
const missingColumn = (error) =>
  error?.code === '42703' || /avatar_(url|label)|color|cover_url|does not exist/.test(error?.message || '')

// Mes salons, avec leurs membres (dans l'ordre d'arrivée)
// owner_id : le responsable du salon (celui qui l'a créé, ou à qui on a passé la main)
export function useRooms(userId) {
  const [rooms, setRooms] = useState(() => readJSON(ROOMS_KEY, []))
  const [loaded, setLoaded] = useState(false)
  // Demandes pour rejoindre un salon (script 15) :
  //   mine     : celles que j'ai envoyées, en attente
  //   incoming : celles reçues pour les salons dont je suis responsable
  const [requests, setRequests] = useState({ mine: [], incoming: [] })

  const load = useCallback(async () => {
    if (!userId) {
      setRooms([])
      return
    }
    let data = null
    let error = null
    search: for (const rc of ROOM_COLS) {
      for (const pc of PROFILE_COLS) {
        ;({ data, error } = await supabase
          .from('rooms')
          .select(`${rc}, room_members(joined_at, profile:profiles(${pc}))`)
          .order('created_at'))
        if (!missingColumn(error)) break search
      }
    }
    if (error || !data) return // hors-ligne : on garde le cache

    const list = data.map((r) => ({
      kind: 'room',
      id: r.id,
      name: r.name,
      code: r.code,
      owner_id: r.created_by ?? null,
      color: r.color ?? null,
      cover_url: r.cover_url ?? null,
      members: [...(r.room_members || [])]
        .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))
        .map((m) => m.profile)
        .filter(Boolean),
    }))
    setRooms(list)
    setLoaded(true)
    writeJSON(ROOMS_KEY, list)
  }, [userId])

  const loadRequests = useCallback(async () => {
    if (!userId) {
      setRequests({ mine: [], incoming: [] })
      return
    }
    const [mine, incoming] = await Promise.all([supabase.rpc('my_room_requests'), supabase.rpc('pending_room_requests')])
    if (mine.error || incoming.error) return // script 15 pas lancé, ou hors-ligne
    setRequests({
      mine: (mine.data || []).map((r) => ({
        room_id: r.room_id,
        room_name: r.room_name,
        owner_name: r.owner_name,
        room: { id: r.room_id, name: r.room_name, color: r.room_color, cover_url: r.room_cover, members: [] },
        created_at: r.created_at,
      })),
      incoming: (incoming.data || []).map((r) => ({
        room_id: r.room_id,
        room_name: r.room_name,
        created_at: r.created_at,
        person: {
          id: r.user_id,
          name: r.name,
          color: r.color,
          avatar_path: r.avatar_path,
          avatar_url: r.avatar_url,
          avatar_label: r.avatar_label,
        },
      })),
    })
  }, [userId])

  useEffect(() => {
    load()
    loadRequests()
    if (!userId) return
    // Une demande arrive, est acceptée ou refusée : on met tout à jour
    const channel = supabase
      .channel(`room-requests-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_requests' }, () => {
        loadRequests()
        load()
      })
      .subscribe()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      loadRequests()
      load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [load, loadRequests, userId])

  // Chaque fonction renvoie { room?, code?, error? }
  async function create(name) {
    const { data, error } = await supabase.rpc('create_room', { room_name: name })
    if (error) return { error: roomMessage(error) }
    await load()
    return { room: data }
  }

  // Rejoindre avec un code : une demande part au responsable.
  // Renvoie { room } si j'étais déjà membre, { pending } si la demande est envoyée.
  async function join(code) {
    const { data, error } = await supabase.rpc('request_join_room', { room_code: code })
    if (error) {
      if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
        return { error: 'Lance d’abord le script 15-demandes-salon.sql dans Supabase.' }
      }
      return { error: roomMessage(error) }
    }
    const row = Array.isArray(data) ? data[0] : data
    if (row?.status === 'member') {
      await load()
      return { room: { id: row.room_id, name: row.room_name } }
    }
    await loadRequests()
    return { pending: { room_id: row.room_id, room_name: row.room_name, owner_name: row.owner_name } }
  }

  // --- Demandes ---
  async function acceptRequest(roomId, memberId) {
    const { error } = await supabase.rpc('accept_room_request', { target_room: roomId, member: memberId })
    await loadRequests()
    if (error) return { error: roomMessage(error) }
    await load()
    return {}
  }

  async function declineRequest(roomId, memberId) {
    const { error } = await supabase.rpc('decline_room_request', { target_room: roomId, member: memberId })
    await loadRequests()
    if (error) return { error: roomMessage(error) }
    return {}
  }

  async function cancelRequest(roomId) {
    const { error } = await supabase.rpc('cancel_room_request', { target_room: roomId })
    await loadRequests()
    if (error) return { error: roomMessage(error) }
    return {}
  }

  async function leave(roomId) {
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)
    if (error) return { error: roomMessage(error) }
    await load()
    return {}
  }

  // --- Réservé au responsable ---
  // patch : { name, color, cover_url } (une partie suffit)
  async function update(roomId, patch) {
    const old = rooms.find((r) => r.id === roomId)?.cover_url
    const { data, error } = await supabase.from('rooms').update(patch).eq('id', roomId).select('id')
    if (error) return { error: roomMessage(error) }
    // Aucune ligne modifiée : la base a refusé (pas responsable)
    if (!data?.length) return { error: roomMessage({ message: 'not_room_owner' }) }
    // On passe d'une photo perso à une pochette (ou plus rien) : on efface la photo
    if ('cover_url' in patch && patch.cover_url !== old && !patch.cover_url?.includes(`/${COVER_BUCKET}/`)) {
      removeStoredCover(old)
    }
    await load()
    return {}
  }

  // Photo de la galerie : blob = image déjà recadrée (JPEG carré)
  async function uploadCover(roomId, blob) {
    const old = rooms.find((r) => r.id === roomId)?.cover_url
    const path = `${roomId}/photo-${Date.now()}.jpg`
    const bucket = supabase.storage.from(COVER_BUCKET)
    const { error: upErr } = await bucket.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
    if (upErr) return { error: roomMessage(upErr) }
    const { data } = bucket.getPublicUrl(path)
    const res = await update(roomId, { cover_url: data.publicUrl })
    if (res.error) {
      bucket.remove([path]) // pas enregistrée : on ne laisse pas traîner le fichier
      return res
    }
    removeStoredCover(old)
    return {}
  }

  // Supprime l'ancienne photo du stockage (pas les pochettes Discogs)
  function removeStoredCover(url) {
    const i = url?.indexOf(`/${COVER_BUCKET}/`) ?? -1
    if (i < 0) return
    supabase.storage.from(COVER_BUCKET).remove([decodeURIComponent(url.slice(i + COVER_BUCKET.length + 2))])
  }

  async function removeMember(roomId, memberId) {
    const { error } = await supabase.rpc('remove_room_member', { target_room: roomId, member: memberId })
    if (error) return { error: roomMessage(error) }
    await load()
    return {}
  }

  async function regenerateCode(roomId) {
    const { data, error } = await supabase.rpc('regenerate_room_code', { target_room: roomId })
    if (error) return { error: roomMessage(error) }
    await load()
    return { code: data }
  }

  async function transfer(roomId, memberId) {
    const { error } = await supabase.rpc('transfer_room', { target_room: roomId, member: memberId })
    if (error) return { error: roomMessage(error) }
    await load()
    return {}
  }

  async function remove(roomId) {
    const { error } = await supabase.rpc('delete_room', { target_room: roomId })
    if (error) return { error: roomMessage(error) }
    await load()
    return {}
  }

  return {
    rooms, loaded, reload: load,
    requests, acceptRequest, declineRequest, cancelRequest,
    create, join, leave,
    update, uploadCover, removeMember, regenerateCode, transfer, remove,
  }
}

// Aperçu d'un salon (nom, couleur, pochette, membres) à partir de son code,
// même sans être connecté
export async function previewRoom(code) {
  const { data, error } = await supabase.rpc('room_preview', { room_code: code })
  const row = data?.[0]
  if (error || !row) return null
  return {
    name: row.name,
    color: row.room_color ?? null,
    cover_url: row.room_cover ?? null,
    members: row.member_names.map((name, i) => ({
      id: `preview-${i}`,
      name,
      color: row.member_colors[i],
      avatar_path: row.member_avatars?.[i] ?? null,
      avatar_url: row.member_avatar_urls?.[i] ?? null,
    })),
  }
}