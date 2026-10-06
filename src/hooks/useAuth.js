import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PROFILE_KEY, clearUserCache, readJSON, writeJSON } from '../lib/cache'
import { uploadAvatar, removeAvatars } from '../lib/avatar'
import { pseudoError } from '../lib/validation'

// Colonnes du profil, de la plus complète à la plus courte : tant qu'un script
// SQL (4, 5…) n'est pas lancé, on se rabat sur ce qui existe déjà.
const PROFILE_COL_SETS = [
  'id, name, color, avatar_path, avatar_url, avatar_label, turntable',
  'id, name, color, avatar_path, avatar_url, avatar_label',
  'id, name, color, avatar_path',
]
let profileCols = PROFILE_COL_SETS[0]
const missingColumn = (error) =>
  error?.code === '42703' || /avatar_(url|label)|turntable|does not exist/.test(error?.message || '')

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
      return 'Mot de passe trop faible : 8 caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Cet email ne semble pas valide.'
    case 'same_password':
      return 'Choisis un mot de passe différent de l’ancien.'
    case 'over_email_send_rate_limit':
      return 'Trop d’emails envoyés, réessaie dans quelques minutes.'
  }
  if (error.status === 429) return "Trop d'essais, patiente quelques minutes."
  if (!navigator.onLine) return 'Pas de connexion internet.'
  return 'Ça n’a pas marché, réessaie.'
}

// --- Pseudos : un pseudo = une seule personne (script 11-pseudo-unique.sql) ---
const pseudoTaken = (pseudo) => `Le pseudo « ${pseudo} » est déjà pris. Choisis-en un autre.`
const isPseudoInvalid = (error) => /pseudo_invalid|pseudo_reserved/i.test(`${error?.message || ''}`)
const isPseudoError = (error) =>
  /pseudo_taken|profiles_name_unique|duplicate key|database error saving new user/i.test(
    `${error?.message || ''} ${error?.code || ''}`
  )

// Le pseudo est-il libre ? 'free' | 'taken' | 'unknown' (vide, ou vérification impossible)
// Mon propre pseudo compte comme libre pour moi.
export async function checkPseudo(raw) {
  const pseudo = (raw ?? '').trim()
  if (!pseudo) return 'unknown'
  const { data, error } = await supabase.rpc('pseudo_available', { pseudo })
  if (error) return 'unknown'
  return data ? 'free' : 'taken'
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

  // Profil (pseudo, couleur, photo), gardé en cache pour le hors-ligne
  const loadProfile = useCallback(async () => {
    if (!userId) return
    let data = null
    for (const cols of PROFILE_COL_SETS) {
      const res = await supabase.from('profiles').select(cols).eq('id', userId).single()
      if (missingColumn(res.error)) continue
      data = res.data
      profileCols = cols
      break
    }
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
    const pseudo = (name ?? '').trim()
    const invalid = pseudoError(pseudo)
    if (invalid) return { error: invalid }
    // Pseudo déjà pris : on le dit tout de suite, aucun compte n'est créé
    if ((await checkPseudo(pseudo)) === 'taken') return { error: pseudoTaken(pseudo) }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: pseudo }, emailRedirectTo: redirectTo },
    })
    if (error) {
      // La base refuse un pseudo pris entre-temps (Supabase dit juste « Database error »)
      if (isPseudoError(error) && (await checkPseudo(pseudo)) === 'taken') return { error: pseudoTaken(pseudo) }
      if (isPseudoInvalid(error)) return { error: 'Ce pseudo n’est pas valide.' }
      return { error: authMessage(error) }
    }
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

  // --- Mon profil ---
  function saveProfileLocally(data) {
    setProfile(data)
    writeJSON(PROFILE_KEY, data)
  }

  // patch : { name, color, avatar_path } (une partie suffit). Renvoie un message d'erreur ou null.
  async function updateProfile(patch) {
    if (typeof patch.name === 'string') {
      const pseudo = patch.name.trim()
      const changed = pseudo !== (profile?.name ?? '').trim()
      // Les règles s'appliquent quand on change de pseudo (les anciens pseudos restent valables)
      const invalid = changed && pseudoError(pseudo)
      if (invalid) return invalid
      if (changed && (await checkPseudo(pseudo)) === 'taken') return pseudoTaken(pseudo)
      patch = { ...patch, name: pseudo }
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select(profileCols)
      .single()
    if (missingColumn(error)) {
      return 'turntable' in patch
        ? 'Lance d’abord le script 5-platine.sql dans Supabase.'
        : 'Lance d’abord le script 4-avatars-artistes.sql dans Supabase.'
    }
    if (error && isPseudoInvalid(error)) return pseudoError(patch.name) || 'Ce pseudo n’est pas valide.'
    if (error && isPseudoError(error)) return pseudoTaken(patch.name ?? '')
    if (error) return navigator.onLine ? 'Enregistrement impossible, réessaie.' : 'Pas de connexion internet.'
    saveProfileLocally(data)
    return null
  }

  // Nouvelle photo (déjà recadrée) : envoi, mise à jour du profil, ménage des anciennes
  async function setAvatar(blob) {
    let path
    try {
      path = await uploadAvatar(userId, blob)
    } catch (e) {
      return e.message
    }
    const err = await updateProfile({ avatar_path: path, avatar_url: null, avatar_label: null })
    if (err) return err
    removeAvatars(userId, path).catch(() => {})
    return null
  }

  // Avatar d'artiste (image Discogs) : remplace la photo
  async function setArtistAvatar({ url, label }) {
    const err = await updateProfile({ avatar_path: null, avatar_url: url, avatar_label: label })
    if (err) return err
    removeAvatars(userId).catch(() => {})
    return null
  }

  async function removeAvatar() {
    const err = await updateProfile({ avatar_path: null, avatar_url: null, avatar_label: null })
    if (err) return err
    removeAvatars(userId).catch(() => {})
    return null
  }

  // Renvoie { error, info }
  async function changeEmail(email) {
    if (email.trim().toLowerCase() === user?.email?.toLowerCase()) {
      return { error: 'C’est déjà ton email.' }
    }
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: window.location.origin }
    )
    if (error) return { error: authMessage(error) }
    return { info: `Clique sur le lien envoyé à ${email.trim()} pour confirmer le changement.` }
  }

  // On vérifie d'abord le mot de passe actuel
  async function changePassword(current, next) {
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (check.error) {
      return check.error.code === 'invalid_credentials'
        ? 'Mot de passe actuel incorrect.'
        : authMessage(check.error)
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    return authMessage(error)
  }

  // Supprime définitivement le compte (photos, profil, disques, places dans les salons)
  async function deleteAccount() {
    await removeAvatars(userId).catch(() => {})
    const { error } = await supabase.rpc('delete_my_account')
    if (error) return navigator.onLine ? 'Suppression impossible, réessaie.' : 'Pas de connexion internet.'
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    clearUserCache()
    setProfile(null)
    return null
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
    checkPseudo,
    recovering,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    setAvatar,
    setArtistAvatar,
    removeAvatar,
    changeEmail,
    changePassword,
    deleteAccount,
  }
}