import type { DiscipleInstance } from '../game/types'
import { PORTRAIT_ART, ROLE_ART } from '../assets/icons'

/**
 * The two identity primitives shared by the roster card and the detail sheet
 * (GAME_UI_DESIGN_SYSTEM §16.2). Co-located because they always appear together and both
 * are pure presentation — no store, no engine, no save field.
 */

/**
 * Deterministic variant pick. Three portraits exist per role, and hashing the disciple's id
 * means the same disciple always shows the same face without storing a portrait index —
 * so this adds nothing to the save format. FNV-1a: short, stable, good enough for 3 buckets.
 */
function variantIndex(id: string, count: number): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return Math.abs(h) % count
}

/**
 * A portrait *plaque*, not an avatar chip: taller than wide, so it reads as a painted panel
 * rather than a contact photo — §16.2 asks for disciples to become people rather than records.
 *
 * The frame carries the grade (Common → Genius), which is why grade is absent from the
 * artwork itself and only 12 portraits are needed rather than 48. The role icon sits on a
 * nameplate along the bottom edge: role is real information the costume only implies, and
 * the nameplate's gradient doubles as the fade that hides the bust's crop.
 *
 * Four variants, because the Set E art gave the plaque two genuinely different jobs:
 *
 *   card   the original dark-screen plaque, unchanged
 *   sheet  the same, larger, in the detail header
 *   plate  the hero plate — the arched gold frame overlays the portrait, which is clipped
 *          to the frame's interior opening
 *   grid   the three-up roll card — no frame at all; the figure floats on the parchment
 *          behind a grade-coloured halo, with the role glyph as a corner badge
 *
 * `plate` and `grid` are only styled inside `.disciples-parchment`; on any other screen they
 * fall back to the base plaque, so nothing outside the pilot can break.
 */
export type PortraitVariant = 'card' | 'sheet' | 'plate' | 'grid'

export function DisciplePortrait({
  disciple,
  variant = 'card',
}: {
  disciple: DiscipleInstance
  variant?: PortraitVariant
}) {
  const set = PORTRAIT_ART[disciple.role]
  const src = set?.[variantIndex(disciple.id, set.length)]

  return (
    <div
      className={`disciple-portrait grade-${disciple.grade.toLowerCase()}${variant === 'card' ? '' : ` ${variant}`}`}
    >
      {src && <img src={src} alt="" draggable={false} />}
      <span className="disciple-portrait-role" aria-hidden="true">
        <img src={ROLE_ART[disciple.role]} alt="" draggable={false} />
      </span>
    </div>
  )
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** Sub-realms are always 1–9, so a lookup beats an ordinal algorithm nobody needs. */
export function subRealmOrdinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`
}

/**
 * `Foundation Establishment · 4th` — the disciple's identity in a cultivation world, which
 * §16.2 argues is not a stat. Display face, jade, directly beneath the name.
 *
 * The ordinal replaces the old `4/9` pill: "4th" is prose, so it needs neither the outline
 * nor `tabular-nums`, and the pill was double-marking a fact the jade already carries.
 */
export function RealmLine({ disciple }: { disciple: DiscipleInstance }) {
  return (
    <span className="disciple-realm">
      {disciple.realm}
      <span className="disciple-realm-sep"> · </span>
      {ORDINALS[disciple.subRealm] ?? `${disciple.subRealm}th`}
    </span>
  )
}
