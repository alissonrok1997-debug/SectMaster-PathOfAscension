import type { EquipmentSlotId, EquipmentSlotType, GameState, ItemInstance } from '../types'
import { FORGED_EPITHETS, FORGED_NOUNS } from '../data/forgedNamePools'

/**
 * EQUIPMENT_DEPTH_PLAN §6 — item provenance: generated names for top-tier rolls and the running
 * battle-victory tally on equipped gear. Pure additive flavor — no combat formula is touched.
 */

/** Generates a `<Epithet> <Noun>` name for a Perfect/Masterwork piece (§6b), the noun drawn from its slot type's pool. */
export function generateForgedName(slotType: EquipmentSlotType): string {
  const epithet = FORGED_EPITHETS[Math.floor(Math.random() * FORGED_EPITHETS.length)]
  const nouns = FORGED_NOUNS[slotType]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${epithet} ${noun}`
}

/**
 * §6c — increments `battlesWon` on every piece equipped by each disciple in `squadIds`, for a victory that
 * side just won. Called by each battle resolver on a genuine win (not a draw). Survivors only: dead
 * disciples have already been removed from the roster by the downed pass, so their gear no longer counts.
 */
export function recordEquipmentBattlesWon(state: GameState, squadIds: string[]): GameState {
  const ids = new Set(squadIds)
  let anyChanged = false
  const disciples = state.disciples.map((d) => {
    if (!ids.has(d.id)) return d
    let changed = false
    const equipment = { ...d.equipment }
    for (const slot of Object.keys(equipment) as EquipmentSlotId[]) {
      const inst = equipment[slot]
      if (inst) {
        equipment[slot] = { ...inst, battlesWon: (inst.battlesWon ?? 0) + 1 }
        changed = true
      }
    }
    if (!changed) return d
    anyChanged = true
    return { ...d, equipment }
  })
  return anyChanged ? { ...state, disciples } : state
}

/** §6 — the item's history line for the inventory/detail view: crafter, first wielder, and victories borne. */
export function describeProvenance(instance: ItemInstance): string {
  const parts: string[] = [instance.craftedBy ? `Forged by ${instance.craftedBy}` : 'Forged at the Sect Forge']
  if (instance.firstWielder) parts.push(`first borne by ${instance.firstWielder}`)
  if (instance.battlesWon && instance.battlesWon > 0) {
    parts.push(`${instance.battlesWon} ${instance.battlesWon === 1 ? 'victory' : 'victories'}`)
  }
  return parts.join(' · ')
}
