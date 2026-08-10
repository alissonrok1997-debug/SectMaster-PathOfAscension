/**
 * Battle narration text pools (Battle Narration Split Plan). The authored prose
 * for combat reports lives here as content; `battleSimulator.ts` keeps only the
 * mechanics. Every pool below is drawn on a report's narration stream (`nrng`)
 * and NEVER affects resolution — outcomes are decided on the separate `rng`
 * stream (Battle Narration plan §2).
 *
 * Determinism caveat: reports regenerate from a saved seed, so ADDING lines to a
 * pool is safe, but REORDERING or REMOVING lines silently rewrites historical
 * battle reports. Treat each pool's order as part of the save format.
 */
import {
  DISCIPLE_TEMPERAMENTS,
  type BattleTerrain,
  type CombatTrait,
  type DiscipleTemperament,
  type InjurySeverity,
} from '../../types'
import { hashString } from '../../engine/rng'
import type { BattlePhase, BattleIntensity } from '../../engine/combat/battleSimulator'

export const CRIT_MOMENT_FLAVOR = [
  'A formation collapses in the chaos',
  'A sudden qi storm erupts across the field',
  'A reckless gambit shatters the deadlock',
  'The ground gives way beneath the melee',
  'A hidden reserve surges into the fray',

  'A battle formation breaks apart under mounting pressure',
  'Spirit pressure crashes across the battlefield',
  'Sword intent flashes through the melee',
  'A defensive array finally gives way',
  'The enemy standard disappears into the dust',
  'A surge of qi throws both sides into confusion',
  'A commander commits the final reserve',
  'The front ranks buckle beneath the assault',
  'The battlefield trembles beneath clashing techniques',
  'A disciplined advance suddenly loses cohesion',
  'The heart of the formation is exposed',
  'An opening appears where none existed before',
  'A desperate counterattack catches both sides off guard',
  'A protective formation flickers and collapses',
  'The clash of techniques sends a shockwave across the field',
  'Spiritual light bursts skyward as two forces collide',
  'The mountain echoes beneath a thunderous exchange',
  'The earth splits beneath a violent impact',
  'The flow of qi becomes wild and unstable',
  'A cloud of dust swallows the center of the battlefield',
  'The vanguard breaks through the enemy line',
  'A hidden expert reveals their strength',
  'The battlefield is consumed by blinding spirit light',
  'An ancient banner falls amidst the fighting',
  'The surrounding qi is thrown into turmoil',
  'The air itself shudders beneath overwhelming spiritual pressure',
  'A flawless formation begins to unravel',
  'A narrow breach becomes a decisive opening',
  'The heavens rumble as techniques collide',
  'The killing intent on the battlefield suddenly deepens',
  'Broken spirit weapons scatter across the field',
  'A talisman detonates in a flash of spiritual light',
  'The enemy formation fractures into isolated pockets',
  'The clash reaches a terrifying crescendo',
  'The very atmosphere grows heavy with murderous intent',
]

export const ROUND_BEAT_TENSE = [
  'The two sides trade blows, neither yielding.',
  'Formations clash and reform amid the dust.',
  'Qi flares as the lines strain against each other.',
  'Neither side gives ground.',

  'The struggle settles into a brutal stalemate.',
  'Both formations hold firm despite mounting pressure.',
  'Every advance is met with an immediate counterattack.',
  'Steel and spirit techniques collide without pause.',
  'The battlefield echoes with the clash of weapons and qi.',
  'Neither commander can force a decisive opening.',
  'The lines bend but refuse to break.',
  'The fighting grinds onward without respite.',
  'War cries rise above the din of battle.',
  'The cultivators contest every step of ground.',
  'Dust and spirit light veil the center of the battlefield.',
  'Each side probes for weakness without success.',
  'The battle becomes a contest of endurance.',
  'The formations remain locked in bitter combat.',
  'No breakthrough comes despite relentless pressure.',
  'The front ranks absorb blow after blow.',
  'Both sides fight with unwavering resolve.',
  'The exchange of techniques grows ever more relentless.',
  'Spirit pressure hangs heavily over the battlefield.',
  'The melee spreads across the contested ground.',
  'Sword light flashes between the locked formations.',
  'The defenders refuse to yield an inch.',
  'The attackers press forward but gain little ground.',
  'Neither side can seize the initiative.',
  'The clash settles into a deadly rhythm.',
  'Every opening is answered before it can be exploited.',
  'The battlefield becomes a sea of clashing techniques.',
  'The pressure mounts as neither formation falters.',
  'Both armies refuse to be the first to break.',
  'The contest remains fiercely balanced.',
]

