import { TAB_ART } from '../assets/icons'

/**
 * UI chrome icons (GAME_UI_DESIGN_SYSTEM §15). Inline SVG, monoline, 1.5px stroke,
 * `currentColor`, 20px box, no fill — never emoji, never PNG, never an icon font. This is
 * the *chrome* tier: it depicts actions in the interface. Things in the world (resources,
 * buildings, roles, equipment) stay painted PNG art through `GameIcon`; mixing the two
 * tiers is what made the tab bar read like a phone keyboard.
 *
 * All glyphs are drawn on a 20-unit grid inside a 16-unit live area, so the set shares one
 * optical weight and one padding inset. Straight-line glyphs (`buildings`, `research`) and
 * curved ones (`sect`) are deliberately kept apart — at 20px, silhouette difference is the
 * only thing a player can use, and the text label underneath carries the meaning.
 */
export type UiIconName =
  | 'sect'
  | 'buildings'
  | 'disciples'
  | 'missions'
  | 'workshop'
  | 'research'
  | 'world'
  | 'reports'
  | 'system'
  | 'sun'
  | 'moon'
  | 'check'
  | 'empty'
  | 'chevron'
  | 'close'
  | 'warning'

/** Eight rays at 45° steps, r 5 → 7.2. Written out rather than mapped so the file stays static. */
const SUN_RAYS =
  'M10 5V2.8M10 15v2.2M5 10H2.8M15 10h2.2M13.5 6.5l1.6-1.6M6.5 6.5L4.9 4.9M13.5 13.5l1.6 1.6M6.5 13.5l-1.6 1.6'

const GLYPHS: Record<UiIconName, JSX.Element> = {
  /** Pagoda: finial over three widening eaves. All curves, which is what separates it from `buildings`. */
  sect: (
    <>
      <path d="M10 3V4.5" />
      <path d="M5.5 6.5Q10 9 14.5 6.5" />
      <path d="M4 10.5Q10 13 16 10.5" />
      <path d="M2.5 14.5Q10 17 17.5 14.5" />
    </>
  ),
  /** Timber hall frame: posts, rafters, tie beam. The only glyph with structural diagonals. */
  buildings: (
    <>
      <path d="M5 16.5V8" />
      <path d="M15 16.5V8" />
      <path d="M5 8L10 4.5L15 8" />
      <path d="M5 11.75h10" />
      <path d="M3 16.5h14" />
    </>
  ),
  /** Seated cultivator: head over a robed cone on a mat. A cone, not the usual round-shouldered avatar. */
  disciples: (
    <>
      <circle cx="10" cy="5" r="2.2" />
      <path d="M5.5 16.5L10 8.6L14.5 16.5" />
      <path d="M4 16.5h12" />
    </>
  ),
  /** Pennant on a staff. The only glyph with a full-height vertical at the left edge. */
  missions: (
    <>
      <path d="M5 3V17.5" />
      <path d="M5 4.5L16 7.5L5 10.5" />
    </>
  ),
  /** Alchemy ding: eared cauldron on legs. The only open semicircle in the set. */
  workshop: (
    <>
      <path d="M3.5 8.5h13" />
      <path d="M5 8.5A5 5 0 0 0 15 8.5" />
      <path d="M6.5 8.5V6" />
      <path d="M13.5 8.5V6" />
      <path d="M7.5 13.2V16.5" />
      <path d="M12.5 13.2V16.5" />
    </>
  ),
  /** Hanging scroll: rods overhanging the paper. Flat-topped, which separates it from `buildings`. */
  research: (
    <>
      <path d="M2.5 4.5h15" />
      <path d="M2.5 15.5h15" />
      <path d="M6 4.5V15.5" />
      <path d="M14 4.5V15.5" />
    </>
  ),
  /** Globe: the only large circle in the set, so it needs no further detail. */
  world: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="M10 4A3 6 0 0 0 10 16" />
      <path d="M10 4A3 6 0 0 1 10 16" />
      <path d="M4 10h12" />
    </>
  ),
  /** Sealed dispatch. The seal sits bottom-left so the unread badge's top-right corner stays clear. */
  reports: (
    <>
      <path d="M5 3.5h10v13H5z" />
      <path d="M8 7h4" />
      <path d="M8 10h4" />
      <circle cx="7.5" cy="14" r="1.5" />
    </>
  ),
  /** Two sliders. Explicitly not a cog — §9 rules out the SaaS gear. */
  system: (
    <>
      <path d="M3.5 7.5h13" />
      <circle cx="7.5" cy="7.5" r="2" />
      <path d="M3.5 13h13" />
      <circle cx="13" cy="13" r="2" />
    </>
  ),
  /** Eight rays, not four: four reads as a crosshair at this stroke weight. */
  sun: (
    <>
      <circle cx="10" cy="10" r="3.2" />
      <path d={SUN_RAYS} />
    </>
  ),
  moon: <path d="M14.5 3.2A7.5 7.5 0 1 0 14.5 16.8A6 6 0 1 1 14.5 3.2Z" />,
  check: <path d="M4 10.5L8.5 15L16 5" />,
  empty: <circle cx="10" cy="10" r="5.5" />,
  chevron: <path d="M8 4.5L13 10L8 15.5" />,
  /** Close. A stroked cross, not the `✕` character §15 rules out for chrome. */
  close: (
    <>
      <path d="M5.5 5.5L14.5 14.5" />
      <path d="M14.5 5.5L5.5 14.5" />
    </>
  ),
  /**
   * Warning. A bare exclamation inside a triangle at 1.5px, matching the monoline set —
   * deliberately not the filled `⚠` glyph, which arrives as an emoji on several platforms
   * and would be the only coloured object in a line of text.
   */
  warning: (
    <>
      <path d="M10 3.2L17.5 16.4H2.5L10 3.2Z" />
      <path d="M10 8v3.6" />
      <path d="M10 13.6v0.1" />
    </>
  ),
}

interface UiIconProps {
  name: UiIconName
  /** Box size in px. §15's ladder: 16 inline · 20 chrome. */
  size?: number
  className?: string
  /** Accessible name. Omit for decorative icons that sit beside their own text label. */
  title?: string
}

export function UiIcon({ name, size = 20, className = '', title }: UiIconProps) {
  // Generated seal art wins where it exists (§15 exception, §23); the SVG glyph below is the
  // fallback for names with no art yet — currently `buildings` and `workshop`.
  const art = TAB_ART[name]
  if (art) {
    return (
      <img
        className={`ui-icon ui-icon-art ${className}`}
        src={art}
        width={size}
        height={size}
        alt={title ?? ''}
        aria-hidden={title ? undefined : true}
        draggable={false}
      />
    )
  }

  return (
    <svg
      className={`ui-icon ${className}`}
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  )
}
