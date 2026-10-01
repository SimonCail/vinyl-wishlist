export default function Cover({ url, className = '' }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-raised ${className}`}>
      <svg viewBox="0 0 100 100" className="w-1/2 text-line" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="currentColor" opacity="0.6" />
        <circle cx="50" cy="50" r="14" fill="#14110f" />
        <circle cx="50" cy="50" r="3" fill="currentColor" />
      </svg>
    </div>
  )
}