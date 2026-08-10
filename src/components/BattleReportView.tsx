import { BottomSheet } from './BottomSheet'
import { Fragment, useState } from 'react'
import type { BattleResult, DiscipleTemperament } from '../game/types'
import { getAdvantageBand, resolveBattle, TERRAIN_EFFECTS, TIER_LABEL, type BattleParticipant, type BattlePhase } from '../game/engine/combat/battleSimulator'
import { formatResourceCost } from '../game/utils/formatResources'

/** Section headers for the arc phases (§9). The `opening` group (prologue + first beat) reads as an intro and gets no header. */
const PHASE_LABEL: Record<Exclude<BattlePhase, 'opening'>, string> = {
  escalation: 'The clash',
  turning: 'Turning point',
  finalPush: 'Final push',
  resolution: 'Resolution',
}

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
  return (
    <BottomSheet open onClose={onClose} title={title} height="full">
      <BattleReportBody battle={battle} title={title} participantNames={participantNames} participantTemperaments={participantTemperaments} />
    </BottomSheet>
  )
}

/**
 * The report itself — headline, meta line, Summary/Full toggle, and the regenerated
 * narrative — with no modal shell. `BattleReportView` wraps this in the overlay + Close
 * button; the Reports tab renders it directly in the master–detail right pane.
 */
export function BattleReportBody({
  battle,
  title,
  participantNames,
  participantTemperaments,
}: {
  battle: BattleResult
  title: string
  participantNames: string[]
  participantTemperaments?: (DiscipleTemperament | undefined)[]
}) {
  // Summary ↔ full toggle (§9): a player reviewing twenty raids wants tier + casualties; a player opening ONE battle wants the story. Both come from the same generation pass.
  const [mode, setMode] = useState<'summary' | 'full'>('full')

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

  const events = narrative.events
  // Summary view (§9): the turning-point beat, the casualty cluster, and the closing beat — a complete story in ~4 lines. If this doesn't read as a battle, the arc is wrong.
  const turningBeat = events.find((e) => e.phase === 'turning')
  const woundEvents = events.filter((e) => e.kind === 'wound')
  const closingBeat = events.find((e) => e.kind === 'closing')

  const beatClass = (kind: string): string => (kind === 'crit' ? 'battle-beat battle-beat-crit' : kind === 'wound' ? 'battle-beat battle-wound' : 'battle-beat')

  return (
    <>
        <h2>{battle.outcomeTier ? TIER_LABEL[battle.outcomeTier] : battle.won ? 'Victory' : 'Defeat'} — {title}</h2>
        <p className="panel-hint">{battle.outcomeSummary}</p>
        <p className="recipe-meta">
          Power {battle.attackerPower} vs {battle.defenderPower} &middot; {getAdvantageBand(battle.attackerPower, battle.defenderPower).label}
          {battle.terrain && battle.terrain !== 'open' ? ` · ${TERRAIN_EFFECTS[battle.terrain].label}` : ''} &middot; {narrative.rounds} rounds
        </p>

        <div className="battle-report-toggle">
          <button className={mode === 'summary' ? 'active' : ''} onClick={() => setMode('summary')}>Summary</button>
          <button className={mode === 'full' ? 'active' : ''} onClick={() => setMode('full')}>Full</button>
        </div>

        {mode === 'full' ? (
          <ul className="battle-report-events">
            {events.map((e, i) => {
              const showHeader = e.phase !== 'opening' && events[i - 1]?.phase !== e.phase
              return (
                <Fragment key={i}>
                  {showHeader && <li className="battle-phase-label">{PHASE_LABEL[e.phase as Exclude<BattlePhase, 'opening'>]}</li>}
                  <li className={beatClass(e.kind)}>{e.text}</li>
                </Fragment>
              )
            })}
          </ul>
        ) : (
          <ul className="battle-report-events">
            {turningBeat && <li className={beatClass(turningBeat.kind)}>{turningBeat.text}</li>}
            {woundEvents.map((e, i) => (
              <li key={i} className="battle-beat battle-wound">{e.text}</li>
            ))}
            {closingBeat && <li className="battle-beat">{closingBeat.text}</li>}
          </ul>
        )}

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
    </>
  )
}
