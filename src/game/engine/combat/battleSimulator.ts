import {
  DISCIPLE_TEMPERAMENTS,
  type BattleOutcomeTier,
  type BattleTerrain,
  type CombatTrait,
  type DiscipleTemperament,
  type InjurySeverity,
  type NpcSectTier,
} from '../../types'
import { hashString, mulberry32 } from '../rng'
import { TRAIT_EFFECTS } from '../combatPower'

/**
 * The battle simulator (FIRST_REALM_PLAN §4.7) — one ruleset, two fidelity
 * modes. Combat is a non-interactive simulation: every prep decision (party,
 * leader, equipment/techniques already on the disciples) is committed before
 * dispatch; the outcome emerges from a seeded roll against a power ratio, not
 * a decided-up-front winner.
 *
 * Wave B only ever has the PLAYER as attacker (dispatched expeditions vs a
 * static NPC's abstract `strength`); Wave C adds the reverse — an NPC climbing
 * or raiding onto the player's seat/outposts — where the PLAYER's home roster
 * is the real, wound-eligible side instead. `attackerParticipants`/
 * `defenderParticipants` are therefore both optional and independent: whichever
 * side is backed by real disciples takes wound rolls, the other (an NPC with
 * no real roster) never does. Exactly one side has real participants in
 * practice — nobody yet fights another real disciple roster (PvP is future).
 */

export interface BattleParticipant {
  id: string
  name: string
  /** The disciple's stored combat temperament (#8), used to flavour their wound narration. Optional: an NPC façade has none, and it then falls back to a name hash. */
  temperament?: DiscipleTemperament
}

export interface BattleWound {
  discipleId: string
  severity: Exclude<InjurySeverity, 'none'>
}

export interface BattleOutcome {
  won: boolean
  /** Both sides broke off (Phase 9) — a mutual retreat with no winner. `won` is `false` on a draw; callers use `outcomeTier: 'draw'` and pay no rewards. Player-facing only (the outcome-only resolver never draws). */
  drawn: boolean
  /** The odds-only winner BEFORE the player-facing retreat layer (Phase 9) — i.e. what `resolveBattleOutcomeOnly` would decide from the same seed. Not persisted; exposed only so the Phase-10 smell-test can verify the two resolvers still agree on the base odds (invariant §4.7 #3), which retreat/draws deliberately reshape on top of. */
  oddsWon: boolean
  seed: number
  rounds: number
  attackerPower: number
  defenderPower: number
  wounds: BattleWound[]
  /** The fight's intensity (Phase 4/8) — returned so callers can derive the player-framed outcome tier via getOutcomeTier. Not persisted. */
  intensity: BattleIntensity
}

export interface BattleNarrative {
  outcome: BattleOutcome
  events: string[]
}

/** Past this power ratio the winner is fixed — preparation must always beat luck (design pillar, §4.7). */
const DECISIVE_WIN_RATIO = 1.75
const DECISIVE_LOSS_RATIO = 1 / DECISIVE_WIN_RATIO

/** Linear interpolation across the ambiguous band; the exact curve is tuning, not architecture (§4.7 "Open Wave-B detail"). */
function winProbability(ratio: number): number {
  if (ratio >= DECISIVE_WIN_RATIO) return 1
  if (ratio <= DECISIVE_LOSS_RATIO) return 0
  return (ratio - DECISIVE_LOSS_RATIO) / (DECISIVE_WIN_RATIO - DECISIVE_LOSS_RATIO)
}

export interface AdvantageBand {
  label: string
  /** 0 (Nearly Impossible) → 5 (Overwhelming) — for optional colour-coding. */
  tier: number
}

/**
 * Advantage bands (Combat Polishing Phase 3, #11) — pure presentation over the same win curve the resolver uses, so the label the player sees pre-dispatch
 * matches the odds they actually face (honest about the defender-favoured band, unlike a raw power-ratio comparison). No state, no effect on resolution.
 */
