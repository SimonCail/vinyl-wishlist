import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Doit être identique à l'email du compte créé dans Supabase
const SHARED_EMAIL = 'liste@example.com'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Renvoie null si OK, sinon un message d'erreur
  async function signIn(code) {
    const { error } = await supabase.auth.signInWithPassword({
      email: SHARED_EMAIL,
      password: code,
    })
    if (!error) return null
    if (error.code === 'invalid_credentials') return 'Code incorrect.'
    if (error.status === 429) return "Trop d'essais, patiente quelques minutes."
    return 'Connexion impossible, réessaie.'
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { canEdit: !!session, ready, signIn, signOut }
}