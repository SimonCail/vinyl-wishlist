export default function Cover({ url, className = '' }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-raised ${className}`}>
      <svg viewBox="0 0 100 100" className="w-1/2" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="#1b2420" opacity="0.85" />
        <circle cx="50" cy="50" r="15" fill="#f1c04e" />
        <circle cx="50" cy="50" r="2.5" fill="#f4eee3" />
      </svg>
    </div>
  )
}
