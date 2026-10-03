import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const LIMIT = 1000
// Du plus ancien au plus récent
const byDate = (list) => [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

function messageError(error) {
  const msg = error?.message || ''
  if (error?.code === '42P01' || /messages.*does not exist|could not find the table/i.test(msg)) {
    return 'Lance d’abord le script 10-messages.sql dans Supabase.'
  }
  if (/row-level security/i.test(msg)) return 'Vous devez être amis pour vous écrire.'
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return msg || 'Message non envoyé.'
}

// Ce qu'on garde d'un disque partagé dans un message
export function vinylPayload(v) {
  return {
    discogs_id: v.discogs_id,
    discogs_type: v.discogs_type || 'master',
    title: v.title,
    artist: v.artist,
    year: v.year ?? null,
    kind: v.kind ?? null,
    cover_url: v.cover_url || null,
  }
}

// Toutes mes conversations (les 1000 derniers messages), en temps réel
export function useMessages(userId) {
  const [messages, setMessages] = useState([]) // du plus ancien au plus récent
  const [loaded, setLoaded] = useState(false)
  const [missing, setMissing] = useState(false)
  const tempId = useRef(0)

  const load = useCallback(async () => {
    if (!userId) {
      setMessages([])
      return
    }
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender.eq.${userId},recipient.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(LIMIT)
    if (error) {
      if (messageError(error).includes('script 10')) setMissing(true)
      setLoaded(true)
      return
    }
    setMissing(false)
    // On garde les messages encore en cours d'envoi
    setMessages((prev) => byDate([...data, ...prev.filter((m) => m.pending || m.failed)]))
    setLoaded(true)
  }, [userId])

  useEffect(() => {
    load()
    if (!userId) return
    const channel = supabase
      .channel(`messages-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const m = payload.new
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : byDate([...prev, m])))
        } else if (payload.eventType === 'UPDATE') {
          setMessages((prev) => prev.map((x) => (x.id === payload.new.id ? payload.new : x)))
        } else if (payload.eventType === 'DELETE') {
          setMessages((prev) => prev.filter((x) => x.id !== payload.old.id))
        }
      })
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && load()
    window.addEventListener('online', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', load)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [userId, load])

  // Une conversation par personne : dernier message + nombre de non lus
  const conversations = useMemo(() => {
    const map = new Map()
    for (const m of messages) {
      const other = m.sender === userId ? m.recipient : m.sender
      const c = map.get(other) ?? { otherId: other, last: null, unread: 0 }
      c.last = m
      if (m.recipient === userId && !m.read_at) c.unread++
      map.set(other, c)
    }
    return [...map.values()].sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at))
  }, [messages, userId])

  const unreadTotal = conversations.reduce((n, c) => n + c.unread, 0)

  const thread = useCallback(
    (otherId) => messages.filter((m) => m.sender === otherId || m.recipient === otherId),
    [messages]
  )

  // Envoi : le message apparaît tout de suite, puis est confirmé par la base
  async function send(to, { body = null, vinyl = null }) {
    const text = body?.trim() || null
    if (!text && !vinyl) return {}
    const temp = {
      id: `tmp-${++tempId.current}`,
      sender: userId,
      recipient: to,
      body: text,
      vinyl,
      created_at: new Date().toISOString(),
      read_at: null,
      pending: true,
    }
    setMessages((prev) => [...prev, temp])
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender: userId, recipient: to, body: text, vinyl })
      .select()
      .single()
    if (error) {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)))
      return { error: messageError(error) }
    }
    setMessages((prev) => {
      const without = prev.filter((m) => m.id !== temp.id)
      return without.some((m) => m.id === data.id) ? without : byDate([...without, data])
    })
    return {}
  }

  async function retry(message) {
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
    return send(message.recipient, { body: message.body, vinyl: message.vinyl })
  }

  async function markRead(otherId) {
    const hasUnread = messages.some((m) => m.sender === otherId && m.recipient === userId && !m.read_at)
    if (!hasUnread) return
    const now = new Date().toISOString()
    setMessages((prev) =>
      prev.map((m) => (m.sender === otherId && m.recipient === userId && !m.read_at ? { ...m, read_at: now } : m))
    )
    await supabase.rpc('mark_conversation_read', { other: otherId })
  }

  return { messages, loaded, missing, conversations, unreadTotal, thread, send, retry, markRead, reload: load }
}