export function getAdvantageBand(attackerPower: number, defenderPower: number): AdvantageBand {
  const p = winProbability(attackerPower / Math.max(1, defenderPower))
  if (p >= 0.95) return { label: 'Overwhelming Advantage', tier: 5 }
  if (p >= 0.72) return { label: 'Strong Advantage', tier: 4 }
  if (p >= 0.5) return { label: 'Favorable', tier: 3 }
  if (p >= 0.28) return { label: 'Even Footing', tier: 2 }
  if (p >= 0.05) return { label: 'Unfavorable', tier: 1 }
  return { label: 'Nearly Impossible', tier: 0 }
}

/** Mirrors injury.ts's rollInjurySeverity() bands, but seeded (never Math.random — FIRST_REALM_PLAN §12). */
function rollWoundSeverity(rng: () => number): Exclude<InjurySeverity, 'none'> {
  const r = rng()
  if (r < 0.55) return 'minor'
  if (r < 0.9) return 'major'
  return 'critical'
}

// --- Feel layer (Combat Polishing Phase 3): flavour only, all derived from the seed + participant names, so the report regenerates identically. No new saved state.

/** How often a critical moment fires, and the ±swing it folds into the ratio (symmetric, so the win-rate the two resolvers share is unshifted — only variance rises). */
const CRIT_MOMENT_CHANCE = 0.22
const CRIT_SWING_MIN = 0.05
const CRIT_SWING_MAX = 0.1

const CRIT_MOMENT_FLAVOR = [
  'A formation collapses in the chaos',
  'A sudden qi storm erupts across the field',
  'A reckless gambit shatters the deadlock',
  'The ground gives way beneath the melee',
  'A hidden reserve surges into the fray',
]

const ROUND_BEAT_TENSE = [
  'The two sides trade blows, neither yielding.',
  'Formations clash and reform amid the dust.',
  'The advantage swings back and forth.',
  'Qi flares as the lines strain against each other.',
  'Neither side gives ground.',
]

const ROUND_BEAT_DECISIVE = [
  '{winner} presses the advantage.',
  "The line bends under {winner}'s assault.",
  '{winner} drives forward, unrelenting.',
  'The momentum belongs to {winner}.',
]

const WOUND_FLAVOR: Record<Exclude<InjurySeverity, 'none'>, string[]> = {
  minor: ['weathers a glancing strike and presses on.', 'takes a shallow cut but holds the line.', 'is grazed, but does not falter.'],
  major: ['is battered by a heavy blow and reels.', 'takes a grievous hit and staggers back.', 'is wounded badly, formation faltering.'],
  critical: ['falls, gravely wounded.', 'is struck down and dragged from the field.', 'collapses under a devastating blow.'],
}

/**
 * Personality-flavoured wound narration (#8): the disciple's stored temperament epithet + a seeded severity beat, replacing the flat "X takes a major wound".
 * Falls back to a name hash when no temperament is supplied (an NPC façade, or a pre-v20 report snapshot that didn't carry temperaments).
 */
function woundLine(name: string, temperament: DiscipleTemperament | undefined, severity: Exclude<InjurySeverity, 'none'>, rng: () => number): string {
  const epithet = temperament ?? DISCIPLE_TEMPERAMENTS[(hashString(name) >>> 0) % DISCIPLE_TEMPERAMENTS.length]
  const pool = WOUND_FLAVOR[severity]
  return `${name} ${epithet} ${pool[Math.floor(rng() * pool.length)]}`
}

// --- Battle intensity → clustered wounds (Combat Polishing Phase 4, #10 + #7). Computed at resolve time from the seed; no new saved state.

export type BattleIntensity = 'low' | 'medium' | 'high' | 'desperate'

/**
 * The casualty BUDGET each side draws from, as a fraction of that side's roster, split by outcome (#7): winning shifts losses DOWN but never to a
 * hard zero past Low — so "we won, but the elder still fell" happens in a brutal fight without casualties feeling like a per-head lottery.
 * These magnitudes are tuning, not architecture. Intensity is a hub: Phase 6 (leader) and Phase 7 (terrain) will feed `rollIntensity` later.
 */
const CASUALTY_FRACTION: Record<BattleIntensity, { winner: number; loser: number }> = {
  low: { winner: 0.0, loser: 0.25 },
  medium: { winner: 0.15, loser: 0.45 },
  high: { winner: 0.3, loser: 0.65 },
  desperate: { winner: 0.45, loser: 0.85 },
}

