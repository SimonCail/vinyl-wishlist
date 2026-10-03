import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readJSON, writeJSON } from '../lib/cache'

const FRIENDS_KEY = 'vinyl-wishlist-friends-v1'
const PROFILE_COLS = ['id, name, color, avatar_path, avatar_url, avatar_label', 'id, name, color, avatar_path']

function friendMessage(error) {
  if (!error) return null
  const msg = error.message || ''
  if (msg.includes('cannot_friend_self')) return 'C’est toi !'
  if (msg.includes('user_not_found')) return 'Ce compte n’existe plus.'
  if (msg.includes('request_not_found')) return 'Cette demande n’existe plus.'
  if (
    error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' ||
    /could not find the (function|table)|does not exist|friendships/i.test(msg)
  ) {
    return 'Lance d’abord le script 9-amis.sql dans Supabase.'
  }
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return msg || 'Ça n’a pas marché, réessaie.'
}

// Mes amis, les demandes reçues et envoyées.
// Chaque personne : { id, name, color, avatar…, since }
export function useFriends(userId) {
  const [state, setState] = useState(() => readJSON(FRIENDS_KEY, { friends: [], incoming: [], outgoing: [] }))
  const [loaded, setLoaded] = useState(false)
  const [missing, setMissing] = useState(false) // script 9 pas encore lancé

  const load = useCallback(async () => {
    if (!userId) {
      setState({ friends: [], incoming: [], outgoing: [] })
      return
    }
    const { data: links, error } = await supabase
      .from('friendships')
      .select('requester, addressee, status, created_at, accepted_at')
    if (error) {
      if (friendMessage(error).includes('script 9')) {
        setMissing(true)
        setLoaded(true)
      }
      return // hors-ligne : on garde le cache
    }
    setMissing(false)

    const otherIds = [...new Set(links.map((l) => (l.requester === userId ? l.addressee : l.requester)))]
    let profiles = []
    if (otherIds.length) {
      for (const cols of PROFILE_COLS) {
        const res = await supabase.from('profiles').select(cols).in('id', otherIds)
        if (!res.error) {
          profiles = res.data
          break
        }
        if (res.error.code !== '42703') return
      }
    }
    const byId = new Map(profiles.map((p) => [p.id, p]))
    const next = { friends: [], incoming: [], outgoing: [] }
    for (const l of links) {
      const otherId = l.requester === userId ? l.addressee : l.requester
      const p = byId.get(otherId)
      if (!p) continue
      const person = { ...p, since: l.accepted_at || l.created_at }
      if (l.status === 'accepted') next.friends.push(person)
      else if (l.addressee === userId) next.incoming.push(person)
      else next.outgoing.push(person)
    }
    const byName = (a, b) => a.name.localeCompare(b.name, 'fr')
    next.friends.sort(byName)
    next.incoming.sort((a, b) => new Date(b.since) - new Date(a.since))
    next.outgoing.sort(byName)
    setState(next)
    setLoaded(true)
    writeJSON(FRIENDS_KEY, next)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  // 'friend' | 'incoming' | 'outgoing' | null
  const relationOf = useMemo(() => {
    const map = new Map()
    state.friends.forEach((p) => map.set(p.id, 'friend'))
    state.incoming.forEach((p) => map.set(p.id, 'incoming'))
    state.outgoing.forEach((p) => map.set(p.id, 'outgoing'))
    return (id) => map.get(id) ?? null
  }, [state])

  // Chaque action renvoie { error? } (et status pour send)
  async function search(q) {
    const { data, error } = await supabase.rpc('search_profiles', { q })
    if (error) return { error: friendMessage(error), results: [] }
    return { results: data || [] }
  }

  async function send(id) {
    const { data, error } = await supabase.rpc('send_friend_request', { target: id })
    if (error) return { error: friendMessage(error) }
    await load()
    return { status: data }
  }

  async function accept(id) {
    const { error } = await supabase.rpc('accept_friend_request', { requester_id: id })
    if (error) return { error: friendMessage(error) }
    await load()
    return {}
  }

  // Refuser une demande, annuler la sienne, ou retirer un ami
  async function remove(id) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(requester.eq.${userId},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${userId})`)
    if (error) return { error: friendMessage(error) }
    await load()
    return {}
  }

  return { ...state, loaded, missing, reload: load, relationOf, search, send, accept, remove }
}
