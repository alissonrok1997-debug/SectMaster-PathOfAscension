import type { GameState } from '../types'
import { EQUIPMENT_SLOTS } from './equipment'
import { addExistingInstance } from './crafting'

/**
 * Every way a disciple leaves the roster shares this one core (HEALTH_SYSTEM_PLAN Phase 5, "Settled").
 * The two axes are independent: `returnGear` decides whether equipped items return to the sect
 * inventory or are lost with the disciple, and `reason` drives only the caller's narration.
 *
 *  | Event            | eligibility guard (caller) | returnGear |
 *  |------------------|----------------------------|------------|
 *  | expelled         | yes — must be recallable    | true       |
 *  | crippledToMortal | no                          | true       |
 *  | died             | no                          | false      |
 *  | captured         | no                          | false      |
 */
export type RemovalReason = 'expelled' | 'died' | 'crippledToMortal' | 'captured'

/**
 * Clears EVERY reference to a disciple, then drops them — references first, then the drop, so nothing is
 * ever stranded (the one place a save can be corrupted; §"Settled"). Sites cleared: the mission squad
 * (`activeMissions[].squadDiscipleIds`), the expedition party (`world.expeditions[].discipleIds` and
 * `leaderId`), and the garrison roster (`world.locations[].garrison.discipleIds`). `assignedBuildingId`
 * is a field on the disciple, so it follows the drop for free. Pure; the store commits the result.
 */
export function removeDiscipleFromRoster(
  state: GameState,
  discipleId: string,
  opts: { returnGear: boolean; reason: RemovalReason },
): GameState {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return state

  let items = state.items
  if (opts.returnGear) {
    for (const slot of EQUIPMENT_SLOTS) {
      const instance = disciple.equipment[slot]
      if (instance) items = addExistingInstance(items, instance)
    }
  }

  const activeMissions = state.activeMissions.map((m) =>
    m.squadDiscipleIds.includes(discipleId)
      ? { ...m, squadDiscipleIds: m.squadDiscipleIds.filter((id) => id !== discipleId) }
      : m,
  )

  const world = state.world && {
    ...state.world,
    expeditions: state.world.expeditions.map((e) =>
      e.discipleIds.includes(discipleId)
        ? { ...e, discipleIds: e.discipleIds.filter((id) => id !== discipleId), leaderId: e.leaderId === discipleId ? undefined : e.leaderId }
        : e,
    ),
    locations: Object.fromEntries(
      Object.entries(state.world.locations).map(([id, runtime]) =>
        runtime.garrison?.discipleIds?.includes(discipleId)
          ? [id, { ...runtime, garrison: { ...runtime.garrison, discipleIds: runtime.garrison.discipleIds.filter((did) => did !== discipleId) } }]
          : [id, runtime],
      ),
    ),
  }

  return {
    ...state,
    items,
    disciples: state.disciples.filter((d) => d.id !== discipleId),
    activeMissions,
    // The seat-defense leader is a stored disciple id too — clear it so a fallen leader leaves no stale reference (getSeatDefenseLeaderId then re-picks).
    defenseLeaderId: state.defenseLeaderId === discipleId ? undefined : state.defenseLeaderId,
    world: world ?? state.world,
  }
}
