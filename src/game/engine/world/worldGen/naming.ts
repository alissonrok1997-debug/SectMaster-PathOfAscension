import type { RegionId, SectSiteTier } from '../../../types'
import type { WorldGenConfig } from './worldGenConfig'

/**
 * Name generation (WORLD_PROCGEN_PLAN Wave 2). Territory names are `Prefix Root`, the root drawn
 * from the region lexicon's tier register (grand roots for Good seats, humble ones for Poor), so
 * a name reads its region and stature the way the authored roster did. Sect names are
 * `Adjective Noun Suffix`. A shared used-set keeps every name realm-unique (invariant #7).
 */
export interface Namer {
  nameTerritory(regionId: RegionId, tier: SectSiteTier): string
  nameSect(): string
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export function createNamer(rng: () => number, config: WorldGenConfig): Namer {
  const used = new Set<string>()
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]

  const commit = (name: string, salt: () => string): string => {
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    for (let i = 0; i < 40; i++) {
      const alt = salt()
      if (!used.has(alt)) {
        used.add(alt)
        return alt
      }
    }
    // Exhausted the lexicon (shouldn't happen at these counts) — guarantee uniqueness with a numeral.
    let n = 2
    while (used.has(`${name} ${n}`)) n++
    const numbered = `${name} ${n}`
    used.add(numbered)
    return numbered
  }

  return {
    nameTerritory(regionId, tier) {
      const lex = config.nameLexicons[regionId]
      const make = () => `${pick(lex.prefixes)} ${cap(pick(lex.roots[tier]))}`
      return commit(make(), make)
    },
    nameSect() {
      const { adjectives, nouns, suffixes } = config.sectNameLexicon
      const make = () => `${pick(adjectives)} ${pick(nouns)} ${pick(suffixes)}`
      return commit(make(), make)
    },
  }
}