const INTENSITY_FLAVOR: Record<BattleIntensity, string> = {
  low: 'The clash is brief and one-sided.',
  medium: 'The fighting is fierce but controlled.',
  high: 'The battle is hard-fought and bloody.',
  desperate: 'The fighting is desperate — neither side willing to yield.',
}

/**
 * Combat effects of terrain (Phase 7, #4) — the ground the location's HOLDER (the defender) fights on. `defenderPowerMult` is applied by the caller before
 * the battle (baked into the stored power, snapshot-free); `intensityBias` shifts the Phase-4 intensity roll (sheltered ground → fewer casualties, exposed → more)
 * and needs the terrain snapshotted since it changes wounds at regen time. Magnitudes are tuning.
 */
export const TERRAIN_EFFECTS: Record<BattleTerrain, { defenderPowerMult: number; intensityBias: number; label: string }> = {
  open: { defenderPowerMult: 1.0, intensityBias: 0, label: 'open ground' },
  mountain: { defenderPowerMult: 1.15, intensityBias: -0.1, label: 'mountain slopes' },
  forest: { defenderPowerMult: 1.05, intensityBias: -0.15, label: 'dense forest' },
  river: { defenderPowerMult: 1.0, intensityBias: 0.1, label: 'a river crossing' },
  fortress: { defenderPowerMult: 1.3, intensityBias: -0.2, label: 'fortified walls' },
  sacred: { defenderPowerMult: 1.1, intensityBias: 0.1, label: 'contested sacred ground' },
}

/** Closeness dominates (a blowout is low-intensity → few losses; a nail-biter is desperate → many), plus seeded jitter and a terrain bias (Phase 7). */
function rollIntensity(closeness: number, bias: number, rng: () => number): BattleIntensity {
  const score = closeness * 0.7 + rng() * 0.3 + bias
  if (score < 0.3) return 'low'
  if (score < 0.55) return 'medium'
  if (score < 0.8) return 'high'
  return 'desperate'
}

/** Stochastic rounding: the fractional part becomes the chance of one more casualty, so the expected count is exactly `fraction × size` with natural variance. */
function casualtyBudget(fraction: number, size: number, rng: () => number): number {
  if (size <= 0) return 0
  return Math.min(size, Math.floor(fraction * size + rng()))
}

/** Wound `budget` DISTINCT members of one side (a cluster), rather than rolling every member independently. Seeded shuffle → deterministic for report regen. */
function distributeWounds(
  participants: BattleParticipant[],
  budget: number,
  rng: () => number,
  wounds: BattleWound[],
  events: string[],
): void {
  const count = Math.min(budget, participants.length)
  if (count <= 0) return
  const order = participants.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (let k = 0; k < count; k++) {
    const p = participants[order[k]]
    const severity = rollWoundSeverity(rng)
    wounds.push({ discipleId: p.id, severity })
    events.push(woundLine(p.name, p.temperament, severity, rng))
  }
}

// --- Retreat & draws (Combat Polishing Phase 9, #6). Player-facing only: the outcome-only resolver below is untouched, so the background NPC-vs-NPC win/lose statistics are unaffected (settled scope).

// Only a genuinely contested grind (high/desperate — which by rollIntensity only happens when the fight is close) puts the WINNING side under any pressure
// to pull back; a blowout is low/medium, so a decisive winner never flees (preparation-beats-luck legibility, §4.7). The losing side gets a separate bonus.
const INTENSITY_RETREAT_PRESSURE: Record<BattleIntensity, number> = { low: 0, medium: 0, high: 0.12, desperate: 0.26 }
/** The side losing by the raw odds breaks off more readily — this is what makes a lost fight read as a "fighting retreat" even in a low-intensity rout. */
const LOSING_SIDE_RETREAT_BONUS = 0.15

/**
 * Chance a side disengages this fight. Inputs are the plan's morale + leader + losses + odds: intensity stands in for how bloody it got (losses),
 * `losingByOdds` is the odds pressure, and the leader's `retreatBias` is the temperament. Morale needs no separate input — Phase 5 already folded it
 * into each side's power, so it reaches this check through the odds (and thus through intensity). If there is no pressure at all (a clean, low/medium
 * fight the side is winning) it never breaks — temperament alone can't make a dominant side flee. Clamped so no side is ever certain to break.
 */
