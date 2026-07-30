import type { ExplorationArchetypeId } from '../../types'

/**
 * Exploration archetypes (WORLD_MAP_DESIGN §6.1 / §10.1). Same archetype/landmark
 * split as the resource archetypes: mechanics here, specifics on each location.
 * Exploration yields route through existing systems (items, techniques, events)
 * via reward tables authored in a later phase (§6.2), so no reward primitive
 * lives here.
 */
export interface ExplorationArchetypeDefinition {
  id: ExplorationArchetypeId
  label: string
  icon: string
  description: string
}

export const EXPLORATION_ARCHETYPE_DEFS: ExplorationArchetypeDefinition[] = [
  { id: 'ancientRuins', label: 'Ancient Ruins', icon: '🏛️', description: 'Toppled sect grounds hiding relics and manuals.' },
  { id: 'ancientBattlefield', label: 'Ancient Battlefield', icon: '⚔️', description: 'A field of old slaughter, dense with residual killing intent.' },
  { id: 'dragonTomb', label: 'Dragon Tomb', icon: '🐉', description: 'The resting place of a fallen spirit dragon.' },
  { id: 'hiddenCave', label: 'Hidden Cave', icon: '🕳️', description: 'A concealed grotto that rewards the thorough scout.' },
  { id: 'immortalPavilion', label: 'Immortal Pavilion', icon: '🏯', description: 'A half-real pavilion left by a departed immortal.' },
  { id: 'secretRealmEntrance', label: 'Secret Realm Entrance', icon: '🌀', description: 'A gate into an instanced trial realm.' },
]

export function getExplorationArchetype(id: ExplorationArchetypeId): ExplorationArchetypeDefinition {
  const def = EXPLORATION_ARCHETYPE_DEFS.find((a) => a.id === id)
  if (!def) throw new Error(`Unknown exploration archetype id: ${id}`)
  return def
}