// Decisive pools describe whoever currently HOLDS the momentum ({leader}), not the eventual winner — so a fight the attacker wins can still show the defender
// pressing mid-battle before the tide turns back (Phase 4). The momentum bridge (below) converges on the real outcome, so the last beats always favour the winner.
export const ROUND_BEAT_DECISIVE = [
  '{leader} presses the advantage.',
  "The line bends under {leader}'s assault.",
  '{leader} drives forward, unrelenting.',
  'The momentum belongs to {leader}.',

  '{leader} steadily forces the enemy backward.',
  '{leader} dictates the pace of the battle.',
  '{leader} seizes control of the engagement.',
  '{leader} exploits every opening.',
  '{leader} maintains relentless pressure.',
  '{leader} tightens their grip on the battlefield.',
  '{leader} drives the enemy onto the defensive.',
  '{leader} refuses to let the enemy recover.',
  '{leader} advances with unwavering resolve.',
  '{leader} keeps the initiative firmly in hand.',

  "The enemy line buckles beneath {leader}'s assault.",
  "The defenders struggle to contain {leader}'s advance.",
  "The battlefield begins to favor {leader}.",
  "Every exchange strengthens {leader}'s position.",
  "The pressure from {leader} continues to mount.",
  "The initiative slips further toward {leader}.",
  "The enemy is steadily forced onto the back foot.",
  "The balance of the battle tilts toward {leader}.",
  "The line strains under {leader}'s relentless advance.",
  "Resistance begins to crumble before {leader}.",

  "{leader}'s formations advance with growing confidence.",
  "{leader}'s cultivators press without hesitation.",
  "{leader}'s assault leaves the enemy little room to recover.",
  "{leader}'s momentum builds with every exchange.",
  "{leader}'s offensive grows increasingly difficult to contain.",
  "{leader}'s spirit pressure weighs heavily upon the battlefield.",
  "{leader}'s coordinated advance forces the enemy to give ground.",
  "{leader}'s warriors capitalize on every hesitation.",
  "{leader}'s relentless offensive begins to fracture the opposing formation.",
  "{leader}'s disciplined advance steadily overwhelms the enemy.",
]
export const OPENING_TENSE = [
  'The two hosts close, and the field erupts.',
  'Steel meets steel as the lines collide.',
  'The vanguards crash together and the battle is joined in earnest.',
  'The first exchange sets the whole field roaring.',

  'The first ranks collide in a storm of steel and qi.',
  'War cries echo as both formations commit to battle.',
  'The opening clash sends dust rolling across the battlefield.',
  'Both sides surge forward without hesitation.',
  'The battle begins with disciplined formations meeting head-on.',
  'The first exchange tests the resolve of both armies.',
  'The lines meet with tremendous force.',
  'Spirit pressure rises as the armies close.',
  'The battlefield erupts into ordered chaos.',
  'The opening assault leaves neither side willing to retreat.',
  'The clash begins with neither commander holding back.',
  'Sword light flashes as the first techniques are unleashed.',
  'The armies collide beneath a surge of spiritual pressure.',
  'The first charge shakes the battlefield.',
  'Both hosts throw themselves into the struggle from the very first exchange.',
]
export const OPENING_DECISIVE = [
  "{leader}'s vanguard strikes first, and hard.",
  '{leader} seizes the initiative from the opening breath.',
  '{leader} sets the pace before the enemy can form up.',

  '{leader} drives forward before the enemy can react.',
  '{leader} catches the opposing formation off balance.',
  '{leader} forces the battle onto favorable ground.',
  "{leader}'s opening assault catches the enemy unprepared.",
  "{leader}'s advance immediately puts the enemy on the defensive.",
  '{leader} wastes no time pressing the attack.',
  '{leader} overwhelms the first line with disciplined precision.',
  '{leader} establishes control from the very first exchange.',
  "{leader}'s warriors strike with overwhelming momentum.",
  '{leader} dictates the tempo from the opening clash.',
  '{leader} denies the enemy any chance to settle into formation.',
  "{leader}'s cultivators surge forward with practiced coordination.",
]
export const TURNING_TENSE = [
  "The battle hangs on a knife's edge.",
  'For a long moment, the whole field wavers.',
  'The lines buckle — then, somehow, hold.',
  'Everything narrows to a single breathless exchange.',

  'Neither side can afford another mistake.',
  'The balance threatens to tip with every exchange.',
  'Victory seems within reach for either side.',
  'Every movement now carries enormous weight.',
  'The battlefield falls into a tense uncertainty.',
  'The struggle reaches its decisive moment.',
  'Even veteran cultivators hesitate before committing.',
  'The formations strain to their limits.',
  'The outcome grows impossible to predict.',
  'One opening could decide the entire battle.',
  'The armies stand poised between triumph and collapse.',
  'The next exchange promises to change everything.',
]
export const TURNING_DECISIVE = [
  '{leader} finds the opening and drives through it.',
  'The balance tips, and {leader} takes it.',
  '{leader} breaks the deadlock with one decisive push.',

  '{leader} tears open a weakness in the enemy formation.',
  '{leader} transforms a small advantage into a decisive one.',
  '{leader} senses hesitation and strikes without mercy.',
  '{leader} wrests control of the battlefield.',
  "{leader} exploits the enemy's faltering defense.",
  '{leader} presses through the breach with relentless determination.',
  '{leader} shifts the battle irrevocably.',
  '{leader} turns mounting pressure into a breakthrough.',
  '{leader} seizes the moment before it slips away.',
  '{leader} forces the enemy into full retreat.',
  "{leader} breaks the enemy's rhythm at last.",
  '{leader} refuses to let the opportunity pass.',
]
export const FINAL_PUSH_TENSE = [
  'Both sides gather themselves for one last effort.',
  'Spent and ragged, the lines throw everything into the final exchange.',
  'The fight comes down to who can stand a moment longer.',

  'Exhausted cultivators summon the last of their qi.',
  'Every remaining reserve is committed.',
  'The battle reaches its final, desperate struggle.',
  'Neither side has strength left to spare.',
  'Every disciple fights knowing there will be no second chance.',
  'The last reserves are thrown into the fray.',
  'The battlefield becomes a contest of sheer resolve.',
  'The wounded refuse to leave the line.',
  'Only determination keeps the formations intact.',
  'The final exchange approaches with grim certainty.',
  'The struggle reaches its inevitable conclusion.',
  'Every remaining ounce of strength is brought to bear.',
]
export const FINAL_PUSH_DECISIVE = [
  '{leader} commits the reserve and presses for the finish.',
  '{leader} bears down for the killing stroke.',
  '{leader} drives the last exchange without mercy.',

  '{leader} throws everything into the final assault.',
  '{leader} crushes the last organized resistance.',
  '{leader} refuses to let the enemy recover.',
  '{leader} presses relentlessly toward victory.',
  '{leader} senses the battle drawing to its end.',
  '{leader} drives the exhausted enemy ever backward.',
  '{leader} leaves the enemy no room to regroup.',
  "{leader}'s final offensive shatters what resistance remains.",
  '{leader} commits fully to securing victory.',
  '{leader} overwhelms the last defenders.',
  '{leader} delivers the battle\'s final decisive push.',
]

