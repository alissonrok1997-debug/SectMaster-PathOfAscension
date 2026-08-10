import {
  type BattleOutcomeTier,
  type BattleTerrain,
  type CombatTrait,
  type DiscipleTemperament,
  type InjurySeverity,
  type NpcSectTier,
} from '../../types'
import { hashString, mulberry32 } from '../rng'
import { TRAIT_EFFECTS } from '../combatPower'
import {
  ACTOR_CLAUSE,
  CRIT_MOMENT_FLAVOR,
  EMBELLISH_CHANCE,
  INTENSITY_FLAVOR,
  MOMENTUM_SWING,
  PHASE_POOLS,
  ROUNDS_BY_INTENSITY,
  SETTING_CLAUSE,
  TRAIT_CLAUSE,
  TURNING_VIVID,
  woundLine,
} from '../../data/combat/battleNarrationPools'

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

/** What role a narrative line plays (§9) — lets the report render round headers, style the turning point, dim wounds, and build a summary view from the same pass. */
export type BattleEventKind = 'opening' | 'beat' | 'crit' | 'wound' | 'closing'

export interface BattleEvent {
  /** The arc phase this line belongs to (prologue scene-setting lines are tagged `opening`). Drives the round headers. */
  phase: BattlePhase
  kind: BattleEventKind
  text: string
}

