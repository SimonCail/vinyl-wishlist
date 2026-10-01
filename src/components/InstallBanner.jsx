import { CloseIcon, ShareIcon } from './Icons'

export default function InstallBanner({ mode, onInstall, onDismiss }) {
  if (!mode) return null

  return (
    <div className="animate-pop flex items-start gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <img
        src="/pwa-192x192.png"
        alt=""
        className="h-12 w-12 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold">Garde la liste sous la main</p>
        {mode === 'prompt' ? (
          <>
            <p className="mt-0.5 text-sm text-muted">
              Installe l'app sur ton écran d'accueil : elle s'ouvre en plein
              écran et la liste reste consultable sans réseau.
            </p>
            <button
              onClick={onInstall}
              className="mt-3 rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-ink transition hover:bg-accent-soft"
            >
              Installer l'app
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-muted">
            Dans Safari, appuie sur{' '}
            <ShareIcon
              width={15}
              height={15}
              className="inline -translate-y-px text-paper"
            />{' '}
            puis sur « Sur l'écran d'accueil ».
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Masquer"
        className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted transition hover:bg-raised hover:text-paper"
      >
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  )
}