// Emitted ONLY when momentum actually crosses zero this round (§3) — so "the advantage swings back and forth" is information, not decoration. {leader} = the side momentum just swung TO.
export const MOMENTUM_SWING = [
  'The tide reverses — {leader} surges where they had been pressed.',
  'Momentum lurches, and {leader} seizes it.',
  'The field turns over, {leader} suddenly ascendant.',

  'The initiative shifts decisively to {leader}.',
  '{leader} wrests control of the battlefield.',
  'What seemed certain suddenly unravels as {leader} rallies.',
  '{leader} drives the enemy back and seizes the momentum.',
  'The balance breaks in {leader}\'s favor.',
  'The enemy falters, and {leader} immediately capitalizes.',
  '{leader} turns defense into a fierce counteroffensive.',
  'A sudden reversal leaves {leader} in command.',
  '{leader} exploits the opening and turns the battle around.',
  'The pressure breaks, and {leader} surges forward.',
  '{leader} rallies the line and forces the enemy backward.',
  'The battlefield shifts as {leader} overturns the enemy\'s advantage.',
  '{leader} refuses to yield, reclaiming the initiative.',
  'The enemy\'s advance stalls as {leader} strikes back.',
  '{leader} catches the enemy off balance and seizes the field.',
  'The flow of battle changes course beneath {leader}\'s assault.',
  'The momentum slips away from the enemy and into {leader}\'s hands.',
  '{leader} breaks the enemy\'s rhythm and surges ahead.',
  'The tide of battle rolls back toward {leader}.',
  '{leader} answers pressure with overwhelming force.',
  'A disciplined counterattack restores the advantage to {leader}.',
  '{leader} tears open a fresh opportunity and claims it.',
  'The enemy loses its footing as {leader} presses forward.',
  'The balance of power shifts unmistakably toward {leader}.',
]

