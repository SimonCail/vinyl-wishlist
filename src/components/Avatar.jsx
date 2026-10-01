import { useState } from 'react'
import { avatarUrl } from '../lib/avatar'

// Pastille ronde : la photo (ou l'artiste choisi), sinon l'initiale dans sa couleur
// (initiale toujours foncée : les couleurs d'avatar sont claires, de jour comme de nuit)
export function Avatar({ member, size = 28, ring = true, className = '' }) {
  const src = member.avatar_src ?? (member.avatar_path ? avatarUrl(member.avatar_path) : member.avatar_url)
  const [failed, setFailed] = useState(null) // adresse qui n'a pas pu se charger
  const showImage = src && failed !== src

  return (
    <span
      title={member.avatar_label ? `${member.name} · ${member.avatar_label}` : member.name}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-black uppercase text-[#1b2420] ${
        ring ? 'ring-2 ring-ink' : ''
      } ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        backgroundColor: member.color,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable="false"
          onError={() => setFailed(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        member.name?.[0]
      )}
    </span>
  )
}

// Plusieurs avatars qui se chevauchent
export function AvatarStack({ members, size = 28, max = 4, className = '' }) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  return (
    <span className={`flex items-center ${className}`}>
      {shown.map((m, i) => (
        <Avatar key={m.id} member={m} size={size} className={i > 0 ? '-ml-2' : ''} />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-raised font-mono text-[10px] text-muted ring-2 ring-ink"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}

// "Camille", "Toi et Camille", "Vous trois"…
export function namesLabel(members, meId) {
  if (members.length === 1) return members[0].id === meId ? 'Toi' : members[0].name
  if (members.length === 2) {
    const other = members.find((m) => m.id !== meId)
    return members.some((m) => m.id === meId)
      ? `Toi et ${other.name}`
      : `${members[0].name} et ${members[1].name}`
  }
  return `Vous ${['', '', 'deux', 'trois', 'quatre', 'cinq'][members.length] || members.length}`
}
