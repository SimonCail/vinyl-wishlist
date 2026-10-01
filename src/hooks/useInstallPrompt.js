import { useEffect, useState } from 'react'

const DISMISS_KEY = 'vinyl-wishlist-install-dismissed'
const DISMISS_DAYS = 14

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOS() {
  const iPadOS =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || iPadOS
}

function recentlyDismissed() {
  const t = Number(localStorage.getItem(DISMISS_KEY))
  return !!t && Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [dismissed, setDismissed] = useState(recentlyDismissed)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  const mode =
    installed || dismissed ? null : deferred ? 'prompt' : isIOS() ? 'ios' : null

  return { mode, install, dismiss }
}