// --- Layered embellishment (Battle Narration §5, §7). A core beat can gain ONE optional clause — a terrain setting OR a named-disciple flourish, never both,
// ~45% of the time, and only on escalation / clean final-push beats. Authoring stays additive (~40 fragments) while the output space is multiplicative; the
// alternative (a pool per phase×momentum×terrain×trait) is a content treadmill. All drawn on the narration stream from already-snapshotted data — no new saved state.
export const EMBELLISH_CHANCE = 0.45

/** Terrain settings phrased as NOUNS the fight happens on (§5), attached as an em-dash aside so they read as a deliberate grounding, not a run-on. */
export const SETTING_CLAUSE: Record<BattleTerrain, readonly string[]> = {
  open: [
    'no cover on the open ground',
    'dust churning across the flat',
    'nowhere to hide on the bare plain',

    'the endless plain offering no refuge',
    'winds sweeping across the exposed battlefield',
    'trampled earth beneath countless feet',
    'scattered banners whipping in the open air',
    'the horizon stretching without shelter',
    'sunlight glaring across the battlefield',
    'loose stones scattered across the plain',
    'open ground favoring neither side',
    'the exposed field leaving every movement visible',
  ],

  mountain: [
    'the high ridge narrowing every advance',
    'loose scree treacherous underfoot',
    'the mountain wind cutting sidelong',

    'towering cliffs hemming in the battlefield',
    'echoes rolling through the mountain pass',
    'narrow trails denying easy maneuver',
    'jagged stone under every step',
    'cold air descending from the peaks',
    'mist clinging to the rocky slopes',
    'crumbling ledges overlooking the fighting',
    'sheer cliffs threatening every retreat',
    'the thin mountain air carrying every shout',
  ],

  forest: [
    'the crowded trees breaking every formation',
    'green gloom swallowing the flanks',
    'root and briar fouling each charge',

    'ancient trunks obscuring every advance',
    'low branches tangling overhead',
    'dense undergrowth slowing every movement',
    'shadows shifting beneath the forest canopy',
    'fallen leaves masking uncertain footing',
    'vines snaring the unwary',
    'towering pines hemming in the battle',
    'thick brush concealing sudden movements',
    'filtered sunlight piercing the canopy',
  ],

  river: [
    'the ford churned to mud',
    'the current dragging at every step',
    'the slick bank giving no purchase',

    'spray rising from the rushing water',
    'stones made treacherous by the current',
    'cold water soaking every advance',
    'the river dividing the battlefield',
    'mist drifting above the water',
    'the roar of the current drowning commands',
    'swift water threatening the unwary',
    'broken crossings littering the banks',
    'the riverbank collapsing beneath heavy footing',
  ],

  fortress: [
    'the walls looming over the melee',
    'the breached gate a killing funnel',
    'arrows raking from the battlements',

    'towering ramparts dominating the battlefield',
    'narrow walls limiting every advance',
    'broken stone littering the courtyard',
    'watchtowers overlooking the fighting',
    'murder holes above the shattered gate',
    'collapsed defenses choking the approach',
    'arrow slits watching every movement',
    'battered walls scarred by countless assaults',
    'the fortress casting long shadows across the field',
  ],

  sacred: [
    'old shrine-stones underfoot',
    'the ley-lines thrumming beneath the field',
    'a strange stillness on the hallowed ground',

    'ancient spirit veins stirring below',
    'weathered statues silently overlooking the battle',
    'centuries-old stone altars standing undisturbed',
    'sacred incense lingering in the air',
    'spiritual energy gathering beneath every step',
    'forgotten relics half-buried in the earth',
    'faded talismans clinging to broken stone',
    'an ancient aura permeating the battlefield',
    'the quiet weight of forgotten history',
  ],
}

