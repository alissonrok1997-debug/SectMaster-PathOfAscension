interface GameIconProps {
  /** Sliced artwork URL. When absent the emoji `fallback` is rendered instead. */
  src?: string
  /** Emoji used when there is no artwork for this id yet. */
  fallback?: string
  alt: string
  /** Rendered box size in px. */
  size?: number
  className?: string
}

/** Square game artwork with an emoji fallback, decorative by default (alt=""). */
export function GameIcon({ src, fallback, alt, size = 28, className = '' }: GameIconProps) {
  if (!src) {
    return (
      <span
        className={`game-icon game-icon-fallback ${className}`}
        style={{ fontSize: size * 0.8, width: size, height: size }}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        {fallback ?? '·'}
      </span>
    )
  }

  return (
    <img
      className={`game-icon ${className}`}
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
    />
  )
}