export interface BattleNarrative {
  outcome: BattleOutcome
  /** Typed, phase-tagged narrative (§9). Regenerated deterministically; never persisted. Use `.map(e => e.text)` for a plain-string view. */
  events: BattleEvent[]
  /**
   * The regenerated arc length (§4b) — derived from intensity on the narration stream, NOT persisted. The report header shows this, not `BattleResult.rounds`
   * (a legacy field kept only for save compatibility and no longer read for display), so a stored "5 rounds" never contradicts a four-beat regenerated body.
   */
  rounds: number
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

// --- Narrative arc (Battle Narration plan §4). The round slots map to named phases so each beat has a ROLE instead of being interchangeable flavour;
// Escalation reuses the generic "trade blows" pools above. Each phase carries a tense variant (a close fight) and a decisive one (a rout, keyed on {winner}).
// Kept deliberately restrained — the richer wuxia imagery and additive terrain/actor clauses arrive in Phase 7; this phase is structure, not prose.
export type BattlePhase = 'opening' | 'escalation' | 'turning' | 'finalPush' | 'resolution'

// Momentum bridge tuning (§14.2). JITTER is the max early swing amplitude (scaled by closeness and decaying to 0 by the last round); BAND is the |momentum|
// below which the fight reads as contested (tense pool) rather than one side pressing; CRIT_SPIKE is the one-round shove the crit adds toward the side it favoured.
const MOMENTUM_JITTER = 0.4
const MOMENTUM_BAND = 0.22
const MOMENTUM_CRIT_SPIKE = 0.4

/** The arc for a given round count (§4's table). A draw / Pyrrhic reversal is forced to >=5 rounds by the caller so its Final-Push slot always exists. arc.length === rounds. */
function buildArc(rounds: number): BattlePhase[] {
  if (rounds <= 3) return ['opening', 'turning', 'resolution']
  if (rounds === 4) return ['opening', 'escalation', 'turning', 'resolution']
  if (rounds === 5) return ['opening', 'escalation', 'turning', 'finalPush', 'resolution']
  return ['opening', 'escalation', 'escalation', 'turning', 'finalPush', 'resolution']
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

/** One collected casualty line + its severity, so the assembler can bias critical wounds toward the Turning Point group (§14.3) when it splits a large cluster. */
interface WoundBeat {
  text: string
  severity: Exclude<InjurySeverity, 'none'>
}

/**
 * Wound `budget` DISTINCT members of one side (a cluster), rather than rolling every member independently. Seeded shuffle → deterministic for report regen.
 * Collects the casualty lines into `cluster` (in draw order) instead of pushing them straight into the event log — the caller attaches the whole cluster to
 * the arc as a unit (§6), so casualties read as consequences of the round that caused them rather than a trailing block.
 */
function distributeWounds(
  participants: BattleParticipant[],
  budget: number,
  rng: () => number,
  wounds: BattleWound[],
  cluster: WoundBeat[],
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
    cluster.push({ text: woundLine(p.name, p.temperament, severity, rng), severity })
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
  // Narration draws (WHICH flavour string) live on a SEPARATE seeded stream from resolution (Battle Narration plan §2), so flavour pools can grow in later
  // phases without ever reshuffling combat outcomes. Every narration draw that used to come off `rng` is replaced there by a discard that preserves the
  // historical resolution sequence exactly (§14.1); its value moves here. Resolution (crit swing, oddsWon, rounds, intensity, retreat, wounds) stays on `rng`.
  const nrng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  // Draw-without-replacement per pool within one report (§10) — kills the "Momentum belongs to X ×5" repeat. Deterministic (all off nrng); resets a pool only once exhausted.
  const poolUsed = new Map<readonly string[], Set<number>>()
  const pick = (pool: readonly string[]): string => {
    let used = poolUsed.get(pool)
    if (!used) {
      used = new Set()
      poolUsed.set(pool, used)
    }
    if (used.size >= pool.length) used.clear()
    let idx = Math.floor(nrng() * pool.length)
    while (used.has(idx)) idx = (idx + 1) % pool.length
    used.add(idx)
    return pool[idx]
  }
  const baseRatio = attackerPower / Math.max(1, defenderPower)
  const attackerLeaderName = attackerLeaderId ? attackerParticipants.find((p) => p.id === attackerLeaderId)?.name : undefined
  const defenderLeaderName = defenderLeaderId ? defenderParticipants.find((p) => p.id === defenderLeaderId)?.name : undefined
  const attackerLabel = attackerLeaderName ?? attackerName ?? 'the attacking party'

  // Critical moment (#9): a seeded, symmetric ±5–10% swing folded into the ratio BEFORE the win check — a landslide stays a landslide, but a
  // near-even fight can produce a rare upset. The draw is conditional, but the code path is identical at resolve- and regen-time, so it stays deterministic.
  let ratio = baseRatio
  let critEvent: string | undefined
  let critFavorsAttacker: boolean | undefined // exposed to the momentum bridge (Phase 4) so the crit reads as a visible spike at the Turning Point.
  if (rng() < CRIT_MOMENT_CHANCE) {
    const favorsAttacker = rng() < 0.5
    const swing = CRIT_SWING_MIN + rng() * (CRIT_SWING_MAX - CRIT_SWING_MIN)
    ratio = favorsAttacker ? baseRatio * (1 + swing) : baseRatio * (1 - swing)
    rng() // discard (§14.1 site 1): preserve the historical flavour-index draw that sat before the oddsWon draw — moving it silently would flip a saved `won`. The pick moves to nrng.
    const flavor = pick(CRIT_MOMENT_FLAVOR)
    critFavorsAttacker = favorsAttacker
    critEvent = `${flavor} — the moment favours ${favorsAttacker ? attackerLabel : defenderName}.`
  }

  const oddsWon = rng() < winProbability(ratio)
  // `legacyRounds` is the ORIGINAL resolution draw — kept purely to drive the discard count (§14.1 site 2) so the resolution sequence stays frozen now that the
  // narrative round count is derived from intensity instead (§4b, computed below on the narration stream). Never derive one from the other.
  const legacyRounds = 3 + Math.floor(rng() * 4)
  // How evenly matched the fight was (1 = dead even, 0 = a total blowout either way) — drives intensity and round beats, never the outcome.
  const closeness = 1 - Math.min(1, Math.abs(ratio - 1))
  // One intensity roll for the whole fight (#10) — the hub that sets the casualty budget below, now also fed by terrain (#7).
  const intensity = rollIntensity(closeness, terrain ? TERRAIN_EFFECTS[terrain].intensityBias : 0, rng)
  const hard = intensity === 'high' || intensity === 'desperate' // used by the vivid Turning Point (§5) and the Resolution magnitude (§8)

  // Retreat & draws (Phase 9, #6): between the round beats each side checks whether to break off. Retreating FIRST forfeits the field — so a side that would
  // have won by the odds can still lose if a grinding fight and a cautious leader make it pull back (the occasional Pyrrhic reversal). If BOTH break off it is
  // a draw, the one genuinely new terminal state (no winner, no rewards). The two rolls are seeded like everything else, so the report regenerates identically.
  const attackerRetreats = rng() < retreatChance(intensity, !oddsWon, attackerLeaderTrait)
  const defenderRetreats = rng() < retreatChance(intensity, oddsWon, defenderLeaderTrait)
  const drawn = attackerRetreats && defenderRetreats
  // Whoever breaks off alone loses; otherwise the odds stand.
  const won = drawn ? false : attackerRetreats ? false : defenderRetreats ? true : oddsWon
  // A side that held the odds but pulled back and lost the field — the best story the sim produces (§8). Always coincides with exactly one retreat.
  const reversal = !drawn && oddsWon !== won

  // Report length derived from intensity (§4b), on the narration stream so it never perturbs resolution. A draw / reversal is forced to >=5 so its Final-Push slot exists.
  let narrativeRounds = ROUNDS_BY_INTENSITY[intensity] + (Math.floor(nrng() * 3) - 1) // ±1 jitter
  narrativeRounds = Math.max(3, Math.min(6, narrativeRounds))
  if ((drawn || reversal) && narrativeRounds < 5) narrativeRounds = 5
  const arc = buildArc(narrativeRounds)

  const events: BattleEvent[] = []
  const add = (kind: BattleEventKind, phase: BattlePhase, text: string): void => void events.push({ phase, kind, text })
  // Prologue scene-setting (tagged `opening`): who leads, the ground, and the fight's overall temper.
  add(
    'opening',
    'opening',
    attackerLeaderName
      ? `${attackerLeaderName}${attackerLeaderTrait ? ` (${TRAIT_EFFECTS[attackerLeaderTrait].label})` : ''} leads the assault against ${defenderName}.`
      : `${attackerName ?? 'The attacking party'} clashes with ${defenderName}.`,
  )
  if (defenderLeaderName) {
    add('opening', 'opening', `${defenderLeaderName}${defenderLeaderTrait ? ` (${TRAIT_EFFECTS[defenderLeaderTrait].label})` : ''} rallies the defense.`)
  }
  if (terrain && terrain !== 'open') add('opening', 'opening', `The battle is joined on ${TERRAIN_EFFECTS[terrain].label}.`)
  add('opening', 'opening', INTENSITY_FLAVOR[intensity])

  // Discard the historical per-beat flavour draws (§14.1 site 2): exactly one per LEGACY round, decoupled from the arc length — so the resolution sequence
  // (and the wound rolls that follow) is unshifted. Everything the beats draw is on nrng, so none of this perturbs the outcome.
  for (let i = 0; i < legacyRounds; i++) rng()

  // The momentum bridge (§3, §14.2): a scalar in [-1,+1] (+ favours the attacker) generated as an interpolation from the opening power gap toward a KNOWN
  // endpoint, with jitter that decays to zero — so early rounds swing freely but the late rounds always converge on the real outcome. It never feeds back into
  // resolution; it only decides which side each beat shows pressing, and whether the advantage genuinely swung. The combat slots are the arc minus Resolution.
  const combatPhases = arc.filter((p): p is Exclude<BattlePhase, 'resolution'> => p !== 'resolution')
  const slots = combatPhases.length
  // A reversal ran the fight toward the odds-winner (the side that ends up LOSING after it breaks off); every other result runs straight toward the winner.
  const target = drawn ? 0 : reversal ? (oddsWon ? 1 : -1) : won ? 1 : -1
  const endpoint = drawn ? 0 : won ? 1 : -1
  const m0 = Math.max(-0.5, Math.min(0.5, (baseRatio - 1) * 0.6))
  const momentum: number[] = []
  for (let i = 0; i < slots; i++) {
    const frac = slots > 1 ? i / (slots - 1) : 1
    const eased = frac * frac * (3 - 2 * frac) // smoothstep — commit late
    let v = m0 + (target - m0) * eased
    v += (nrng() * 2 - 1) * MOMENTUM_JITTER * closeness * (1 - frac) // decaying jitter: free early, committed late
    if (combatPhases[i] === 'turning' && critFavorsAttacker !== undefined) v += (critFavorsAttacker ? 1 : -1) * MOMENTUM_CRIT_SPIKE
    // Pyrrhic snap (§14.2): at the Final Push the side that held the odds breaks off, so momentum flips to the actual winner. The sign flip IS the story.
    if (combatPhases[i] === 'finalPush' && reversal) v = endpoint * 0.7
    momentum.push(Math.max(-1, Math.min(1, v)))
  }

  // Select each beat by (phase, momentum band, did momentum cross zero this round). A sign flip prints the swing line; a strong lean shows that side pressing;
  // near zero reads as contested. Turning Point = the crit when it fired (§4a); Final Push carries the draw / reversal signature beat (§8). Resolution waits for after the wounds.
  const leaderAt = (m: number): string => (m > 0 ? attackerLabel : defenderName)
  const phaseBeat = (phase: Exclude<BattlePhase, 'resolution'>, m: number): string => {
    const contested = Math.abs(m) < MOMENTUM_BAND
    // At high/desperate intensity the opening/escalation cores lift to their charged tier (§5); low/medium stays plain.
    const pools = PHASE_POOLS[phase]
    const tier = hard && pools.charged ? pools.charged : pools
    return pick(contested ? tier.tense : tier.decisive).replace('{leader}', leaderAt(m))
  }

  // Featured actors (§7): up to two seeded non-leader disciples who recur through the report. Only real rosters have them, so the enemy stays a nameless mass.
  const featured: string[] = []
  {
    const avail = [
      ...attackerParticipants.filter((p) => p.id !== attackerLeaderId),
      ...defenderParticipants.filter((p) => p.id !== defenderLeaderId),
    ]
    while (featured.length < 2 && avail.length > 0) featured.push(avail.splice(Math.floor(nrng() * avail.length), 1)[0].name)
  }
  // Leaders with a combat trait (§5): each yields a trait-in-character clause naming that leader — turning the trait from a bare label into an actual beat.
  const traitLeaders: { name: string; trait: CombatTrait }[] = []
  if (attackerLeaderName && attackerLeaderTrait) traitLeaders.push({ name: attackerLeaderName, trait: attackerLeaderTrait })
  if (defenderLeaderName && defenderLeaderTrait) traitLeaders.push({ name: defenderLeaderName, trait: defenderLeaderTrait })

  // Optional embellishment (§5): ~45% of a plain core beat gains ONE clause — a leader-trait flourish, a named-disciple flourish, or a terrain setting; never more
  // than one. Opening stays a clean intro. The category is chosen uniformly among whichever are available for this battle, so no one kind dominates a report.
  const embellish = (core: string, phase: Exclude<BattlePhase, 'resolution'>): string => {
    if (phase === 'opening' || nrng() >= EMBELLISH_CHANCE) return core
    const kinds: ('trait' | 'actor' | 'setting')[] = []
    // Don't cite a leader's trait when the core already names that leader — "Su Lian bears down … — Su Lian granting no quarter" reads as a stutter.
    const availTrait = traitLeaders.filter((tl) => !core.includes(tl.name))
    if (availTrait.length > 0) kinds.push('trait')
    if (featured.length > 0) kinds.push('actor')
    if (terrain !== undefined) kinds.push('setting')
    if (kinds.length === 0) return core
    const kind = kinds[Math.floor(nrng() * kinds.length)]
    let clause: string
    if (kind === 'trait') {
      const tl = availTrait[Math.floor(nrng() * availTrait.length)]
      clause = pick(TRAIT_CLAUSE[tl.trait]).replace('{leader}', tl.name)
    } else if (kind === 'actor') {
      clause = pick(ACTOR_CLAUSE).replace('{name}', featured[Math.floor(nrng() * featured.length)])
    } else {
      clause = pick(SETTING_CLAUSE[terrain!])
    }
    return `${core.replace(/\.$/, '')} — ${clause}.`
  }

  // Build the arc beats into a tagged list (not straight into the log) so the wound cluster can be attached at the right phase below (§6).
  const arcBeats: { phase: Exclude<BattlePhase, 'resolution'>; kind: BattleEventKind; text: string }[] = []
  combatPhases.forEach((phase, i) => {
    const m = momentum[i]
    const prev = i > 0 ? momentum[i - 1] : m0
    const crossed = Math.abs(prev) > 0.1 && Math.abs(m) > 0.1 && Math.sign(prev) !== Math.sign(m)
    const isCrit = phase === 'turning' && !!critEvent
    const text = isCrit
      ? critEvent!
      : phase === 'finalPush' && (drawn || reversal)
        ? drawn
          ? 'Both lines waver — neither can force the break.'
          : attackerRetreats
            ? `${attackerLabel} holds the upper hand — then falters, nerve spent in the grind.`
            : `${defenderName} holds the field — then their nerve breaks.`
        : crossed && phase !== 'opening'
          ? pick(MOMENTUM_SWING).replace('{leader}', leaderAt(m))
          : // Spend the imagery on the Turning Point (§5): a vivid qi image, but only at high/desperate — a skirmish stays plain. Otherwise a core beat, maybe one grounding clause.
            phase === 'turning' && hard
            ? pick(TURNING_VIVID)
            : embellish(phaseBeat(phase, m), phase)
    arcBeats.push({ phase, kind: isCrit ? 'crit' : 'beat', text })
  })

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
  const woundCluster: WoundBeat[] = []
  distributeWounds(attackerParticipants, casualtyBudget(attackerFrac * attackerCasMult, attackerParticipants.length, rng), rng, wounds, woundCluster)
  distributeWounds(defenderParticipants, casualtyBudget(defenderFrac * defenderCasMult, defenderParticipants.length, rng), rng, wounds, woundCluster)

  // Attach the wound CLUSTER to the arc (§6, §14.3): land it on the Turning Point as a unit — two or three casualties together is what a bad round looks like (#10),
  // not a per-round lottery. Split only a large cluster (4+) and only when a Final Push slot exists, criticals biased to the turn (a felled elder IS the turn). Then flatten.
  const turningIdx = arcBeats.findIndex((b) => b.phase === 'turning')
  const finalPushIdx = arcBeats.findIndex((b) => b.phase === 'finalPush')
  let turningGroup = woundCluster
  let finalPushGroup: WoundBeat[] = []
  if (woundCluster.length >= 4 && finalPushIdx >= 0) {
    const ordered = [...woundCluster].sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical')) // criticals first (stable)
    const cut = Math.max(ordered.filter((w) => w.severity === 'critical').length, Math.ceil(ordered.length / 2))
    turningGroup = ordered.slice(0, cut)
    finalPushGroup = ordered.slice(cut)
  }
  arcBeats.forEach((b, i) => {
    add(b.kind, b.phase, b.text)
    if (i === turningIdx) for (const w of turningGroup) add('wound', 'turning', w.text)
    if (i === finalPushIdx) for (const w of finalPushGroup) add('wound', 'finalPush', w.text)
  })

  // Resolution beat (§8, the arc's closing phase) — generated AFTER the wounds so casualties read as part of the fight. Each terminal state ends distinctly, and
  // the magnitude of a clean result colours it: a rout ends abruptly, a rout suffered reads as ruin. The draw / reversal Final-Push beat already ran up in the arc.
  // Framing is on `baseRatio` (the real power gap; the crit swing only matters near even power, where none of these tiers trigger). `hard` is computed above.
  // How dominant the eventual winner was (>= 1 in a straight result; < 1 only on a crit upset, which correctly reads as neither crushing nor catastrophic).
  const winnerRatio = won ? baseRatio : 1 / Math.max(0.0001, baseRatio)
  if (drawn) {
    add('closing', 'resolution', 'Both sides, spent and bloodied, break off; the field is left contested.')
  } else if (attackerRetreats) {
    add('closing', 'resolution', reversal ? `${attackerLabel} breaks off the assault and withdraws, the field left for the taking.` : `${attackerLabel} breaks off the assault and withdraws.`)
  } else if (defenderRetreats) {
    add('closing', 'resolution', reversal ? `${defenderName} yields the ground they had all but won.` : `${defenderName} yields the field and withdraws.`)
  } else if (won) {
    add(
      'closing',
      'resolution',
      winnerRatio >= DECISIVE_WIN_RATIO && !hard
        ? `${defenderName}'s line shatters — it is over in moments.`
        : hard
          ? `${defenderName}'s defenders break at last, the field bought dearly.`
          : `${defenderName}'s defenders break.`,
    )
  } else {
    add(
      'closing',
      'resolution',
      winnerRatio >= DECISIVE_WIN_RATIO
        ? `The assault is shattered — ${attackerLabel} is thrown back in ruin.`
        : hard
          ? `The attack falters and is thrown back after a grinding fight.`
          : `The attack is repelled.`,
    )
  }

  return {
    outcome: { won, drawn, oddsWon, seed, rounds: legacyRounds, attackerPower, defenderPower, wounds, intensity },
    events,
    rounds: narrativeRounds,
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
