import { useCallback, useEffect, useState } from 'react'

// Petit routeur « par dièse » : l'adresse ressemble à monsite.fr/#/salon/abc.
// Avantage : marche partout sans réglage du serveur, le bouton retour du
// téléphone fonctionne, et chaque page a son lien.

function currentPath() {
  const h = window.location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/'
}

export function useRoute() {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])

  // replace : remplace la page actuelle dans l'historique (pas de « retour » vers elle)
  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === currentPath()) return
    const url = `${window.location.pathname}${window.location.search}#${to}`
    if (replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    setPath(to)
  }, [])

  return { path, navigate }
}

// Les pages de l'app
//   /                → ma liste (accueil)
//   /salons          → mes salons
//   /salon/:id       → un salon
//   /amis            → mes amis
//   /ami/:id         → les disques d'un ami
//   /messages        → mes conversations
//   /messages/:id    → conversation avec un ami
export function matchRoute(path) {
  const [, a = '', b = ''] = path.split('/')
  const id = b ? decodeURIComponent(b) : null
  if (a === 'salons') return { name: 'rooms' }
  if (a === 'salon' && id) return { name: 'room', id }
  if (a === 'amis') return { name: 'friends' }
  if (a === 'ami' && id) return { name: 'friend', id }
  if (a === 'messages') return id ? { name: 'chat', id } : { name: 'messages' }
  return { name: 'home' }
}

export const paths = {
  home: '/',
  rooms: '/salons',
  room: (id) => `/salon/${encodeURIComponent(id)}`,
  friends: '/amis',
  friend: (id) => `/ami/${encodeURIComponent(id)}`,
  messages: '/messages',
  chat: (id) => `/messages/${encodeURIComponent(id)}`,
}
