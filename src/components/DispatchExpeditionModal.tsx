import { BottomSheet } from './BottomSheet'
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
import { getDefensePower } from '../game/engine/world/territory'
import { getLocationTerrain } from '../game/engine/world/terrain'
import { getAdvantageBand, TERRAIN_EFFECTS } from '../game/engine/combat/battleSimulator'
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

  /*
   * §16.4's "both sides' strength" needs no engine change: expeditions.ts:344 resolves the
   * battle with exactly `getDefensePower × TERRAIN_EFFECTS[terrain].defenderPowerMult`, and
   * all three are pure — so the number shown here is the number that will fight.
   */
  const terrain = TERRAIN_EFFECTS[getLocationTerrain(locationId)]
  const defenderPower = isCombat ? Math.round(getDefensePower(state, locationId) * terrain.defenderPowerMult) : 0
  const leader = leaderId ? party.find((d) => d.id === leaderId) : undefined
  // expeditions.ts:341 multiplies the squad by the leader's trait before fighting. Folding it
  // in here is a correctness fix, not decoration: the preview used to under-report by up to 20%.
  const attackerPower = Math.round(
    getSquadCombatPower(party, combatPowerMult) * (leader ? TRAIT_EFFECTS[getDiscipleCombatTrait(leader)].powerMult : 1),
  )
  const band = isCombat && party.length > 0 ? getAdvantageBand(attackerPower, defenderPower) : undefined
  const ownerId = location?.runtime.ownerId
  const defenderName =
    (ownerId && ownerId !== state.sectId ? state.world?.npcSects.find((s) => s.id === ownerId)?.name : undefined) ?? 'Defenders'

  // Same ladder `.mission-card.risk-*` uses, clamped so a generated tier above 3 degrades
  // into the top band rather than falling through to no stripe.
  const dangerTier = location?.dangerTier ?? 0
  const threatClass = dangerTier <= 1 ? 'threat-low' : dangerTier === 2 ? 'threat-mid' : 'threat-high'

  const groundLine = (() => {
    const label = terrain.label.charAt(0).toUpperCase() + terrain.label.slice(1)
    const bonus = Math.round((terrain.defenderPowerMult - 1) * 100)
    return bonus > 0
      ? `${label} — the defenders fight ${bonus}% stronger here.`
      : `${label} — neither side holds the advantage of terrain.`
  })()

  const criticalNames = party.filter((d) => getInjurySeverity(d) === 'critical').map((d) => d.name)
  const consequence = (() => {
    if (criticalNames.length > 0 && (isCombat || isGather)) {
      const names = criticalNames.join(', ')
      const plural = criticalNames.length > 1
      return {
        grave: true,
        text: `${names} ${plural ? 'are' : 'is'} critically wounded. If this goes badly, ${plural ? 'they' : 'they'} will not come back.`,
      }
    }
    if (isCombat) return { grave: false, text: 'If it goes badly: wounds, and a wounded disciple can die.' }
    if (isGather && party.length > 0)
      return {
        grave: false,
        text: `Incident risk ${Math.round(incidentChance * 100)}% per cycle — a bad cycle wounds someone and can end the trip early.`,
      }
    return undefined
  })()

  const partyLine =
    party.length === 0
      ? 'No one committed yet'
      : party.map((d) => (d.id === leaderId ? `${d.name} (leading)` : d.name)).join(' · ')

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
    <BottomSheet
      open
      onClose={onClose}
      title={`${PURPOSE_TITLE[kind]} ${targetName}`}
      height="full"
      footer={
        <>
          {/*
           * §16.4: "the preparation screen is the actual decision point… this is where
           * tension is built." The commit block is pinned in the footer rather than left
           * in the body because the stakes have to be visible at the moment the thumb
           * lands, not scrolled past on the way down.
           */}
          <div className="muster-commit">
            <p className={`muster-party ${party.length === 0 ? 'empty' : ''}`}>{partyLine}</p>
            {band && (
              <>
                <p className={`muster-verdict tier-${band.tier}`}>{band.label}</p>
                <div className="muster-powers">
                  <span className="muster-power-own">Your party {attackerPower.toLocaleString()}</span>
                  <span className="muster-power-other">
                    {defenderName} {defenderPower.toLocaleString()}
                  </span>
                </div>
                {/* Texture under the verdict, never the statement — see App.css. */}
                <div className="progress-bar opposed" aria-hidden="true">
                  <div
                    className="progress-bar-fill own"
                    style={{ width: `${(attackerPower / Math.max(1, attackerPower + defenderPower)) * 100}%` }}
                  />
                </div>
              </>
            )}
            {consequence && (
              <p className={`muster-consequence ${consequence.grave ? 'grave' : ''}`}>{consequence.text}</p>
            )}
          </div>
          <button className="dispatch-confirm-button primary" disabled={!eligibility.canDispatch} onClick={confirm}>
            {PURPOSE_TITLE[kind]}
          </button>
          {!eligibility.canDispatch && eligibility.reason && (
            <p className="upgrade-blocked-reason">{eligibility.reason}</p>
          )}
        </>
      }
    >

        {/*
         * The brief: what you're facing, stated once, above the roster. Seat conquest takes
         * `.grave` and absorbs the relocation warning — it's the only irreversible action in
         * the game, so it's the only red-striped brief.
         */}
        <div className={`muster-brief ${kind === 'claimSeat' ? 'grave' : threatClass}`}>
          {kind === 'claimSeat' && (
            <p>
              Conquering this seat relocates your sect here and abandons your current seat and outpost network. Every
              other disciple must already be home — recall any missions, expeditions, and garrisons first.
            </p>
          )}
          {isCombat && <p className="muster-ground">{groundLine}</p>}
          <p className="muster-facts">
            Danger {dangerTier} &middot; up to {maxParty} disciple{maxParty > 1 ? 's' : ''} &middot; round trip{' '}
            {formatDurationAdaptive((outboundMs * 2) / 1000)}
            {isGather ? ` · remaining capacity ${maxCycles === 99 ? '∞' : maxCycles}` : ''}
          </p>
        </div>

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
              {party.map((d) => {
                const trait = TRAIT_EFFECTS[getDiscipleCombatTrait(d)]
                return (
                  <button
                    key={d.id}
                    className={`assign-disciple-choice ${leaderId === d.id ? 'selected' : ''}`}
                    onClick={() => setLeaderId(leaderId === d.id ? undefined : d.id)}
                  >
                    <span className="assign-disciple-name">
                      {leaderId === d.id ? '✓ ' : ''}
                      {d.name}
                    </span>
                    {/* `blurb` already exists on every trait and was rendered nowhere. §12
                        permits one overlay, so it goes inline rather than into a tooltip. */}
                    <span className="assign-disciple-meta">
                      {trait.label} &middot; {trait.blurb}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/*
         * These blocks lost their power lines and round trips — the footer now carries the
         * strengths and the brief carries the timings, so what's left is the detail unique
         * to each purpose. Net JSX reduction, not addition.
         */}
        {kind === 'buildOutpost' && location?.kind === 'resource' && location.upgradePath && (
          <div className="dispatch-preview">
            <p>
              Cost: <strong>{formatResourceCost(location.upgradePath.level1.claimCost)}</strong>
            </p>
            <p>Grants a passive outpost: {formatOutpostBonus(location.upgradePath.level1.bonus)}</p>
            <p>Build takes {formatDurationAdaptive(onSiteMs / 1000)} on site.</p>
          </div>
        )}

        {isCombat && (
          <div className="dispatch-preview">
            <p>The battle itself takes {formatDurationAdaptive(onSiteMs / 1000)}.</p>
            {kind === 'raid' && <p className="panel-hint">Winning steals resources and weakens the defender; ownership doesn't change.</p>}
          </div>
        )}

        {kind === 'survey' && (
          <div className="dispatch-preview">
            <p>The scan takes {formatDurationAdaptive(onSiteMs / 1000)}.</p>
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
              {/* Incident risk moved to the footer's consequence row — it's a cost, and costs
                  belong directly above the button that accepts them. */}
            </div>
          </>
        )}

    </BottomSheet>
  )
}
