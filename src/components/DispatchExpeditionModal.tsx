import { useState } from 'react'
import type { ExpeditionPurpose, Resources } from '../game/types'
import { useGameStore } from '../game/state/store'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { getLocation } from '../game/engine/world/worldQueries'
import { getClaimKind, getDispatchEligibility } from '../game/engine/world/expeditions'
import { getExpeditionPreview, getTravelTime } from '../game/engine/world/travel'
import { getIncidentChance } from '../game/engine/world/expeditionRewards'
import { compareDisciplesForSelection, getDiscipleAvailability } from '../game/engine/discipleAvailability'
import { getInjurySeverity } from '../game/engine/injury'
import { getDiscipleCombatTrait, getSquadCombatPower, TRAIT_EFFECTS } from '../game/engine/combatPower'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import { formatResourceCost } from '../game/utils/formatResources'
import { formatOutpostBonus } from './LocationDetailPanel'
import { DiscipleSelectList } from './DiscipleSelectList'

const PURPOSE_TITLE: Record<'buildOutpost' | 'seizeOutpost' | 'claimSeat' | 'raid' | 'survey' | 'gather', string> = {
  buildOutpost: 'Claim outpost at',
  seizeOutpost: 'Seize outpost at',
  claimSeat: 'Conquer',
  raid: 'Raid',
  survey: 'Survey',
  gather: 'Dispatch to',
}

/**
 * Reuses the modal overlay/panel pattern (§12.3): pick a party — and, for any
 * combat-bearing purpose (Claim vs. an owned target, or Raid), a leader — then
 * confirm. This is the "preparation is the gameplay" surface (FIRST_REALM_PLAN
 * §4.7/§7): every input here is locked in before dispatch and the battle then
 * runs non-interactively.
 */
