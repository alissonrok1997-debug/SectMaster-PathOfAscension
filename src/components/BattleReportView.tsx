import type { ExpeditionLogEntry } from '../game/types'
import { resolveBattle, type BattleParticipant } from '../game/engine/combat/battleSimulator'
import { formatResourceCost } from '../game/utils/formatResources'

/**
 * Regenerates the per-unit battle narrative from the stored outcome + seed
 * (FIRST_REALM_PLAN §4.7) — nothing round-by-round is persisted; re-invoking
 * `resolveBattle` with the same seed/powers/participant names deterministically
 * reproduces the identical story every time this is opened.
 */
export function BattleReportView({ entry, onClose }: { entry: ExpeditionLogEntry; onClose: () => void }) {
  const battle = entry.battleResult
  if (!battle) return null

  const attackerParticipants: BattleParticipant[] = entry.discipleNames.map((name, i) => ({ id: String(i), name }))
  const leaderIndex = battle.leaderName ? entry.discipleNames.indexOf(battle.leaderName) : -1

  const narrative = resolveBattle({
    seed: battle.seed,
    attackerPower: battle.attackerPower,
    defenderPower: battle.defenderPower,
    attackerParticipants,
    attackerLeaderId: leaderIndex >= 0 ? String(leaderIndex) : undefined,
    defenderName: battle.defenderName,
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{battle.won ? 'Victory' : 'Defeat'} — {entry.locationName}</h2>
        <p className="panel-hint">{battle.outcomeSummary}</p>
        <p className="recipe-meta">
          Power {battle.attackerPower} vs {battle.defenderPower} &middot; {battle.rounds} rounds
        </p>
        <ul className="event-log-list">
          {narrative.events.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {battle.lootedResources && Object.keys(battle.lootedResources).length > 0 && (
          <p className="panel-hint">Looted: {formatResourceCost(battle.lootedResources)}</p>
        )}
        <div className="dispatch-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
