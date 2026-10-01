import { useState } from 'react'

// Un vinyle qui tourne. Avec `cover`, la pochette sert d'étiquette au centre
// (comme un vrai rond central imprimé) ; sinon étiquette unie de couleur `color`.
export default function SpinningDisc({ cover, color = '#ec5b3e', className = '', spin = 'animate-disc' }) {
  const [failed, setFailed] = useState(null)
  const showCover = cover && failed !== cover

  return (
    <div className={`vinyl-disc relative ${spin} ${className}`} style={{ '--disc-label': color }}>
      {showCover && (
        <>
          {/* L'étiquette d'un vinyle occupe ~64 % du diamètre */}
          <span className="absolute inset-[18%] overflow-hidden rounded-full shadow-[0_0_0_2px_rgba(0,0,0,0.65)]">
            <img
              src={cover}
              alt=""
              draggable="false"
              onError={() => setFailed(cover)}
              className="h-full w-full object-cover"
            />
            {/* léger reflet, comme le papier glacé d'une étiquette */}
            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),transparent_55%)]" />
          </span>
          {/* trou central */}
          <span className="absolute left-1/2 top-1/2 h-[3.2%] w-[3.2%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c0c0d] shadow-[0_0_0_1px_rgba(255,255,255,0.25)]" />
        </>
      )}
    </div>
  )
}
