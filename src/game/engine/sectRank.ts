/**
 * Sect Rank (doc 02, Section 4). Roadmap Wave 1 scopes this to the first
 * three tiers of the full seven-tier ladder. Rank gates the outer level
 * cap for every building, including the Sect Hall itself; advancement is
 * simplified to a Sect Hall level threshold since disciple count and
 * reputation (the full doc's other gates) don't exist until later waves.
 */

export type SectRankName = 'Unranked Sect' | 'Minor Sect' | 'Lesser Sect'

interface RankTier {
  name: SectRankName
  levelCap: number
  unlockAtHallLevel: number
}

const TIERS: RankTier[] = [
  { name: 'Unranked Sect', levelCap: 3, unlockAtHallLevel: 1 },
  { name: 'Minor Sect', levelCap: 6, unlockAtHallLevel: 3 },
  { name: 'Lesser Sect', levelCap: 10, unlockAtHallLevel: 6 },
]

export interface SectRankInfo {
  name: SectRankName
  /** No building — including the Sect Hall — may be upgraded past this level at the current rank. */
  levelCap: number
  /** Sect Hall level that unlocks the next rank tier, or undefined if already at the top scoped tier. */
  nextRankAtHallLevel?: number
}

export function computeSectRank(hallLevel: number): SectRankInfo {
  let current = TIERS[0]
  for (const tier of TIERS) {
    if (hallLevel >= tier.unlockAtHallLevel) current = tier
  }
  const next = TIERS[TIERS.indexOf(current) + 1]
  return {
    name: current.name,
    levelCap: current.levelCap,
    nextRankAtHallLevel: next?.unlockAtHallLevel,
  }
}