/** Featured non-leader disciples (§7) get a beat beyond getting hurt — participial asides so a name means something. NPC sides have no roster, so the enemy stays a nameless mass (the intended asymmetry). */
export const ACTOR_CLAUSE = [
  '{name} refuses to give a step',
  '{name} holding the flank alone',
  '{name} carving an opening where there was none',
  '{name} anchoring the line',
  '{name} first into the breach',

  '{name} standing firm against overwhelming pressure',
  '{name} rallying nearby disciples',
  '{name} refusing to yield despite mounting wounds',
  '{name} driving back every challenger',
  '{name} holding the line through sheer resolve',
  '{name} cutting a path through the melee',
  '{name} pressing forward without hesitation',
  '{name} shielding wounded comrades',
  '{name} turning aside a fierce assault',
  '{name} forcing the enemy to give ground',
  '{name} weathering blow after blow',
  '{name} refusing to retreat',
  '{name} leading the charge into the enemy line',
  '{name} breaking through the opposing formation',
  '{name} contesting every step of ground',
  '{name} meeting every attack head-on',
  '{name} fighting with unwavering determination',
  '{name} striking where the enemy least expects',
  '{name} holding the center as the battle rages',
  '{name} refusing to abandon the wounded',
  '{name} standing alone where the fighting is fiercest',
  '{name} keeping the formation intact',
  '{name} driving the enemy back with disciplined strikes',
  '{name} answering every attack in kind',
  '{name} exploiting the smallest opening',
  '{name} refusing to let the line falter',
  '{name} fighting as though possessed',
  '{name} pushing deeper into the enemy ranks',
  '{name} standing unbowed amidst the chaos',
  '{name} answering the enemy with fearless resolve',
  '{name} holding fast while others regroup',
  '{name} striking with calm precision',
  '{name} weathering the fiercest exchange',
  '{name} refusing to be driven back',
  '{name} carrying the momentum forward',
]

