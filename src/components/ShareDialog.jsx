import { useEffect, useMemo } from 'react'
import { CloseIcon, CopyIcon, ShareIcon } from './Icons'
import { buildListText, copyToClipboard } from '../lib/share'

// title : « Mes souhaits », « Souhaits du salon Famille »…
// inviteUrl : lien pour rejoindre le salon (absent pour l'espace perso, qui est privé)
export default function ShareDialog({ vinyls, title, filtered, inviteUrl, withOwners, onClose, onToast }) {
  const text = useMemo(
    () => buildListText(vinyls, { title, url: inviteUrl, withOwners }),
    [vinyls, title, inviteUrl, withOwners]
  )
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  // Fermeture avec Échap
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy(value, message) {
    const ok = await copyToClipboard(value)
    onToast(ok ? message : 'Copie impossible, sélectionne le texte à la main', ok ? 'success' : 'error')
    if (ok) onClose()
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text })
      onClose()
    } catch (err) {
      // L'annulation par l'utilisateur n'est pas une erreur
      if (err.name !== 'AbortError') onToast('Partage impossible', 'error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Partager la liste"
        className="animate-pop nice-scroll max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-2xl shadow-black/60 sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">Partager la liste</h3>
            <p className="mt-1 text-sm text-muted">
              {filtered
                ? 'Seule ta sélection actuelle est partagée.'
                : "Toute la liste est partagée, dans l'ordre du tri actuel."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted transition hover:bg-raised hover:text-paper"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <textarea
          readOnly
          value={text}
          rows={9}
          onFocus={(e) => e.target.select()}
          className="mt-4 w-full resize-none rounded-2xl border border-line bg-ink px-4 py-3 font-mono text-xs leading-relaxed text-muted outline-none focus:border-accent"
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => copy(text, 'Liste copiée')}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-bold text-ink transition hover:bg-accent-soft"
          >
            <CopyIcon width={16} height={16} /> Copier le texte
          </button>
          {inviteUrl && (
            <button
              onClick={() => copy(inviteUrl, "Lien d'invitation copié")}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-medium transition hover:border-accent hover:bg-raised"
            >
              <CopyIcon width={16} height={16} /> Lien d'invitation
            </button>
          )}
          {canShare && (
            <button
              onClick={nativeShare}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-medium transition hover:border-accent hover:bg-raised"
            >
              <ShareIcon width={16} height={16} /> Partager…
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-muted/70">
          {inviteUrl
            ? 'Le lien invite à rejoindre le salon : il faut un compte pour voir la liste en direct.'
            : 'Ton espace perso reste privé : seul le texte est partagé. Pour une liste en direct, crée un salon.'}
        </p>
      </div>
    </div>
  )
}
