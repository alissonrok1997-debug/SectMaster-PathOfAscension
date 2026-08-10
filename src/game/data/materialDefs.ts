/**
 * Crafting Recipe Pack, Phase 3 (CRAFTING_RECIPE_PACK.md §8): the 13 new crafting
 * materials the higher-tier recipes gate on. Stored in their own persisted bag
 * (`GameState.materials`, a `Record<materialId, number>`), separate from the six
 * core `Resources` so the top resource bar stays uncluttered.
 *
 * ACQUISITION IS NOT MODELLED YET. Per §8 no delivery mechanism (drops/expeditions/
 * nodes/trade) is proposed — for now the only source is the Debug panel's grant
 * button (`debugAddMaterials`). A real acquisition pass is deliberately deferred.
 *
 * `tier` mirrors §8's distribution shape (common T3-T4 mats vs. capstone T5 mats,
 * with two in between) — authoring metadata for a future acquisition pass; it
 * drives nothing mechanically today.
 */
export interface MaterialDefinition {
  id: string
  name: string
  description: string
  tier: 'common' | 'mid' | 'capstone'
}

export const MATERIAL_DEFS: MaterialDefinition[] = [
  {
    id: 'frostveinOre',
    name: 'Frostvein Ore',
    description: 'Ore cut from a frozen spirit vein; never warms in the hand.',
    tier: 'common',
  },
  {
    id: 'skyfallIron',
    name: 'Skyfall Iron',
    description: 'Meteoric iron, still faintly scorched.',
    tier: 'common',
  },
  {
    id: 'thunderStruckWood',
    name: 'Thunder-Struck Wood',
    description: 'Heartwood from a tree the heavens have already struck once.',
    tier: 'mid',
  },
  {
    id: 'serpentSinew',
    name: 'Serpent Sinew',
    description: 'Drawn from a spirit serpent; coils on its own when set down.',
    tier: 'mid',
  },
  {
    id: 'dragonboneSteel',
    name: 'Dragonbone Steel',
    description: 'Steel folded with powdered dragon bone.',
    tier: 'capstone',
  },
  {
    id: 'starfallEssence',
    name: 'Starfall Essence',
    description: 'Condensed starlight, kept in sealed jade. Also serves as ink.',
    tier: 'capstone',
  },
  {
    id: 'goldsheenSilk',
    name: 'Goldsheen Silk',
    description: 'Spun by golden spirit silkworms fed on spirit herb.',
    tier: 'common',
  },
  {
    id: 'earthheartJade',
    name: 'Earthheart Jade',
    description: "Jade from far below, where the earth's Qi pools.",
    tier: 'common',
  },
  {
    id: 'phoenixPlume',
    name: 'Phoenix Plume',
    description: 'A single shed feather. Warm to the touch, always.',
    tier: 'capstone',
  },
  {
    id: 'moonwellWater',
    name: 'Moonwell Water',
    description: 'Water from a well the moon reaches; never ripples.',
    tier: 'common',
  },
  {
    id: 'ancestralJade',
    name: 'Ancestral Jade',
    description: "Jade worn smooth by generations of a sect's hands.",
    tier: 'capstone',
  },
  {
    id: 'dragonHeartblood',
    name: 'Dragon Heartblood',
    description: 'Heartblood that has not cooled.',
    tier: 'capstone',
  },
  {
    id: 'millennialGinseng',
    name: 'Millennial Ginseng',
    description: 'A root a thousand years in the ground, shaped almost like a person.',
    tier: 'common',
  },
]

export function getMaterialDef(id: string): MaterialDefinition {
  const def = MATERIAL_DEFS.find((m) => m.id === id)
  if (!def) throw new Error(`Unknown material id: ${id}`)
  return def
}