/** Leader-trait flavour (§5): turns the trait from a bare `(Ruthless)` label into a beat that shows the leader fighting in character. Attached like an actor clause, keyed on the leader's own name. */
export const TRAIT_CLAUSE: Record<CombatTrait, readonly string[]> = {
  aggressive: [
    '{leader} pressing the attack past all caution',
    '{leader} throwing weight into every blow',
    '{leader} giving the enemy no room to breathe',

    '{leader} driving the assault without pause',
    '{leader} refusing to relinquish the initiative',
    '{leader} forcing the pace of the battle',
    '{leader} urging every disciple forward',
    '{leader} striking before the enemy can recover',
    '{leader} turning every opening into an attack',
    '{leader} pushing relentlessly into the enemy line',
    '{leader} demanding constant pressure',
    '{leader} carrying the momentum ever forward',
    '{leader} answering resistance with greater force',
    '{leader} overwhelming the enemy through relentless aggression',
  ],

  ruthless: [
    '{leader} granting no quarter',
    '{leader} spending lives to buy the ground',
    '{leader} exploiting every opening without mercy',

    '{leader} pursuing every weakness without hesitation',
    '{leader} pressing every advantage to its limit',
    '{leader} sacrificing nothing for sentiment',
    '{leader} refusing to allow the enemy any respite',
    '{leader} driving the wounded without slowing',
    '{leader} accepting any cost for victory',
    '{leader} forcing the enemy into impossible choices',
    '{leader} crushing every sign of resistance',
    '{leader} turning every mistake into disaster for the enemy',
    '{leader} showing no mercy to the faltering line',
  ],

  inspiring: [
    '{leader} steadying the line by sheer presence',
    "{leader}'s banner holding the squad together",
    '{leader} rallying the wavering ranks',

    '{leader} restoring courage wherever the line falters',
    '{leader} leading from the very front',
    '{leader} inspiring weary disciples to fight on',
    '{leader} answering fear with unwavering resolve',
    '{leader} uniting the formation through calm command',
    '{leader} lifting spirits with every advance',
    '{leader} refusing to let the formation break',
    '{leader} strengthening every disciple through example',
    '{leader} turning hesitation into determination',
    '{leader} standing as the heart of the formation',
  ],

  defensive: [
    '{leader} holding formation, patient and unbroken',
    '{leader} giving no gap to exploit',
    '{leader} trading ground for lives',

    '{leader} preserving the integrity of the formation',
    '{leader} yielding nothing without purpose',
    '{leader} weathering the assault with iron discipline',
    '{leader} reinforcing every threatened position',
    '{leader} refusing to be drawn into reckless pursuit',
    '{leader} denying the enemy a clean breakthrough',
    '{leader} absorbing the assault without losing cohesion',
    '{leader} guarding every weakness with careful precision',
    '{leader} letting the enemy exhaust themselves',
    '{leader} maintaining perfect discipline beneath pressure',
  ],

  cautious: [
    '{leader} probing, unwilling to overcommit',
    '{leader} spending no life it need not',
    '{leader} holding the reserve back, watchful',

    '{leader} waiting patiently for the right opportunity',
    '{leader} measuring every commitment with care',
    '{leader} refusing to be baited into a trap',
    '{leader} preserving strength for the decisive moment',
    '{leader} advancing only where success is certain',
    '{leader} studying the enemy before striking',
    '{leader} committing reserves only when necessary',
    '{leader} favoring precision over haste',
    '{leader} revealing little of the battle plan',
    '{leader} exploiting certainty rather than chance',
  ],
}
/** The Turning Point is where the imagery is spent (§5): a vivid qi/technique image used only at high/desperate intensity, so a skirmish never reads like an apocalypse. One image per line. */
export const TURNING_VIVID = [
  'Qi erupts along the line as the formations collide.',
  'Technique breaks against technique, and the air itself screams.',
  'For one heartbeat the whole field holds its breath — then shatters.',
  'Spirit-light floods the ground; everything hangs on the next exchange.',
]

