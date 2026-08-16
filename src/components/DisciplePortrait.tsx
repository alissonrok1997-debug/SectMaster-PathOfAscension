import type { ReactNode } from 'react'
import type { DiscipleInstance } from '../game/types'
import { EMBER_ART, PORTRAIT_ART, ROLE_ART } from '../assets/icons'

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
 *   sheet  DEPRECATED. The detail sheet used to have its own size; it now wears `plate`, so
 *          the roster's peak and the leaf's peak are one object at one size. Kept only
 *          because the base plaque outside `.parchment` still resolves it.
 *   plate  the peak — the arched gold frame overlays the portrait, which is clipped to the
 *          frame's interior opening. Used by BOTH the roster's hero card and the leaf.
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


/**
 * THE IDENTITY BLOCK — portrait, name, Combat Power, grade, realm.
 *
 * Extracted so the roster's hero plate and the detail leaf are not two pieces of markup that
 * happen to agree, but one component. §0's test is "does it look like it came from the same
 * game", and the strongest way to pass it is for the two peaks to BE the same object; the
 * roster and the leaf are never on screen together, so nothing competes.
 *
 * `children` land inside `.disciple-row-text`, under the realm line — the roster passes its
 * bars and status line, the leaf passes nothing and carries cultivation in its own section
 * so it can keep the caption sentence (§11).
 */
export function DiscipleIdentity({
  disciple,
  combatPower,
  /** Flash classes from `useValueFlash`. §23: Combat Power flashes on the detail sheet only. */
  cpClassName = '',
  /**
   * The roster announces only Rare and Genius — absence is its signal for "ordinary" (§8).
   * The leaf always names the grade: it is the disciple's record, not a scannable list, and
   * absence-as-signal only works where there is a list to compare against.
   */
  alwaysShowGrade = false,
  children,
}: {
  disciple: DiscipleInstance
  combatPower: number
  cpClassName?: string
  alwaysShowGrade?: boolean
  children?: ReactNode
}) {
  const showGrade = alwaysShowGrade || disciple.grade === 'Rare' || disciple.grade === 'Genius'

  return (
    <>
      <DisciplePortrait disciple={disciple} variant="plate" />

      <div className="disciple-row-text">
        <div className="disciple-row-line">
          <h3>{disciple.name}</h3>
          {/* The ember is 0.699, not square, so it is a plain `img` rather than `GameIcon` —
              which forces a square box and would letterbox the flame. */}
          <span className={`disciple-row-cp ${cpClassName}`.trim()} title="Combat Power">
            <img className="cp-ember" src={EMBER_ART} alt="" aria-hidden="true" draggable={false} />
            {combatPower}
          </span>
        </div>

        {showGrade && (
          <div className="disciple-row-line">
            <span className={`disciple-grade grade-${disciple.grade.toLowerCase()}`}>{disciple.grade}</span>
          </div>
        )}

        <div className="disciple-row-line disciple-row-sub">
          <RealmLine disciple={disciple} />
        </div>

        {children}
      </div>
    </>
  )
}
