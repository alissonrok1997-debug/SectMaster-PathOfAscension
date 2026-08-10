import { useGameStore } from '../game/state/store'
import { getDiscipleCultivationRate, isReadyForBreakthrough } from '../game/engine/cultivation'
import { getEffectiveMaxHp, getInjurySeverity } from '../game/engine/injury'
import { isDowned } from '../game/engine/downed'
import { getDiscipleCombatPower } from '../game/engine/combatPower'
import { getResearchCultivationRateMultiplier } from '../game/engine/research'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { getWorldModifiers } from '../game/engine/world/worldModifiers'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import { ROLE_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'

interface DiscipleCardProps {
  discipleId: string
  onSelect?: (id: string) => void
  active?: boolean
}

export function DiscipleCard({ discipleId, onSelect, active }: DiscipleCardProps) {
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

  const statusBadge = isAway ? 'Away' : isDownedNow ? 'Downed' : isInjured ? 'Injured' : isBoosted ? 'Boosted' : null

  return (
    <div
      className={`disciple-card ${isAway ? 'away' : ''} ${isInjured ? 'injured' : ''} ${
        onSelect ? 'selectable' : ''
      } ${active ? 'active' : ''}`}
      onClick={onSelect ? () => onSelect(disciple.id) : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(disciple.id)
              }
            }
          : undefined
      }
    >
      <div className="disciple-row-main">
        <GameIcon className="disciple-row-art" src={ROLE_ART[disciple.role]} alt="" size={40} />

        <div className="disciple-row-text">
          <div className="disciple-row-line">
            <h3>{disciple.name}</h3>
            <span className="disciple-grade">{disciple.grade}</span>
          </div>
          <div className="disciple-row-line disciple-row-sub">
            <span className="disciple-realm">
              {disciple.realm} <span className="disciple-substage">{disciple.subRealm}/9</span>
            </span>
            {statusBadge && <span className={`disciple-card-status ${statusBadge.toLowerCase()}`}>{statusBadge}</span>}
          </div>
        </div>

        <span className="disciple-row-cp" title="Combat Power">
          {combatPower}
        </span>
      </div>

      <div className="progress-bar disciple-row-bar">
        <div className="progress-bar-fill day" style={{ width: `${disciple.cultivationProgress}%` }} />
      </div>
      <div className="progress-bar disciple-row-bar">
        <div className={`progress-bar-fill ${isCritical ? 'hp-critical' : 'hp'}`} style={{ width: `${hpPct}%` }} />
      </div>

      <p className="panel-hint cultivation-detail">
        {readyForBreakthrough
          ? 'Ready to break through'
          : isDownedNow
            ? 'Downed — recovering'
            : etaToNextStage
              ? `${etaToNextStage} to next stage`
              : 'Not cultivating'}
        {rateLabel && ` · ${rateLabel}`}
        {isInjured && ` · ${injurySeverity} injury`}
      </p>

      {isCritical && !isAway && !isDownedNow && (
        <p className="disciple-critical-warning">⚠ Critical — dispatching risks their death.</p>
      )}
    </div>
  )
}