function retreatChance(intensity: BattleIntensity, losingByOdds: boolean, trait?: CombatTrait): number {
  const base = INTENSITY_RETREAT_PRESSURE[intensity] + (losingByOdds ? LOSING_SIDE_RETREAT_BONUS : 0)
  if (base <= 0) return 0
  const bias = trait ? TRAIT_EFFECTS[trait].retreatBias : 0
  return Math.max(0, Math.min(0.85, base + bias))
}

/**
 * Closed-form resolver (§4.7) — outcome-only, O(1), for background NPC-vs-NPC
 * in the world sim (Wave C). Shares `winProbability` with the full simulator
 * by construction, so it is calibrated to agree with it by definition rather
 * than by separate tuning.
 */
export function resolveBattleOutcomeOnly(seed: number, attackerPower: number, defenderPower: number): { won: boolean } {
  const rng = mulberry32(seed)
  const ratio = attackerPower / Math.max(1, defenderPower)
  return { won: rng() < winProbability(ratio) }
}

/**
 * Full per-unit simulation (§4.7) — for any battle the player is in or
 * watching. Deterministic given (seed, attackerPower, defenderPower,
 * participant names): re-invoking with the same inputs reproduces an
 * identical outcome AND narrative, which is how BattleReportView regenerates
 * the story from just the stored outcome + seed, with nothing round-by-round
 * persisted (§4.7's "no stored round-by-round log").
 */
