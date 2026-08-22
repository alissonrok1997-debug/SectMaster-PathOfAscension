import { useGameStore } from '../game/state/store'
import { getAvailableSpecializationDefs, getClaimSlotEligibility } from '../game/engine/specializationSlots'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { BUILDING_ART, RESOURCE_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import type { Resources } from '../game/types'

/**
 * The claim drawer — pick which building to construct into an empty specialization slot.
 *
 * Converted to paper 2026-08-16, closing the last dark seam on the Buildings screen. It was
 * already rendering inside a `.leaf` sheet, so the remap made it *look* right; this makes it
 * actually be the same language as everything around it.
 *
 * ONE ROW PER CANDIDATE, and the row is the button. The old shape put a separate `Claim`
 * button beside a `<ul>` of costs inside an `<li>` — three nested containers and a control
 * that could be tapped while its own reason for being disabled sat underneath it. A whole row
 * that is itself the affordance is §8's card-header anatomy again, and it matches the works
 * rows the player just tapped to get here.
 */
export function SpecializationSlotPicker({ onClaimed }: { onClaimed: () => void }) {
  const state = useGameStore((s) => s.state)
  const claimSpecializationSlot = useGameStore((s) => s.claimSpecializationSlot)
  const available = getAvailableSpecializationDefs(state)

  return (
    <div className="building-leaf">
      <div className="building-leaf-head">
        <div className="building-leaf-ident">
          <h3>Choose a Specialization</h3>
          <span className="building-leaf-level">
            {available.length} available &middot; the slot is spent until you demolish
          </span>
        </div>
      </div>

      {available.length === 0 ? (
        <p className="building-leaf-lore">No specialization buildings left to claim.</p>
      ) : (
        available.map((def) => {
          const eligibility = getClaimSlotEligibility(state, def.id)
          const costEntries = Object.entries(eligibility.cost) as [keyof Resources, number][]
          return (
            <button
              key={def.id}
              type="button"
              className={`claim-option ${eligibility.canClaim ? '' : 'blocked'}`}
              disabled={!eligibility.canClaim}
              onClick={() => {
                claimSpecializationSlot(def.id)
                onClaimed()
              }}
            >
              <GameIcon className="works-row-art" src={BUILDING_ART[def.id]} fallback="🏯" alt="" size={48} />
              <span className="claim-option-text">
                <span className="claim-option-head">
                  <span className="works-row-name">{def.name}</span>
                  <span className="works-plate-pill">{def.category}</span>
                </span>
                <span className="claim-option-lore">{def.description}</span>
                <span className="works-plate-cost claim-option-cost">
                  {costEntries.map(([key, amount]) => (
                    <span className="works-plate-cost-chip" key={key}>
                      <GameIcon src={RESOURCE_ART[key]} alt="" size={14} />
                      {amount} {RESOURCE_LABELS[key]}
                    </span>
                  ))}
                  <span className="works-plate-cost-chip">
                    {formatDurationAdaptive(eligibility.durationMs / 1000)} of work
                  </span>
                </span>
                {/* The blocker rides INSIDE the row it belongs to. Previously it sat after the
                    button, so a disabled control and its reason were separate objects. */}
                {!eligibility.canClaim && eligibility.reason && (
                  <span className="works-row-foot">{eligibility.reason}</span>
                )}
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}
