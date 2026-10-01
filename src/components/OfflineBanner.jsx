export default function OfflineBanner({ online }) {
  if (online) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-50 border-b border-line bg-raised px-4 py-2 text-center text-sm"
    >
      <span className="mr-2 inline-block h-2 w-2 animate-shimmer rounded-full bg-accent align-middle" />
      Hors-ligne · tu vois la dernière version de la liste, les modifications
      sont désactivées.
    </div>
  )
}