// Intensity-charged opening / escalation cores (§5): the register lifts at high/desperate — visceral, higher-stakes — while low/medium stays plain, so a skirmish
// and a bloodbath don't read alike. Deliberately kept BELOW the Turning Point's qi imagery (TURNING_VIVID): the turn stays the peak, or nothing lands as the peak.
export const OPENING_CHARGED_TENSE = [
  'The two hosts slam together and the ground itself shudders.',
  'Battle-cries and breaking steel drown the field from the first breath.',
  'The lines meet with a shock that staggers both sides.',
]
export const OPENING_CHARGED_DECISIVE = [
  '{leader} hits the line like an avalanche.',
  '{leader} tears in before the enemy can set their feet.',
  '{leader} opens with a fury that buckles the first rank.',
]
export const ESCALATION_CHARGED_TENSE = [
  'Neither line will break, whatever it costs them.',
  'The fighting grinds on, savage and close.',
  'Dust and broken qi choke the air as the ranks refuse to yield.',
  'Every exchange draws blood, and still neither side gives.',
]
export const ESCALATION_CHARGED_DECISIVE = [
  '{leader} bludgeons the line back, step by bloody step.',
  "The enemy formation cracks under {leader}'s relentless assault.",
  '{leader} drives on through the carnage.',
]

/** Phase → core pools, with an optional `charged` tier used at high/desperate intensity (§5). Resolution has no pool (generated from the terminal state + magnitude, §8). */
export const PHASE_POOLS: Record<
  Exclude<BattlePhase, 'resolution'>,
  { tense: readonly string[]; decisive: readonly string[]; charged?: { tense: readonly string[]; decisive: readonly string[] } }
> = {
  opening: { tense: OPENING_TENSE, decisive: OPENING_DECISIVE, charged: { tense: OPENING_CHARGED_TENSE, decisive: OPENING_CHARGED_DECISIVE } },
  escalation: { tense: ROUND_BEAT_TENSE, decisive: ROUND_BEAT_DECISIVE, charged: { tense: ESCALATION_CHARGED_TENSE, decisive: ESCALATION_CHARGED_DECISIVE } },
  turning: { tense: TURNING_TENSE, decisive: TURNING_DECISIVE },
  finalPush: { tense: FINAL_PUSH_TENSE, decisive: FINAL_PUSH_DECISIVE },
}

/** Report length is derived from how hard the fight was (§4b) — a short report means a short fight. Base count per intensity; the caller adds ±1 jitter and clamps to 3–6. */
export const ROUNDS_BY_INTENSITY: Record<BattleIntensity, number> = { low: 3, medium: 4, high: 5, desperate: 6 }

export const WOUND_FLAVOR: Record<Exclude<InjurySeverity, 'none'>, string[]> = {
  minor: ['weathers a glancing strike and presses on.', 'takes a shallow cut but holds the line.', 'is grazed, but does not falter.'],
  major: ['is battered by a heavy blow and reels.', 'takes a grievous hit and staggers back.', 'is wounded badly, formation faltering.'],
  critical: ['falls, gravely wounded.', 'is struck down and dragged from the field.', 'collapses under a devastating blow.'],
}

/**
 * Personality-flavoured wound narration (#8): the disciple's stored temperament epithet + a seeded severity beat, replacing the flat "X takes a major wound".
 * Falls back to a name hash when no temperament is supplied (an NPC façade, or a pre-v20 report snapshot that didn't carry temperaments).
 */
export function woundLine(name: string, temperament: DiscipleTemperament | undefined, severity: Exclude<InjurySeverity, 'none'>, rng: () => number): string {
  const epithet = temperament ?? DISCIPLE_TEMPERAMENTS[(hashString(name) >>> 0) % DISCIPLE_TEMPERAMENTS.length]
  const pool = WOUND_FLAVOR[severity]
  return `${name} ${epithet} ${pool[Math.floor(rng() * pool.length)]}`
}

export const INTENSITY_FLAVOR: Record<BattleIntensity, string> = {
  low: 'The clash is brief and one-sided.',
  medium: 'The fighting is fierce but controlled.',
  high: 'The battle is hard-fought and bloody.',
  desperate: 'The fighting is desperate — neither side willing to yield.',
}
