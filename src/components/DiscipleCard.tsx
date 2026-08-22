import type { KeyboardEvent } from 'react'
import { useGameStore } from '../game/state/store'
import { getDiscipleCultivationRate, isReadyForBreakthrough } from '../game/engine/cultivation'
import { getEffectiveMaxHp, getInjurySeverity } from '../game/engine/injury'
import { isDowned } from '../game/engine/downed'
import { getDiscipleCombatPower } from '../game/engine/combatPower'
import { getResearchCultivationRateMultiplier } from '../game/engine/research'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { getWorldModifiers } from '../game/engine/world/worldModifiers'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import { EMBER_ART } from '../assets/icons'
import { DiscipleIdentity, DisciplePortrait, subRealmOrdinal } from './DisciplePortrait'

interface DiscipleCardProps {
  discipleId: string
  onSelect?: (id: string) => void
  active?: boolean
  /** §3's "one thing": the roster promotes exactly one card to the hero plate. */
  hero?: boolean
}

export function DiscipleCard({ discipleId, onSelect, active, hero }: DiscipleCardProps) {
  // Subscribing to the whole state so countdowns (away/injury) and live cultivation rate re-render every tick.
  const state = useGameStore((s) => s.state)

  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return null

  const isAway = disciple.awayUntil !== undefined
  const isDownedNow = isDowned(disciple, Date.now())
  const injurySeverity = getInjurySeverity(disciple)
  const isInjured = injurySeverity !== 'none'
  const isCritical = injurySeverity === 'critical'
  const hpPct = (disciple.health / getEffectiveMaxHp(disciple)) * 100
  const isBoosted = disciple.activeBoostUntil !== undefined && disciple.activeBoostUntil > Date.now()
  const trainingHallLevel = state.buildings.trainingHall?.level ?? 0
  const doctrineMods = getDoctrineModifiers(state)
  // Mirrors applyCultivationTick's rate multiplier so the displayed rate matches the tick (site + vein + world event via getWorldModifiers).
  const cultivationRateMultiplier =
    getResearchCultivationRateMultiplier(state) *
    doctrineMods.cultivationRateMult *
    getWorldModifiers(state).cultivationSpeedMult
  const cultivationRate = getDiscipleCultivationRate(disciple, trainingHallLevel, cultivationRateMultiplier)
  const pointsRemaining = Math.max(0, 100 - disciple.cultivationProgress)
  const etaToNextStage = cultivationRate > 0 ? formatDurationAdaptive(pointsRemaining / cultivationRate) : null
  // Cultivation is a multi-day grind, so a per-second rate rounds to 0.00 — show
  // the largest unit that reads above zero (per hour / per minute / per second).
  const rateLabel =
    cultivationRate <= 0
      ? null
      : cultivationRate < 0.1
        ? `+${(cultivationRate * 3600).toFixed(1)} pts/hr`
        : `+${cultivationRate.toFixed(2)} pts/s`
  const readyForBreakthrough = isReadyForBreakthrough(disciple)
  const combatPower = getDiscipleCombatPower(disciple, doctrineMods.combatPowerMult)
  const progressPct = Math.round(disciple.cultivationProgress)

  const statusBadge = isAway ? 'Away' : isDownedNow ? 'Downed' : isInjured ? 'Injured' : isBoosted ? 'Boosted' : null
  const showGrade = disciple.grade === 'Rare' || disciple.grade === 'Genius'

  const interaction = {
    onClick: onSelect ? () => onSelect(disciple.id) : undefined,
    role: onSelect ? ('button' as const) : undefined,
    tabIndex: onSelect ? 0 : undefined,
    onKeyDown: onSelect
      ? (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(disciple.id)
          }
        }
      : undefined,
  }

  /* The grade class rides the card as well as the plaque, so the plate's wash can take its
     colour from it without a second prop. `hero` is kept as the prop name because the
     roster's selection logic is unchanged — only the composition it renders is new. */
  const className = [
    'disciple-card',
    hero ? `plate grade-${disciple.grade.toLowerCase()}` : 'compact',
    isAway ? 'away' : '',
    isInjured ? 'injured' : '',
    onSelect ? 'selectable' : '',
    active ? 'active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  /* The ember is 0.699, not square, so it is a plain `img` rather than `GameIcon` — which
     forces a square box and would letterbox the flame. */
  const combatPowerReadout = (
    <span className="disciple-row-cp" aria-label="Combat Power">
      <img className="cp-ember" src={EMBER_ART} alt="" aria-hidden="true" draggable={false} />
      {combatPower}
    </span>
  )

  /*
   * One bar per stage: it fills for the current sub-realm and resets at each one. The
   * nine-stage binding was tried in step 8 and reverted — see §11. The percentage rides
   * inside the track rather than beside it, so the bar carries its own number.
   */
  const cultivationBar = (
    <div className="progress-bar disciple-row-bar">
      <div
        className={`progress-bar-fill ${readyForBreakthrough ? 'breakthrough' : 'cultivation'}`}
        style={{ width: `${disciple.cultivationProgress}%` }}
      />
      <span className="bar-pct">{progressPct}%</span>
    </div>
  )

  /*
   * Condition only appears when there's something to say. A full bar carries no information,
   * and jade (cultivation) beside --positive (health) at the same height read as the same bar
   * twice — so this one is thinner and absent at full health, which leaves height, gap and
   * fill-width as three separate cues.
   */
  const conditionBar = hpPct < 99.5 && (
    <div className="progress-bar disciple-row-bar condition">
      <div className={`progress-bar-fill ${isCritical ? 'hp-critical' : 'hp'}`} style={{ width: `${hpPct}%` }} />
    </div>
  )

  /* Split into lead and trailing rate so the footing can sit under a hairline with the state
     on the left and the rate on the right. */
  const statusLine = (
    <p className="disciple-status-line">
      <span className={`lead ${readyForBreakthrough ? 'ready' : isDownedNow || isCritical ? 'bad' : 'cultivating'}`}>
        {readyForBreakthrough
          ? 'Ready to break through'
          : isDownedNow
            ? 'Downed — recovering'
            : etaToNextStage
              ? `Next stage: ${etaToNextStage}`
              : 'Not cultivating'}
        {/* The status badge folded in here: one line instead of a badge plus a warning row. */}
        {statusBadge && !readyForBreakthrough && !isDownedNow && <> · {statusBadge}</>}
        {isCritical && !isAway && !isDownedNow && <span className="bad"> · Critical</span>}
        {isInjured && !isCritical && ` · ${injurySeverity} injury`}
      </span>
      {rateLabel && <span className="rate">{rateLabel}</span>}
    </p>
  )

  /*
   * THE PLATE — portrait beside a stacked text column. The arched frame overlays the
   * portrait, and the realm line is spelled in full here because the plate sits above the
   * first realm rule rather than inside a group.
   */
  if (hero) {
    return (
      <div className={className} {...interaction}>
        {/* `DiscipleIdentity` is shared with the detail leaf, so the roster's peak and the
            leaf's peak are one object rather than two that agree today. It announces only
            Rare and Genius here — absence is the signal for "ordinary" in a list. */}
        <DiscipleIdentity disciple={disciple} combatPower={combatPower}>
          {cultivationBar}
          {conditionBar}
          {statusLine}
        </DiscipleIdentity>
      </div>
    )
  }

  /*
   * THE ROLL CARD — a vertical three-up cell. The realm rule above the group already names
   * the realm, so the card carries only the stage ordinal; that de-duplication is what the
   * grouping pays for, and it is the phrase `DiscipleDetailPanel` already uses.
   */
  return (
    <div className={className} {...interaction}>
      <h3>{disciple.name}</h3>
      {showGrade && <span className={`disciple-grade grade-${disciple.grade.toLowerCase()}`}>{disciple.grade}</span>}

      <DisciplePortrait disciple={disciple} variant="grid" />

      <div className="disciple-compact-stat">
        <span className="disciple-stage">{subRealmOrdinal(disciple.subRealm)} stage</span>
        {combatPowerReadout}
      </div>

      {cultivationBar}
      {conditionBar}
      {statusLine}
    </div>
  )
}