export function DispatchExpeditionModal({
  locationId,
  purpose,
  onClose,
}: {
  locationId: string
  purpose: ExpeditionPurpose
  onClose: () => void
}) {
  const state = useGameStore((s) => s.state)
  const dispatchExpedition = useGameStore((s) => s.dispatchExpedition)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [leaderId, setLeaderId] = useState<string | undefined>(undefined)
  const [cycles, setCycles] = useState(1)

  const location = getLocation(state, locationId)
  const claimKind = purpose === 'claim' ? getClaimKind(state, locationId) : undefined
  const kind: 'buildOutpost' | 'seizeOutpost' | 'claimSeat' | 'raid' | 'survey' | 'gather' =
    purpose === 'claim' ? (claimKind ?? 'buildOutpost') : (purpose as 'raid' | 'survey' | 'gather')
  const isGather = purpose === 'gather'
  const isCombat = kind === 'seizeOutpost' || kind === 'claimSeat' || kind === 'raid'
  const targetName = location?.name ?? locationId

  const maxParty = isGather && location ? location.maxParty : 6
  const maxCycles = isGather && location ? (location.runtime.remainingCapacity === Infinity ? 99 : location.runtime.remainingCapacity) : 1
  const clampedCycles = isGather ? Math.max(1, Math.min(cycles, maxCycles)) : 1

  const combatPowerMult = getDoctrineModifiers(state).combatPowerMult
  // Show the whole roster — free disciples first, then strongest — with busy ones
  // visible-but-disabled so the player can see who is committed and where.
  const candidates = [...state.disciples].sort(compareDisciplesForSelection(state, combatPowerMult))
  const party = selectedIds
    .map((id) => state.disciples.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined)

  const preview = getExpeditionPreview(state, locationId, clampedCycles, purpose)
  const incidentChance = isGather && party.length > 0 && location ? getIncidentChance(location.dangerTier, party) : 0
  const eligibility = getDispatchEligibility(state, locationId, selectedIds, purpose, clampedCycles)

  const outboundMs = getTravelTime(state, locationId, purpose)
  const onSiteMs = preview.onSiteMs

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (leaderId === id) setLeaderId(undefined)
        return prev.filter((x) => x !== id)
      }
      if (prev.length >= maxParty) return prev
      return [...prev, id]
    })
  }

  const yieldLine = (Object.entries(preview.estimatedYield) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')

  const confirm = () => {
    // Dispatching a critical-band disciple risks their death (Phase 5) — require explicit confirmation.
    const critical = party.filter((d) => getInjurySeverity(d) === 'critical')
    if (critical.length > 0) {
      const names = critical.map((d) => d.name).join(', ')
      if (!window.confirm(`${names} ${critical.length > 1 ? 'are' : 'is'} critically wounded — sending them out risks death. Dispatch anyway?`)) return
    }
    dispatchExpedition(purpose, locationId, selectedIds, clampedCycles, isCombat ? leaderId : undefined)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>
          {PURPOSE_TITLE[kind]} {targetName}
        </h2>

        {kind === 'claimSeat' && (
          <p className="founding-warning">
            ⚠ Conquering this seat relocates your sect here and abandons your current seat and outpost network. Every
            other disciple must already be home — recall any missions, expeditions, and garrisons first.
          </p>
        )}

        <p className="panel-hint">
          Choose up to {maxParty} disciple{maxParty > 1 ? 's' : ''}.
          {location ? ` Danger ${location.dangerTier}.` : ''}
          {isGather ? ` Remaining capacity ${maxCycles === 99 ? '∞' : maxCycles}.` : ''}
        </p>

        <DiscipleSelectList
          disciples={candidates}
          selectedIds={selectedIds}
          isSelectable={(id) => getDiscipleAvailability(state, id).available && selectedIds.length < maxParty}
          combatPowerMult={combatPowerMult}
          onToggle={toggle}
        />

        {isCombat && party.length > 0 && (
          <div className="dispatch-preview">
            <p className="panel-hint">Leader (optional — their trait shapes power and casualties):</p>
            <div className="assign-disciple-choices">
              {party.map((d) => (
                <button
                  key={d.id}
                  className={`assign-disciple-choice ${leaderId === d.id ? 'selected' : ''}`}
                  onClick={() => setLeaderId(leaderId === d.id ? undefined : d.id)}
                >
                  <span className="assign-disciple-name">
                    {leaderId === d.id ? '✓ ' : ''}
                    {d.name} — {TRAIT_EFFECTS[getDiscipleCombatTrait(d)].label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === 'buildOutpost' && location?.kind === 'resource' && location.upgradePath && (
          <div className="dispatch-preview">
            <p>
              Cost: <strong>{formatResourceCost(location.upgradePath.level1.claimCost)}</strong>
            </p>
            <p>Grants a passive outpost: {formatOutpostBonus(location.upgradePath.level1.bonus)}</p>
            <p>
              Round trip {formatDurationAdaptive((outboundMs * 2) / 1000)} &middot; build{' '}
              {formatDurationAdaptive(onSiteMs / 1000)}
            </p>
          </div>
        )}

        {(kind === 'seizeOutpost' || kind === 'claimSeat' || kind === 'raid') && (
          <div className="dispatch-preview">
            <p>
              Your party combat power:{' '}
              <strong>{party.length > 0 ? getSquadCombatPower(party, combatPowerMult) : 'select a party'}</strong>
            </p>
            <p>
              Round trip {formatDurationAdaptive((outboundMs * 2) / 1000)} &middot; battle{' '}
              {formatDurationAdaptive(onSiteMs / 1000)}
            </p>
            {kind === 'raid' && <p className="panel-hint">Winning steals resources and weakens the defender; ownership doesn't change.</p>}
          </div>
        )}

        {kind === 'survey' && (
          <div className="dispatch-preview">
            <p>
              Round trip {formatDurationAdaptive((outboundMs * 2) / 1000)} &middot; scan{' '}
              {formatDurationAdaptive(onSiteMs / 1000)}
            </p>
            <p className="panel-hint">No combat — reveals knowledge about this location.</p>
          </div>
        )}

        {isGather && (
          <>
            <div className="dispatch-cycle-stepper">
              <span>Cycles:</span>
              <button disabled={clampedCycles <= 1} onClick={() => setCycles(clampedCycles - 1)}>
                −
              </button>
              <strong>{clampedCycles}</strong>
              <button disabled={clampedCycles >= maxCycles} onClick={() => setCycles(clampedCycles + 1)}>
                +
              </button>
            </div>

            <div className="dispatch-preview">
              <p>
                One way {formatDurationAdaptive(preview.outboundMs / 1000)} &middot; on site{' '}
                {formatDurationAdaptive((preview.onSiteMs * preview.effectiveCycles) / 1000)} &middot; total{' '}
                <strong>{formatDurationAdaptive(preview.totalMs / 1000)}</strong>
              </p>
              <p>Best-case haul: {yieldLine || '—'}</p>
              <p>
                Incident risk / cycle:{' '}
                <strong>{party.length > 0 ? `${Math.round(incidentChance * 100)}%` : 'select a party'}</strong>
              </p>
            </div>
          </>
        )}

        {!eligibility.canDispatch && eligibility.reason && (
          <p className="upgrade-blocked-reason">{eligibility.reason}</p>
        )}

        <div className="dispatch-actions">
          <button disabled={!eligibility.canDispatch} onClick={confirm}>
            {PURPOSE_TITLE[kind]}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