export function resolveBattle(params: {
  seed: number
  attackerPower: number
  defenderPower: number
  attackerParticipants?: BattleParticipant[]
  attackerLeaderId?: string
  /** Combat trait of the attacking leader (Phase 6) — scales the attacker's casualty budget and colours the narrative. Its power effect is already baked into `attackerPower`. */
  attackerLeaderTrait?: CombatTrait
  /** Flavour label for the attacking side when it has no real roster (an NPC) — ignored if `attackerParticipants` has a leader. */
  attackerName?: string
  defenderParticipants?: BattleParticipant[]
  defenderLeaderId?: string
  /** Combat trait of the defending leader (Phase 6) — scales the defender's casualty budget; power effect already baked into `defenderPower`. */
  defenderLeaderTrait?: CombatTrait
  /** The ground fought on (Phase 7) — biases intensity + flavours the narrative. Its power effect is already baked into `defenderPower`. */
  terrain?: BattleTerrain
  defenderName: string
}): BattleNarrative {
  const {
    seed,
    attackerPower,
    defenderPower,
    attackerParticipants = [],
    attackerLeaderId,
    attackerLeaderTrait,
    attackerName,
    defenderParticipants = [],
    defenderLeaderId,
    defenderLeaderTrait,
    terrain,
    defenderName,
  } = params
  const rng = mulberry32(seed)
  const baseRatio = attackerPower / Math.max(1, defenderPower)
  const attackerLeaderName = attackerLeaderId ? attackerParticipants.find((p) => p.id === attackerLeaderId)?.name : undefined
  const defenderLeaderName = defenderLeaderId ? defenderParticipants.find((p) => p.id === defenderLeaderId)?.name : undefined
  const attackerLabel = attackerLeaderName ?? attackerName ?? 'the attacking party'

  // Critical moment (#9): a seeded, symmetric ±5–10% swing folded into the ratio BEFORE the win check — a landslide stays a landslide, but a
  // near-even fight can produce a rare upset. The draw is conditional, but the code path is identical at resolve- and regen-time, so it stays deterministic.
  let ratio = baseRatio
  let critEvent: string | undefined
  if (rng() < CRIT_MOMENT_CHANCE) {
    const favorsAttacker = rng() < 0.5
    const swing = CRIT_SWING_MIN + rng() * (CRIT_SWING_MAX - CRIT_SWING_MIN)
    ratio = favorsAttacker ? baseRatio * (1 + swing) : baseRatio * (1 - swing)
    const flavor = CRIT_MOMENT_FLAVOR[Math.floor(rng() * CRIT_MOMENT_FLAVOR.length)]
    critEvent = `${flavor} — the moment favours ${favorsAttacker ? attackerLabel : defenderName}.`
  }

  const oddsWon = rng() < winProbability(ratio)
  const rounds = 3 + Math.floor(rng() * 4)
  // How evenly matched the fight was (1 = dead even, 0 = a total blowout either way) — drives intensity and round beats, never the outcome.
  const closeness = 1 - Math.min(1, Math.abs(ratio - 1))
  // One intensity roll for the whole fight (#10) — the hub that sets the casualty budget below, now also fed by terrain (#7).
  const intensity = rollIntensity(closeness, terrain ? TERRAIN_EFFECTS[terrain].intensityBias : 0, rng)

  // Retreat & draws (Phase 9, #6): between the round beats each side checks whether to break off. Retreating FIRST forfeits the field — so a side that would
  // have won by the odds can still lose if a grinding fight and a cautious leader make it pull back (the occasional Pyrrhic reversal). If BOTH break off it is
  // a draw, the one genuinely new terminal state (no winner, no rewards). The two rolls are seeded like everything else, so the report regenerates identically.
  const attackerRetreats = rng() < retreatChance(intensity, !oddsWon, attackerLeaderTrait)
  const defenderRetreats = rng() < retreatChance(intensity, oddsWon, defenderLeaderTrait)
  const drawn = attackerRetreats && defenderRetreats
  // Whoever breaks off alone loses; otherwise the odds stand.
  const won = drawn ? false : attackerRetreats ? false : defenderRetreats ? true : oddsWon

  const events: string[] = []
  events.push(
    attackerLeaderName
      ? `${attackerLeaderName}${attackerLeaderTrait ? ` (${TRAIT_EFFECTS[attackerLeaderTrait].label})` : ''} leads the assault against ${defenderName}.`
      : `${attackerName ?? 'The attacking party'} clashes with ${defenderName}.`,
  )
  if (defenderLeaderName) {
    events.push(`${defenderLeaderName}${defenderLeaderTrait ? ` (${TRAIT_EFFECTS[defenderLeaderTrait].label})` : ''} rallies the defense.`)
  }
  if (terrain && terrain !== 'open') events.push(`The battle is joined on ${TERRAIN_EFFECTS[terrain].label}.`)
  events.push(INTENSITY_FLAVOR[intensity])

  // Round beats (rounds option (a)): derived from closeness + the (already-decided) winner, purely narrative — a tense fight trades blows, a lopsided one is a rout.
  // A draw reads as tense throughout (neither side ever pulls decisively ahead).
  const winnerLabel = won ? attackerLabel : defenderName
  const beats: string[] = []
  for (let i = 0; i < rounds; i++) {
    const pool = drawn || closeness > 0.45 ? ROUND_BEAT_TENSE : ROUND_BEAT_DECISIVE
    beats.push(pool[Math.floor(rng() * pool.length)].replace('{winner}', winnerLabel))
  }
  if (critEvent) beats.splice(Math.floor(beats.length / 2), 0, critEvent)
  events.push(...beats)

  // Clustered wounds (#10 + #7): intensity + who-won set each side's casualty budget, then that many DISTINCT members are wounded — a cluster, not a
  // per-head lottery, so a one-sided victory can be flawless while a desperate one still costs an elder. Wounds are player-facing only; the background
  // resolver rolls none, so its statistical agreement with this resolver is unaffected.
  const wounds: BattleWound[] = []
  const frac = CASUALTY_FRACTION[intensity]
  // A leader's trait scales ONLY their own side's casualty budget (#7's budget shift): aggressive/ruthless bleed more, defensive/cautious far less.
  const attackerCasMult = attackerLeaderTrait ? TRAIT_EFFECTS[attackerLeaderTrait].ownCasualtyMult : 1
  const defenderCasMult = defenderLeaderTrait ? TRAIT_EFFECTS[defenderLeaderTrait].ownCasualtyMult : 1
  // On a draw both sides disengaged before it turned decisive → each takes the lighter "winner" share; otherwise the final loser bleeds the "loser" share.
  const attackerFrac = drawn ? frac.winner : won ? frac.winner : frac.loser
  const defenderFrac = drawn ? frac.winner : won ? frac.loser : frac.winner
  distributeWounds(attackerParticipants, casualtyBudget(attackerFrac * attackerCasMult, attackerParticipants.length, rng), rng, wounds, events)
  distributeWounds(defenderParticipants, casualtyBudget(defenderFrac * defenderCasMult, defenderParticipants.length, rng), rng, wounds, events)

  // Closing beat reflects the terminal state — a clean result, a first-mover retreat, or a mutual break-off (draw).
  if (drawn) events.push(`Both sides, spent and bloodied, break off — the field is left contested.`)
  else if (attackerRetreats) events.push(`${attackerLabel} breaks off the assault and withdraws.`)
  else if (defenderRetreats) events.push(`${defenderName} yields the field and withdraws.`)
  else events.push(won ? `${defenderName}'s defenders break.` : `The attack is repelled.`)

  return {
    outcome: { won, drawn, oddsWon, seed, rounds, attackerPower, defenderPower, wounds, intensity },
    events,
  }
}

