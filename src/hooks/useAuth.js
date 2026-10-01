import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PROFILE_KEY, clearUserCache, readJSON, writeJSON } from '../lib/cache'

// Messages d'erreur Supabase -> phrases lisibles
function authMessage(error) {
  if (!error) return null
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email ou mot de passe incorrect.'
    case 'email_not_confirmed':
      return 'Confirme d’abord ton email : clique sur le lien reçu par mail.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Un compte existe déjà avec cet email. Connecte-toi plutôt.'
    case 'weak_password':
      return 'Mot de passe trop faible (6 caractères minimum).'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Cet email ne semble pas valide.'
    case 'same_password':
      return 'Choisis un mot de passe différent de l’ancien.'
  }
  if (error.status === 429) return "Trop d'essais, patiente quelques minutes."
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return 'Ça n’a pas marché, réessaie.'
}

export function useAuth() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [profile, setProfile] = useState(() => readJSON(PROFILE_KEY))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Arrivée par le lien « mot de passe oublié » : on demande le nouveau
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const userId = user?.id

  // Profil (prénom + couleur), gardé en cache pour le hors-ligne
  const loadProfile = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('profiles')
      .select('id, name, color')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile(data)
      writeJSON(PROFILE_KEY, data)
    }
  }, [userId])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return authMessage(error)
  }

  // Renvoie { error, needsConfirmation }
  async function signUp({ name, email, password, redirectTo }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: redirectTo },
    })
    if (error) return { error: authMessage(error) }
    // Supabase renvoie un utilisateur sans identités si l'email est déjà pris
    if (data.user && data.user.identities?.length === 0) {
      return { error: authMessage({ code: 'user_already_exists' }) }
    }
    return { error: null, needsConfirmation: !data.session }
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    return authMessage(error)
  }

  async function updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setRecovering(false)
    return authMessage(error)
  }

  async function signOut() {
    await supabase.auth.signOut()
    clearUserCache()
    setProfile(null)
  }

  // Tant que le profil n'est pas chargé, on se contente des infos du compte
  const me = useMemo(() => {
    if (!user) return null
    if (profile?.id === user.id) return profile
    return {
      id: user.id,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Moi',
      color: '#ec5b3e',
    }
  }, [user, profile])

  return {
    ready,
    user,
    me,
    recovering,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  }
}
