export default function Marquee({ items }) {
  if (!items.length) return null

  // On remplit assez de place, puis on double la série pour une boucle sans saut
  const base = []
  while (base.length < 8) base.push(...items)
  const loop = [...base, ...base]

  return (
    <div
      aria-hidden="true"
      className="group relative z-10 -ml-[2%] -mt-6 w-[104%] -rotate-1 overflow-hidden bg-coral py-2.5 shadow-[0_12px_30px_-12px_rgba(27,36,32,0.55)]"
    >
      <div className="animate-marquee flex w-max items-center group-hover:[animation-play-state:paused]">
        {loop.map((name, i) => (
          <span
            key={i}
            className="font-display flex shrink-0 items-center gap-8 pr-8 text-xl font-bold uppercase text-ink"
          >
            {name}
            <span className="h-1.5 w-1.5 rounded-full bg-ink/60" />
          </span>
        ))}
      </div>
    </div>
  )
}
