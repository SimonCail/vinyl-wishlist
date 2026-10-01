import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROOMS_KEY, readJSON, writeJSON } from '../lib/cache'

function roomMessage(error) {
  if (!error) return null
  if (error.message?.includes('room_not_found')) return 'Aucun salon avec ce code.'
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return error.message || 'Ça n’a pas marché, réessaie.'
}

// Mes salons, avec leurs membres (dans l'ordre d'arrivée)
export function useRooms(userId) {
  const [rooms, setRooms] = useState(() => readJSON(ROOMS_KEY, []))
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!userId) {
      setRooms([])
      return
    }
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, code, created_at, room_members(joined_at, profile:profiles(id, name, color))')
      .order('created_at')
    if (error) return // hors-ligne : on garde le cache

    const list = data.map((r) => ({
      kind: 'room',
      id: r.id,
      name: r.name,
      code: r.code,
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

  // Chaque fonction renvoie { room, error }
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

  return { rooms, loaded, reload: load, create, join, leave }
}

// Aperçu d'un salon (nom + membres) à partir de son code, même sans être connecté
export async function previewRoom(code) {
  const { data, error } = await supabase.rpc('room_preview', { room_code: code })
  const row = data?.[0]
  if (error || !row) return null
  return {
    name: row.name,
    members: row.member_names.map((name, i) => ({
      id: `preview-${i}`,
      name,
      color: row.member_colors[i],
    })),
  }
}
