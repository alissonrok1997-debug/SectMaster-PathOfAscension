import type { BattleResult, DiscipleTemperament } from '../game/types'
import { getAdvantageBand, resolveBattle, TERRAIN_EFFECTS, TIER_LABEL, type BattleParticipant } from '../game/engine/combat/battleSimulator'
import { formatResourceCost } from '../game/utils/formatResources'

/**
 * Regenerates the per-unit battle narrative from the stored outcome + seed
 * (FIRST_REALM_PLAN §4.7) — nothing round-by-round is persisted; re-invoking
 * `resolveBattle` with the same seed/powers/participant names deterministically
 * reproduces the identical story every time this is opened. Shared by every
 * report feed: expeditions (attacker), NPC raids/climbs (defender), and combat
 * missions (attacker) — `battle`/`title`/`participantNames` are the only inputs.
 */
export function BattleReportView({
  battle,
  title,
  participantNames,
  participantTemperaments,
  onClose,
}: {
  battle: BattleResult
  title: string
  participantNames: string[]
  /** Parallel to `participantNames` — the stored temperaments, so wound epithets regenerate exactly (Phase 3 #8). Absent on pre-v20 entries → the simulator falls back to a name hash. */
  participantTemperaments?: (DiscipleTemperament | undefined)[]
  onClose: () => void
}) {
  // On a defense report the stored roster are the DEFENDERS and the NPC is the attacker — mirror the params so the regenerated narrative matches what npcSimulation ran.
  const isDefense = battle.playerRole === 'defender'
  const participants: BattleParticipant[] = participantNames.map((name, i) => ({ id: String(i), name, temperament: participantTemperaments?.[i] }))
  const leaderIndex = battle.leaderName ? participantNames.indexOf(battle.leaderName) : -1
  const leaderId = leaderIndex >= 0 ? String(leaderIndex) : undefined

  const narrative = resolveBattle(
    isDefense
      ? {
          seed: battle.seed,
          attackerPower: battle.attackerPower,
          defenderPower: battle.defenderPower,
          attackerName: battle.attackerName,
          defenderParticipants: participants,
          defenderLeaderId: leaderId,
          defenderLeaderTrait: battle.leaderTrait,
          terrain: battle.terrain,
          defenderName: battle.defenderName,
        }
      : {
          seed: battle.seed,
          attackerPower: battle.attackerPower,
          defenderPower: battle.defenderPower,
          attackerParticipants: participants,
          attackerLeaderId: leaderId,
          attackerLeaderTrait: battle.leaderTrait,
          terrain: battle.terrain,
          defenderName: battle.defenderName,
        },
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{battle.outcomeTier ? TIER_LABEL[battle.outcomeTier] : battle.won ? 'Victory' : 'Defeat'} — {title}</h2>
        <p className="panel-hint">{battle.outcomeSummary}</p>
        <p className="recipe-meta">
          Power {battle.attackerPower} vs {battle.defenderPower} &middot; {getAdvantageBand(battle.attackerPower, battle.defenderPower).label}
          {battle.terrain && battle.terrain !== 'open' ? ` · ${TERRAIN_EFFECTS[battle.terrain].label}` : ''} &middot; {battle.rounds} rounds
        </p>
        <ul className="event-log-list">
          {narrative.events.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {battle.lootedResources && Object.keys(battle.lootedResources).length > 0 && (
          <p className="panel-hint">Looted: {formatResourceCost(battle.lootedResources)}</p>
        )}
        {battle.deaths && battle.deaths.length > 0 && (
          <p className="battle-report-deaths">
            {/* Held the field (a win, or a draw where the seat stayed ours) → carried home; lost → left to the enemy. Mirrors the death narration in engine/downed.ts. */}
            {battle.won || battle.outcomeTier === 'draw'
              ? `Fallen, and carried home with honor: ${battle.deaths.join(', ')}.`
              : `Fallen, and left to the enemy: ${battle.deaths.join(', ')}.`}
          </p>
        )}
        <div className="dispatch-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
