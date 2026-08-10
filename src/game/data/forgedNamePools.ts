import type { EquipmentSlotType } from '../types'

/**
 * EQUIPMENT_DEPTH_PLAN §6b — fragment pools for naming a Perfect/Masterwork piece. Mirrors the shape of
 * discipleNames.ts. A forged name is `<Epithet> <Noun>`, with the noun drawn per slot type so a robe
 * never becomes "Fang". Names are generated once at creation and persisted (engine/itemProvenance.ts).
 */
export const FORGED_EPITHETS: string[] = [
  'Frostbound',
  'Ninefold',
  'Quiet',
  'Ember',
  'Cloudrending',
  'Starfall',
  'Duskborn',
  'Ironwake',
  'Serene',
  'Thunderworn',
  'Jadeheart',
  'Ashen',
  'Everdawn',
  'Silent',
  'Mourning',
  'Boundless',
]

export const FORGED_NOUNS: Record<EquipmentSlotType, string[]> = {
  Weapon: ['Fang', 'Ember', 'Talon', 'Edge', 'Reaver', 'Thorn', 'Sliver', 'Requiem'],
  Armor: ['Vigil', 'Bulwark', 'Aegis', 'Mantle', 'Ward', 'Bastion', 'Shell', 'Shroud'],
  Accessory: ['Whisper', 'Charm', 'Eye', 'Tear', 'Seal', 'Knot', 'Ember', 'Vow'],
}
