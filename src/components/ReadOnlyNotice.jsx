export default function ReadOnlyNotice({ onLogin }) {
  return (
    <div className="animate-pop flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
      <div>
        <p className="font-display font-bold">
          Tu consultes la liste en lecture seule
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Pour ajouter ou modifier des disques, entre le code partagé.
        </p>
      </div>
      <button
        onClick={onLogin}
        className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-soft"
      >
        Entrer le code
      </button>
    </div>
  )
}