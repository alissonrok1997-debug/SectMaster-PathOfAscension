/**
 * Spirit Vein tiers (WORLD_MAP_DESIGN §7). A province stores a raw
 * `spiritVeinTier` (0–6); the named tier + its multipliers are derived through
 * this pure ladder and never stored as a label — the same "store a number,
 * derive the tier" convention as sectRank.ts / reputation (PROJECT.md).
 *
 * `unlocksBuildingIds` / `unlocksResearchIds` are wired into the construction /
 * research eligibility gates in a later phase; empty today because no
 * vein-gated content has been authored yet.
 */

export interface SpiritVeinDefinition {
  tier: number
  name: string
  cultivationMult: number
  recruitQualityMult: number
  unlocksBuildingIds: string[]
  unlocksResearchIds: string[]
  notes?: string
}

export const SPIRIT_VEIN_DEFS: SpiritVeinDefinition[] = [
  { tier: 0, name: 'Mortal', cultivationMult: 0.85, recruitQualityMult: 0.85, unlocksBuildingIds: [], unlocksResearchIds: [], notes: 'Punishing start; high-difficulty runs.' },
  { tier: 1, name: 'Low', cultivationMult: 1.0, recruitQualityMult: 1.0, unlocksBuildingIds: [], unlocksResearchIds: [], notes: 'Baseline.' },
  { tier: 2, name: 'Medium', cultivationMult: 1.15, recruitQualityMult: 1.1, unlocksBuildingIds: [], unlocksResearchIds: [] },
  { tier: 3, name: 'High', cultivationMult: 1.35, recruitQualityMult: 1.25, unlocksBuildingIds: [], unlocksResearchIds: [] },
  { tier: 4, name: 'Earth', cultivationMult: 1.6, recruitQualityMult: 1.45, unlocksBuildingIds: [], unlocksResearchIds: [], notes: 'Unlocks vein-gated buildings.' },
  { tier: 5, name: 'Heaven', cultivationMult: 2.0, recruitQualityMult: 1.7, unlocksBuildingIds: [], unlocksResearchIds: [], notes: 'Unlocks vein-gated research.' },
  { tier: 6, name: 'Immortal', cultivationMult: 2.6, recruitQualityMult: 2.0, unlocksBuildingIds: [], unlocksResearchIds: [], notes: 'Endgame / sealed provinces only.' },
]

const MIN_TIER = 0
const MAX_TIER = SPIRIT_VEIN_DEFS.length - 1

export function getSpiritVeinDef(tier: number): SpiritVeinDefinition {
  const clamped = Math.max(MIN_TIER, Math.min(MAX_TIER, Math.floor(tier)))
  return SPIRIT_VEIN_DEFS[clamped]
}

/**
 * The minimum Spirit Vein tier that unlocks a building / research, or undefined
 * if nothing vein-gates it (§7.3). Both return undefined today because no
 * unlocks are authored yet — the eligibility gates that read these are the
 * honest, inert seam, exactly like defenceMult (§14).
 */
export function getRequiredVeinTierForBuilding(buildingId: string): number | undefined {
  const tiers = SPIRIT_VEIN_DEFS.filter((v) => v.unlocksBuildingIds.includes(buildingId)).map((v) => v.tier)
  return tiers.length > 0 ? Math.min(...tiers) : undefined
}

export function getRequiredVeinTierForResearch(researchId: string): number | undefined {
  const tiers = SPIRIT_VEIN_DEFS.filter((v) => v.unlocksResearchIds.includes(researchId)).map((v) => v.tier)
  return tiers.length > 0 ? Math.min(...tiers) : undefined
}
