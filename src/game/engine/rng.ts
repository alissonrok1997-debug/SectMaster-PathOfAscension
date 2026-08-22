/**
 * Shared seeded PRNG (FIRST_REALM_PLAN §12). All simulation randomness — node
 * generation, NPC decisions, combat rolls, emergence — must draw from this
 * rather than `Math.random()`, so the same seed always reproduces the same
 * world (multiplayer-readiness, save-scum-proof combat). Established in Wave A
 * ahead of the systems that need it (Wave B combat, Wave C NPC sim) because
 * retrofitting determinism after the fact is the expensive path.
 */

/** Deterministic 32-bit hash of a string, mixed with the world seed by callers. */
export function hashString(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32 — a small, fast, well-distributed seeded PRNG returning [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface NumberRange {
  min: number
  max: number
}

export function rollInt(rng: () => number, range: NumberRange): number {
  return Math.floor(range.min + rng() * (range.max - range.min + 1))
}

/** Rolls a float in [min, max], rounded to `decimals` places (default 2) so modifier values stay tidy. */
export function rollFloat(rng: () => number, range: NumberRange, decimals = 2): number {
  const scale = 10 ** decimals
  return Math.round((range.min + rng() * (range.max - range.min)) * scale) / scale
}
