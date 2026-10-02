import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROOMS_KEY, readJSON, writeJSON } from '../lib/cache'

function roomMessage(error) {
  if (!error) return null
  const msg = error.message || ''
  if (msg.includes('room_not_found')) return 'Aucun salon avec ce code.'
  if (msg.includes('not_room_owner')) return 'Seul le responsable du salon peut faire ça.'
  if (msg.includes('cannot_remove_self')) return 'Pour partir toi-même, utilise « Quitter le salon ».'
  if (msg.includes('not_a_member')) return 'Cette personne ne fait plus partie du salon.'
  // Fonction ou colonne absente : le script 6 n'a pas encore été lancé
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42703' || /function .* does not exist|could not find the function/i.test(msg)) {
    return 'Lance d’abord le script 6-gestion-salons.sql dans Supabase.'
  }
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return msg || 'Ça n’a pas marché, réessaie.'
}

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

  useEffect(() => {
    load()
  }, [load])

  // Chaque fonction renvoie { room?, code?, error? }
  async function create(name) {
    const { data, error } = await supabase.rpc('create_room', { room_name: name })
    if (error) return { error: roomMessage(error) }
    await load()
    return { room: data }
  }

  async function join(code) {
    const { data, error } = await supabase.rpc('join_room', { room_code: code })
    if (error) return { error: roomMessage(error) }
    await load()
    return { room: data }
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
    const { data, error } = await supabase.from('rooms').update(patch).eq('id', roomId).select('id')
    if (error) return { error: roomMessage(error) }
    // Aucune ligne modifiée : la base a refusé (pas responsable)
    if (!data?.length) return { error: roomMessage({ message: 'not_room_owner' }) }
    await load()
    return {}
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
    create, join, leave,
    update, removeMember, regenerateCode, transfer, remove,
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