/**
 * Player-framed outcome tier (Phase 8, #5) from margin + intensity. `playerRatio` is the player's power over the enemy's (so callers invert it on defense).
 * A dominant, un-grinding win is Crushing; a win that was a desperate near-run thing is Narrow. A loss where the player was overwhelmed is Catastrophic
 * (this is what gives a lopsided defeat teeth — via consequences below — even though its low intensity means few CASUALTIES); a hard-fought loss is a Fighting Retreat.
 */
export function getOutcomeTier(playerWon: boolean, playerRatio: number, intensity: BattleIntensity): BattleOutcomeTier {
  const hard = intensity === 'high' || intensity === 'desperate'
  if (playerWon) {
    if (playerRatio >= DECISIVE_WIN_RATIO && !hard) return 'crushing'
    if (playerRatio >= 1.2 && intensity !== 'desperate') return 'decisive'
    return 'narrow'
  }
  if (playerRatio <= DECISIVE_LOSS_RATIO) return 'catastrophic'
  if (hard) return 'fightingRetreat'
  return 'defeat'
}

export const TIER_LABEL: Record<BattleOutcomeTier, string> = {
  crushing: 'Crushing Victory',
  decisive: 'Decisive Victory',
  narrow: 'Narrow Victory',
  draw: 'Stalemate',
  fightingRetreat: 'Fighting Retreat',
  defeat: 'Defeat',
  catastrophic: 'Catastrophic Defeat',
}

/** Raid/attack loot scales with how decisive the win was (loss AND draw tiers never loot). Tuning. */
export const TIER_LOOT_MULT: Record<BattleOutcomeTier, number> = {
  crushing: 1.5,
  decisive: 1.0,
  narrow: 0.6,
  draw: 0,
  fightingRetreat: 0,
  defeat: 0,
  catastrophic: 0,
}

/** Reputation ("prestige") swing per outcome, player-framed. Applied to the mutable sect reputation stat on world-map battles. A draw is inconclusive → no swing. Tuning. */
export const TIER_REPUTATION_DELTA: Record<BattleOutcomeTier, number> = {
  crushing: 6,
  decisive: 3,
  narrow: 1,
  draw: 0,
  fightingRetreat: -1,
  defeat: -3,
  catastrophic: -8,
}

const FACADE_TITLES = ['Elder', 'Deacon', 'Disciple', 'Warden', 'Sentinel', 'Adept']
const FACADE_COUNT_BY_TIER: Record<NpcSectTier, number> = { minor: 3, regional: 4, major: 5, legendary: 6 }

/**
 * A lightweight, deterministic named roster for a background NPC (§4.7's "NPC
 * roster façade") — purely flavour text for the narrative, never persisted and
 * never wound-tracked (NPCs have no real disciples, only the `strength` scalar).
 */
export function generateNpcFacadeName(npcId: string, npcName: string, tier: NpcSectTier, seed: number): string {
  const rng = mulberry32((hashString(npcId) ^ seed) >>> 0)
  const count = FACADE_COUNT_BY_TIER[tier]
  const title = FACADE_TITLES[Math.floor(rng() * FACADE_TITLES.length)]
  return `${title}s of ${npcName} (${count} defenders)`
}
