/**
 * Wave 0 core data model.
 *
 * These are shapes only — the serializable entities the roadmap's Wave 0
 * calls out (disciples, buildings, resources, items). Real gameplay logic
 * (production, upgrades, recruitment) arrives in later waves; for now the
 * collections in GameState start empty so this file just proves the model
 * round-trips through the simulation loop and save/load.
 */

// --- Resources (Economy System, doc 01) ---------------------------------

export interface Resources {
  spiritStones: number
  qiStone: number
  spiritWood: number
  ironEssence: number
  spiritHerb: number
  knowledge: number
}

export function createEmptyResources(): Resources {
  return {
    spiritStones: 0,
    qiStone: 0,
    spiritWood: 0,
    ironEssence: 0,
    spiritHerb: 0,
    knowledge: 0,
  }
}

// --- Buildings (Sect Progression & Building System, doc 02) -------------

export type BuildingCategory =
  | 'Core'
  | 'Production'
  | 'Training'
  | 'Knowledge'
  | 'Crafting'
  | 'Support'
  | 'Defense'
  | 'Special'

/**
 * Slot-limiting axis, independent of `BuildingCategory` (which is just a display grouping).
 * 'core' buildings always exist from game start; 'specialization' buildings must be claimed
 * into one of a limited number of slots (see `SPECIALIZATION_SLOT_COUNT`) before they exist
 * in `GameState.buildings` at all.
 */
export type BuildingSlotType = 'core' | 'specialization'

export interface BuildingInstance {
  id: string
  category: BuildingCategory
  level: number
  /** Epoch ms when an in-progress upgrade completes; undefined if idle. */
  constructionEndsAt?: number
}

// --- Disciples (Disciple System, doc 03) ---------------------------------

export type CultivationRealm =
  | 'Body Tempering'
  | 'Qi Condensation'
  | 'Foundation Establishment'
  | 'Core Formation'
  | 'Nascent Soul'
  | 'Soul Transformation'
  | 'Void Refinement'
  | 'Immortal Ascension'

/** Ordered ladder — index position is the realm's rank for breakthrough/advancement logic. */
export const CULTIVATION_REALMS: CultivationRealm[] = [
  'Body Tempering',
  'Qi Condensation',
  'Foundation Establishment',
  'Core Formation',
  'Nascent Soul',
  'Soul Transformation',
  'Void Refinement',
  'Immortal Ascension',
]

/** MVP roles only (doc 03 Section 14) — Diplomat and Elder are out of scope until later waves. */
export type DiscipleRole = 'Combatant' | 'Alchemist' | 'Blacksmith' | 'Scholar'

/** MVP grades only (doc 03 Section 14) — Heaven-Chosen and Immortal Bloodline are out of scope until later waves. */
export type DiscipleGrade = 'Common' | 'Uncommon' | 'Rare' | 'Genius'

/** A leader's combat temperament (Combat Polishing Phase 6). The union lives here so it can be snapshotted on BattleResult; the effects table + derivation live in engine/combatPower.ts. */
export type CombatTrait = 'aggressive' | 'defensive' | 'cautious' | 'inspiring' | 'ruthless'

/** The ground a battle is fought on (Combat Polishing Phase 7). The union lives here for snapshotting; combat effects live in battleSimulator.ts (TERRAIN_EFFECTS), location→terrain derivation in engine/world/terrain.ts. */
export type BattleTerrain = 'open' | 'mountain' | 'forest' | 'river' | 'fortress' | 'sacred'

/** Player-framed outcome tier (Combat Polishing Phase 8), derived from margin + intensity. Drives labels + consequence scaling; derivation/tables live in battleSimulator.ts. `draw` (Phase 9) is the one tier not from margin — a mutual retreat, paying no rewards. */
export type BattleOutcomeTier = 'crushing' | 'decisive' | 'narrow' | 'draw' | 'fightingRetreat' | 'defeat' | 'catastrophic'

export type InjurySeverity = 'none' | 'minor' | 'major' | 'critical'

/**
 * A disciple's fixed combat temperament (Combat Polishing Phase 3, #8) — an epithet rolled RANDOMLY at creation and kept for life, surfaced in battle
 * wound narration. Stored (not derived from the name) so that same-named disciples read distinctly; snapshotted into battle reports so a regenerated
 * report shows the same epithet even after the disciple is gone.
 */
export const DISCIPLE_TEMPERAMENTS = [
  'the Relentless',
  'the Disciplined',
  'the Reckless',
  'the Stoic',
  'the Cunning',
  'the Fierce',
  'the Steadfast',
  'the Wrathful',
] as const
export type DiscipleTemperament = (typeof DISCIPLE_TEMPERAMENTS)[number]

export interface DiscipleInstance {
  id: string
  name: string
  /** Fixed combat temperament, rolled at creation (see DISCIPLE_TEMPERAMENTS). */
  temperament: DiscipleTemperament
  realm: CultivationRealm
  /** Current small realm (stage) within the major realm, 1-9. Advances automatically as cultivationProgress fills. */
  subRealm: number
  /** 0-100 progress toward the next small realm; at subRealm 9 it fills toward the player-triggered major breakthrough. */
  cultivationProgress: number
  talent: number
  role: DiscipleRole
  grade: DiscipleGrade
  loyalty: number
  morale: number
  /** Current HP. The injury band is derived from `health / maxHp` (engine/injury.ts, getInjurySeverity) — HP is the only stored truth (HEALTH_SYSTEM_PLAN invariant 1). */
  health: number
  /** Max HP — persisted (flat 100 at Phase 1) so a later phase can derive it from realm/physique without a migration. */
  maxHp: number
  /** Epoch ms until which a downed disciple (dropped to 0 HP and survived the fate roll, HEALTH_SYSTEM_PLAN Phase 5) is incapacitated — blocked from assignment, not cultivating, HP frozen. Cleared on wake. Undefined if not downed. */
  downedUntil?: number
  /**
   * Epoch ms until which this disciple is away and unavailable for (re)assignment
   * (Presence Requirement, doc 03 Section 8). Set today only via the debug panel,
   * since Missions/Expeditions — the real trigger — don't exist until Wave 4.
   */
  awayUntil?: number
  assignedBuildingId?: string
  /**
   * Epoch ms until which an Active Cultivation Boost (doc 01 Section 2) is
   * in effect for this disciple; undefined if none is active.
   */
  activeBoostUntil?: number
  /**
   * The equipped ItemInstance in each slot (doc 07 Section 4); undefined means the slot is empty.
   * Holds the whole instance (not a def id) because each equipment piece is unique — it carries
   * its own rolled Quality (doc 07 Section 7), and unequipping must return that exact instance.
   */
  equipment: Record<EquipmentSlotId, ItemInstance | undefined>
  /** Def ids of every technique this disciple has learned (data/techniqueDefs.ts, doc 10 Section 10). */
  knownTechniques: string[]
  /** Technique def id currently being taught to this disciple; undefined if none. */
  learningTechniqueId?: string
  /** Epoch ms when the current teaching completes. */
  learningTechniqueUntil?: number
}

// --- Missions & Combat (Mission & Expedition System doc 04, Combat & Conflict Resolution doc 06) ---

/** MVP mission types only (doc 04 Section 13) — Exploration, Diplomatic, and Story missions are out of scope until later waves. */
export type MissionType = 'Gathering' | 'Hunting' | 'Escort'

/** MVP outcome tiers only (doc 04 Section 13 / doc 06 Section 12) — Critical Success/Partial Success/Disaster and Costly Victory/Rout are out of scope until a later wave. Combat missions display this as Victory/Defeat; non-combat missions display Success/Failure — see `getOutcomeLabel`. */
export type MissionOutcome = 'Success' | 'Failure'

/** A mission currently sitting on the rotating Mission Board (doc 04 Section 8), not yet dispatched. */
export interface MissionBoardOffer {
  id: string
  defId: string
}

/** A dispatched squad, in flight until `endsAt`. Squad members are marked away via Presence Requirement (doc 03 Section 8) for the mission's duration. */
export interface ActiveMission {
  id: string
  defId: string
  squadDiscipleIds: string[]
  startedAt: number
  endsAt: number
}

/** A resolved mission's result, kept for the Mission Screen's history/log — this is what lets the player see "outcomes affect disciples" after the fact, not just in the moment. */
export interface MissionLogEntry {
  id: string
  defId: string
  missionName: string
  outcome: MissionOutcome
  squadNames: string[]
  /** Combat temperaments, parallel to `squadNames` — snapshotted so BattleReportView regenerates the same wound epithets (Phase 3 #8). Absent on non-combat missions. */
  squadTemperaments?: DiscipleTemperament[]
  rewardGranted: Partial<Resources>
  injuries: { name: string; severity: Exclude<InjurySeverity, 'none'> }[]
  resolvedAt: number
  /** Present only for combat (Hunting) missions, which resolve through the shared battle simulator (Combat Polishing Phase 2) — opens the regenerated BattleReportView, same as an expedition's. */
  battleResult?: BattleResult
}

// --- Items (Inventory, Equipment & Item System, doc 07) -------------------

export type ItemCategory =
  | 'Resource'
  | 'Equipment'
  | 'Pill'
  | 'Manual'
  | 'Artifact'
  | 'Mission Item'
  | 'Quest Item'

/**
 * EQUIPMENT_DEPTH_PLAN §4 — the closed set of equipment-instance effects. Every id has exactly one
 * engine consumer (see engine/itemAffixes.ts getEquippedEffectTotal); adding one means adding a consumer.
 * Percent effects sum before applying (two +10% → +20%); flat effects sum.
 */
export type EquipmentEffectId =
  | 'combatPowerFlat'
  | 'combatPowerPct'
  | 'maxHpPct'
  | 'cultivationRatePct'
  | 'woundResistPct'
  | 'healthRegenPct'
  | 'moraleDecayPct'

/** A rolled affix on an equipment instance (§4): the affix def id plus the value rolled once at creation and frozen for the item's lifetime — never re-derived on load. */
export interface ItemAffix {
  affixId: string
  value: number
}

export interface ItemInstance {
  id: string
  category: ItemCategory
  itemId: string
  quantity: number
  /**
   * doc 07 Section 7 — per-item Quality tier, rolled when the item is obtained.
   * Equipment only: it's a unique instance (quantity 1) whose quality scales its
   * Combat Power. Stackable consumables (Pill/Manual) leave this undefined.
   */
  quality?: ItemQuality
  /**
   * EQUIPMENT_DEPTH_PLAN §4 — 0–2 affixes rolled at creation from a Quality-driven count, frozen for
   * the instance's life. Absent on stackables and on legacy pre-v23 equipment (reads as plain gear).
   */
  affixes?: ItemAffix[]
  /** §6a — name of the disciple assigned to the crafting building when this batch started; absent = "Forged at the Sect Forge." */
  craftedBy?: string
  /** §6b — generated <Epithet> <Noun> name for a Perfect/Masterwork roll; generated once, persisted, preferred in display. */
  forgedName?: string
  /** §6c — epoch ms when this piece was forged, for its provenance line. */
  forgedOnDay?: number
  /** §6c — name of the first disciple to equip it; set once, never overwritten. */
  firstWielder?: string
  /** §6c — battles won while equipped (the wielder's side), accumulated over the item's life. */
  battlesWon?: number
}

/** MVP rarity tiers only (doc 07 Section 3) — all six are modeled since it's a plain enum, but MVP item defs only use the first three; Epic/Legendary/Mythic are reserved for later content. */
export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic'

/** doc 07 Section 7 — per-item Quality tiers, worst to best. Rolled per equipment instance; scales base Combat Power (upgrade-potential/sale-value axes deferred until those systems exist). */
export type ItemQuality = 'Poor' | 'Normal' | 'Fine' | 'Excellent' | 'Perfect' | 'Masterwork'

/** doc 07 Section 4's three equipment kinds — Accessory can go in either accessory slot. */
export type EquipmentSlotType = 'Weapon' | 'Armor' | 'Accessory'

/** doc 07 Section 4's four initial equipment slots (Weapon, Body Armor, Accessory 1, Accessory 2) — Artifact/Spirit Companion/Formation Relic slots are future expansion. */
export type EquipmentSlotId = 'weapon' | 'bodyArmor' | 'accessory1' | 'accessory2'

/** In-progress crafting job (doc 07 Section 11); single-slot, mirroring the single construction queue's simplicity. */
export interface CraftingQueueState {
  recipeId: string
  endsAt: number
  /** Batch crafting: items still to produce, including the one in progress. Absent on legacy saves = a single item. */
  remaining?: number
  /** Per-item duration, locked at batch start, used to schedule each successive item. Absent on legacy saves. */
  itemDurationMs?: number
  /** EQUIPMENT_DEPTH_PLAN §6a — name of the disciple assigned to the recipe's building when the batch started, stamped onto every piece produced. Captured at start so a mid-craft reassignment doesn't rewrite history. */
  craftedBy?: string
}

// --- Research, Techniques & Sect Doctrine (doc 10) ------------------------

/** doc 10 Section 3's 8 branches — MVP hooks real effects to Sect Administration/Cultivation/Martial Arts/Alchemy/Diplomacy (Wave 7 gave Diplomacy a real hook: diplomatic action cost reduction); Forging/Exploration/Mysticism still have no existing system to hook into honestly, same precedent as Wave 5 skipping Inscription/Artifact Restoration. */
export type ResearchCategory =
  | 'Sect Administration'
  | 'Cultivation'
  | 'Martial Arts'
  | 'Alchemy'
  | 'Forging'
  | 'Exploration'
  | 'Diplomacy'
  | 'Mysticism'

/** What a completed project actually changes — one effect per project at MVP "basic research tree" scope (doc 10 Sections 5/18). */
export type ResearchEffectType = 'storageCap' | 'cultivationRate' | 'craftingSpeed' | 'unlockTechnique' | 'diplomacyCost'

/** In-progress research job (doc 10 Section 6); single-slot, mirrors CraftingQueueState — "Initially: One active research project." */
export interface ResearchQueueState {
  projectId: string
  endsAt: number
}

/** doc 10 Section 8's 6 grades — MVP's one technique uses only 'Common'; higher grades are reserved for later content. */
export type TechniqueGrade = 'Common' | 'Rare' | 'Advanced' | 'Heaven Grade' | 'Saint Grade' | 'Immortal Grade'

/** doc 10 Section 11's 6 doctrines — a permanent, one-time, sect-wide choice. Doctrine Evolution (doc 10 Section 12) is out of MVP scope. */
export type SectDoctrineId = 'strength' | 'harmony' | 'knowledge' | 'prosperity' | 'discipline' | 'freedom'

// --- World, Factions & Diplomacy (doc 08) ---------------------------------

/** doc 08 Section 4's 8 categories — MVP uses 5 (Alchemy Association/Forging Guild/Hidden Organizations skipped, no mechanical distinction exists for them yet, same precedent as omitted research branches). */
export type FactionCategory = 'Cultivation Sect' | 'Kingdom' | 'Merchant Guild' | 'Demonic Cult' | 'Ancient Clan'

/** doc 08 Section 6's 7-tier ladder, always derived from a numeric relationship value via `getRelationshipTier` — never stored directly, mirrors how Sect Rank derives from Hall level. */
export type RelationshipTierName =
  | 'Sworn Enemy'
  | 'Hostile'
  | 'Suspicious'
  | 'Neutral'
  | 'Friendly'
  | 'Trusted Ally'
  | 'Strategic Partner'

/** doc 08 Section 8's reputation examples, extended into a full symmetric ladder — a single global value, always derived via `getReputationTier`, separate from any one faction's Relationship. */
export type ReputationTierName = 'Infamous' | 'Unknown' | 'Respected' | 'Famous' | 'Legendary'

/**
 * doc 08 Section 7's diplomatic actions, minus Alliance and Non-Aggression
 * Pact — both of their doc-stated benefits (mutual defense, shared
 * missions, reduced conflict) need a conflict/mission-sharing system that
 * doesn't exist until Wave 9, so rather than ship a relationship-only
 * stand-in they're left out entirely (confirmed with the user).
 */
export type DiplomaticActionId = 'tribute' | 'refusal' | 'knowledgeExchange' | 'tradeAgreement'

/** The one currently-active large-scale world event (doc 08 Section 10); undefined when none is active. */
export interface WorldEventState {
  defId: string
  startedAt: number
  endsAt: number
}

// --- Event & Narrative System (doc 05) -------------------------------------

/** A narrative Decision Event waiting on a player choice (doc 05 Section 2 — "paused until the player returns"); undefined when nothing is pending. Automatic Events never occupy this slot — they resolve straight into the log. */
export interface PendingEventState {
  defId: string
  triggeredAt: number
}

/** A resolved world or narrative event, kept for the Sect Chronicle / Event Log (doc 05 Section 11). */
export interface EventLogEntry {
  id: string
  source: 'world' | 'narrative' | 'sect' | 'npcSim'
  defId: string
  name: string
  text: string
  resolvedAt: number
}

// --- Clocks (Offline Progression, Time Simulation & Idle Systems, doc 09) -

/** Real-time simulation clock: 1 real second = 1 simulated second, never accelerated. */
export interface SimClockState {
  totalElapsedMs: number
}

/** Cosmetic day/night clock, decoupled from the Simulation Clock. */
export interface WorldClockState {
  totalElapsedMs: number
}

/** Consecutive-calendar-day login tracking (doc 11 Section 19 daily retention). `lastLoginDate` is a local `YYYY-MM-DD` string, not an epoch ms, since the streak resets on calendar days, not 24h windows. */
export interface LoginStreakState {
  current: number
  longest: number
  lastLoginDate: string
}

// --- Game state -----------------------------------------------------------

// v15 (World Map Phase 2): added optional sectLocation + world. A pre-World-Map
// save has no sectLocation and would be misread as unfounded, so the bump
// discards it and routes the player into the FoundingScreen instead (§13.1). No
// MIGRATIONS entry — discard is the intended path here.
// v16 (World Map Phase 5A): the Wave-7 territory system was absorbed into
// location outposts, removing the required `ownedTerritories` / `territoryClaimQueue`
// fields. A v15 save still carries them and has no outpost data, so the bump
// discards it (no MIGRATIONS entry — a clean re-founding was the chosen path).
// v17 (The First Realm, Wave A): the 3-province/7-site starter world is fully
// replaced by a single 32-site tiered province with an NPC-sect roster
// (FIRST_REALM_PLAN §1-§3). Every province/site/landmark id changes, so a v16
// save's `sectLocation`/`world` point at ids that no longer exist — the bump
// discards it (no MIGRATIONS entry — clean re-founding, same precedent as v16).
// v18 (The First Realm, Wave C): the living NPC world adds required scheduling
// fields (`NpcSect.nextActionAt`/`seatSince`, `WorldState.nextNpcEmergenceAt`)
// that a v17 save's npcSects/world don't carry — the bump discards it (no
// MIGRATIONS entry, same precedent as v16/v17).
// v20 (Combat Polishing): disciples gain a required `temperament` epithet, and combat
// log entries snapshot it. Unlike the id-reshaping bumps above, this field has a lossless
// default, so it's the first bump to use the migration seam (backfill in save.ts) rather
// than discard — a v19 save keeps all its progress and just backfills each disciple's
// temperament from its name (the value it was already displaying).
export const SAVE_VERSION = 24

export interface GameState {
  saveVersion: number
  createdAt: number
  lastSavedAt: number
  simClock: SimClockState
  worldClock: WorldClockState
  resources: Resources
  /**
   * Separate persisted bag for the CRAFTING_RECIPE_PACK §8 crafting materials,
   * keyed by material def id (data/materialDefs.ts). Kept apart from the six core
   * `Resources` on purpose. A missing key reads as 0. Acquisition is not modelled
   * yet — the only source today is the Debug panel's grant (see §10 decision).
   */
  materials: Record<string, number>
  buildings: Record<string, BuildingInstance>
  disciples: DiscipleInstance[]
  /** Chosen leader for seat defense (Combat Polishing Phase 6). Optional: absent (or if the disciple is no longer home) falls back to the highest-grade home disciple. */
  defenseLeaderId?: string
  items: ItemInstance[]
  /**
   * Epoch ms until which the sect's passive Qi Stone production is halved,
   * because Qi Stone reserve is being actively channeled into a disciple's
   * Active Cultivation Boost instead (doc 01, Section 2). Undefined if no
   * boost is currently in effect anywhere in the sect.
   */
  qiStoneProductionPenaltyUntil?: number
  missionBoard: { offers: MissionBoardOffer[]; nextRefreshAt: number }
  activeMissions: ActiveMission[]
  missionLog: MissionLogEntry[]
  /** Newest-first inbox of every battle the player fought or defended, capped at REPORT_INBOX_LIMIT. Survives missionLog/expeditionLog trimming — this is where reports live. */
  reports: CombatReportEntry[]
  /** Undefined when no craft is in progress. */
  craftingQueue?: CraftingQueueState
  /** Undefined when no research is in progress (doc 10 Section 6). */
  researchQueue?: ResearchQueueState
  /** Def ids of every completed research project — sole source of truth for "is X researched" / "is technique Y discovered"; never duplicated into a separate discovered-state array. */
  completedResearch: string[]
  /** Permanent sect-wide philosophy choice (doc 10 Section 11); undefined until chosen. */
  doctrine?: SectDoctrineId
  /** How the world broadly sees the sect (doc 08 Section 8) — separate from any one faction's Relationship. */
  reputation: number
  /** Per-faction Relationship value (doc 08 Section 6), keyed by faction id. Seeded to 0 for every FACTION_DEFS entry at new-game. */
  factionRelationships: Record<string, number>
  /** Per-faction-per-action cooldown, keyed by `${factionId}:${actionId}`, value is the epoch ms it next becomes available. */
  diplomaticActionCooldowns: Record<string, number>
  /** Undefined when no large-scale world event is currently active (doc 08 Section 10). */
  worldEvent?: WorldEventState
  /** Epoch ms the next world event is due to trigger, once the slot is free. */
  nextWorldEventAt: number
  /** The narrative Decision Event currently awaiting a player choice (doc 05 Section 2); undefined otherwise. */
  pendingEvent?: PendingEventState
  /** Epoch ms the next narrative event roll is due, once the slot is free. */
  nextEventAt: number
  /** Epoch ms the next disciple upkeep charge is due (engine/upkeep.ts). */
  nextUpkeepAt: number
  /** Resolved world + narrative events, newest first (doc 05 Section 11's Sect Chronicle / Event Log). */
  eventLog: EventLogEntry[]
  /** Consecutive-calendar-day login streak (doc 11 Section 19). */
  loginStreak: LoginStreakState
  /**
   * The permanent founding choice (WORLD_MAP_DESIGN §4.4). Undefined until the
   * sect is founded — its presence is the "has this save been founded?" flag the
   * app boots on (§12.2). Written once at founding and READ-ONLY FOREVER after;
   * a future "relocate sect" wants its own system, not a mutation of this field.
   */
  sectLocation?: SectLocation
  /**
   * All mutable world-map runtime state (§9), created at founding alongside
   * sectLocation. Undefined pre-founding. Namespaced so the diff against the flat
   * GameState stays legible and future world systems have a home.
   */
  world?: WorldState
  /**
   * Set the instant a winning seat-claim relocates the sect but the new seat's
   * `buildingSlots` can't fit every current building (FIRST_REALM_PLAN §4.2/§7).
   * The relocation itself (seat swap, ownership, NPC destruction, outpost
   * abandonment) already happened — this only gates the RelocationPruneModal,
   * which the player must resolve (picking which buildings survive) before
   * anything else renders, mirroring the FoundingScreen app-gate.
   */
  pendingRelocation?: PendingRelocationState
}

/** FIRST_REALM_PLAN §4.2/§7/§9 — the "must prune buildings after a relocation" gate. */
export interface PendingRelocationState {
  newSiteId: SectSiteId
  oldSiteId: SectSiteId
  defeatedNpcSectId: string
  /** How many buildings must still be removed to fit the new site's `buildingSlots` cap. */
  requiredRemovals: number
}

// --- World Map & Sect Placement (WORLD_MAP_DESIGN) -----------------------
// Phase 1 adds cross-cutting id/enum/runtime shapes only. Per-file definition
// interfaces (ProvinceDefinition, SectSiteDefinition, the location defs, the
// archetype defs) live in their data/world/ file, mirroring how factionDefs.ts
// owns FactionDefinition. GameState.sectLocation / GameState.world and the
// Expedition model arrive with founding (Phase 2) and travel (Phase 4).

export type ProvinceId = string
export type SectSiteId = string
export type LocationId = string

export type ProvinceTheme =
  | 'mountains'
  | 'plains'
  | 'forest'
  | 'desert'
  | 'islands'
  | 'wetlands'
  | 'wastes'
  | 'karst'

export type ClimateId = 'temperate' | 'arid' | 'humid' | 'frigid' | 'volcanic'

/**
 * A sect site's prestige tier (FIRST_REALM_PLAN §1). Poor sites are the safe
 * founding/fallback pool (never conquerable); Normal and Good sites are the
 * conquerable prestige seats that scarcity makes worth fighting over.
 */
export type SectSiteTier = 'poor' | 'normal' | 'good'

/**
 * A flavour/clustering tag on sites and resource nodes (FIRST_REALM_PLAN §1) —
 * NOT a navigational unit like ProvinceId; the whole world is one province.
 * Used for identity and for region-partitioned NPC decision-making (§4.3).
 */
export type RegionId = 'spiritMountain' | 'ancientForest' | 'desert' | 'forgottenRuins'

export type ResourceArchetypeId =
  | 'spiritIronMine'
  | 'jadeQuarry'
  | 'spiritHerbValley'
  | 'beastHuntingGrounds'
  | 'spiritCrystalCave'
  | 'ancientForest'
  | 'spiritSpring'

export type ExplorationArchetypeId =
  | 'ancientRuins'
  | 'ancientBattlefield'
  | 'dragonTomb'
  | 'hiddenCave'
  | 'immortalPavilion'
  | 'secretRealmEntrance'

/** Normalized 0–1 position for the hand-painted map; art only, never a simulation input (§8.2). */
export interface MapPosition {
  x: number
  y: number
}

/** How a province becomes reachable (§2.1). Tagged union — "unlocked" means different things at different stages. */
export type ProvinceUnlockRule =
  | { kind: 'starter' }
  | { kind: 'adjacent' }
  | { kind: 'gated'; requiredSectRank: number }
  | { kind: 'gated'; requiredResearchId: string }
  | { kind: 'sealed' }

/** How an exploration location becomes visible at all (§6.3). */
export type LocationDiscoveryRule =
  | { kind: 'visible' }
  | { kind: 'surveyed'; minSurveyProgress: number }
  | { kind: 'unlockedBy'; locationId: LocationId; minKnowledge: number }
  | { kind: 'itemGated'; itemId: string }

/** Generator input for a province's minor nodes (§5.4). Consumed by world generation in a later phase. */
export interface NodeTemplateRoll {
  templateId: string
  weight: number
  minCount: number
  maxCount: number
}

/**
 * One typed, uniform bundle of multiplicative modifiers (§4.2). Every field
 * defaults to 1 and the same shape is reused by sect sites, Spirit Veins,
 * owned outposts, and world events, so a single aggregation function
 * (getWorldModifiers, §11.3) can fold them all instead of scattering bonus
 * logic across the engine. `defenceMult` is declared now and stays inert until
 * a conflict system exists (§14).
 */
export interface SiteModifierBundle {
  cultivationSpeedMult: number
  productionMultByResource: Partial<Record<keyof Resources, number>>
  defenceMult: number
  travelTimeMult: number
  recruitmentRateMult: number
  upkeepMult: number
  buildTimeMult: number
}

/**
 * The outpost upgrade path on a resource location (§5.3 / §14) — the pipe the
 * absorbed Wave-7 territories flow through. Claiming builds level 1 via a `claim`
 * expedition; an owned outpost (`LocationRuntime.outpostLevel` ≥ 1) then folds its
 * `bonus` into getWorldModifiers passively (§11.3), so the old territory production
 * multipliers keep working through the one aggregation seam instead of a parallel
 * `getTerritoryProductionBonus`. Only level 1 exists at MVP scope; higher levels
 * are future content and cost no save bump (optional field).
 */
export interface OutpostUpgradePath {
  level1: {
    claimCost: Partial<Resources>
    requiredReputation: number
    /** On-site build duration of the `claim` expedition (the old claimDurationMs). */
    claimDurationMs: number
    /** Folded into getWorldModifiers while outpostLevel ≥ 1. */
    bonus: Partial<SiteModifierBundle>
  }
}

/** Sparse per-province runtime (§2.2). Stored only once discovered; absent = pristine. */
export interface ProvinceRuntime {
  discovered: boolean
  surveyProgress: number
}

/**
 * Defensive power on a sect seat or resource outpost (FIRST_REALM_PLAN §2.2 /
 * §4.1). NPC sites (and the player's derived seat strength) use the scalar
 * `strength`; a player-held site additionally lists the real disciples
 * stationed there. Optional so a save with no conquest yet needs no migration.
 */
export interface Garrison {
  strength: number
  discipleIds?: string[]
  /** When true, a stationed disciple who takes a wound is auto-recalled to the sect to recover (HEALTH_SYSTEM_PLAN Phase 5), freeing the slot and shrinking their death window. */
  returnWhenWounded?: boolean
  /** Future: defensive-formation building tie-in. */
  formationLevel?: number
}

/**
 * Sparse per-location runtime (§5.2). Stored ONLY once the player has touched a
 * location; a location with no entry is "pristine, undiscovered, full capacity"
 * and the resolver supplies these defaults. Never store definition fields here
 * (name, yields) — that is the single most important save-safety rule (§13.2).
 *
 * Also used for sect sites (FIRST_REALM_PLAN §2.2): `ownerId` on a sect site is
 * `'player' | <npcSectId> | undefined` (neutral), and `garrison` carries its
 * defensive strength. `outpostLevel`/`knowledge` stay meaningless for sites and
 * simply go unused there, same as they do for exploration locations today.
 */
export interface LocationRuntime {
  discovered: boolean
  remainingCapacity: number
  lastVisitedAt: number
  visitCount: number
  ownerId?: string
  outpostLevel: number
  knowledge: number
  flags: string[]
  garrison?: Garrison
}

/** The two ids + timestamp of the founding choice (§4.4). */
export interface SectLocation {
  provinceId: ProvinceId
  sectSiteId: SectSiteId
  foundedAt: number
}

/**
 * A generated minor node, stored authoritatively in the save once written
 * (§5.4) — the one deliberate exception to "store ids, never definitions",
 * because re-deriving from the seed on load would silently mutate a player's
 * world when a template's ranges are later edited. Field-compatible with a
 * resource location so the resolver can present it as one (§3.2).
 */
export interface GeneratedNodeRecord {
  id: LocationId
  kind: 'resource'
  provinceId: ProvinceId
  archetypeId: ResourceArchetypeId
  name: string
  yieldPerVisit: Partial<Resources>
  capacity: number
  regenPerDay?: number
  dangerTier: number
  travelUnits: number
  mapPosition: MapPosition
  maxParty: number
  onSiteDurationMs: number
}

// The Expedition model (§8). Shapes are defined here in Phase 2 so the whole
// `world` container lands in a single save-version bump; the lifecycle,
// resolver, and reward logic are built in the travel phase (§8.3).

export type ExpeditionPurpose = 'gather' | 'explore' | 'survey' | 'claim' | 'raid'
export type ExpeditionPhase = 'outbound' | 'onSite' | 'returning'

/** Accrued in-flight, banked on arrival home (§8.1). */
export interface ExpeditionPayload {
  resources: Partial<Resources>
  knowledgeGained: number
  itemsGained: ItemInstance[]
}

/** An injury/event recorded for the arrival report (§8.1 / §8.4). */
export interface ExpeditionIncident {
  cycle: number
  kind: string
  discipleId?: string
  description: string
}

export interface Expedition {
  id: string
  purpose: ExpeditionPurpose
  targetLocationId: LocationId
  discipleIds: string[]
  phase: ExpeditionPhase
  phaseEndsAt: number
  dispatchedAt: number
  /** Cached at dispatch so the return leg needs no recompute and can't drift from the outbound leg (§8.2). */
  outboundMs: number
  onSiteMs: number
  cycleTarget: number
  cyclesCompleted: number
  payload: ExpeditionPayload
  incidents: ExpeditionIncident[]
  /** One of `discipleIds` (FIRST_REALM_PLAN §2.6) — set only for Claim/Raid; feeds a combat power bonus in the battle simulator. */
  leaderId?: string
}

/**
 * A wound dealt to one of the PLAYER's own disciples during a battle
 * (FIRST_REALM_PLAN §4.7). NPC-side casualties are never tracked per-unit —
 * NPCs are an abstract `strength` scalar, chipped instead (§4.2).
 */
export interface BattleWoundResult {
  discipleId: string
  severity: Exclude<InjurySeverity, 'none'>
}

/**
 * The stored outcome of a Claim/Raid battle (FIRST_REALM_PLAN §2.6). Only the
 * outcome + seed persist — the round-by-round narrative is regenerated
 * deterministically from `seed`/`attackerPower`/`defenderPower` + the
 * (already-stored) party names on demand by BattleReportView, never stored
 * itself (§4.7).
 */
export interface BattleResult {
  /** True if the PLAYER won this battle (player-centric, regardless of side): on an attack the player is the attacker, on a defense the player is the defender. `false` on a draw (Phase 9) too — the draw is flagged by `outcomeTier: 'draw'`, which the report/log key off. */
  won: boolean
  /**
   * Which side the player fought on. Absent = `'attacker'` (every pre-defense-report entry, and all expedition/attack entries) — BattleReportView regenerates
   * the narrative with the stored roster as attackers. `'defender'` mirrors it: the stored roster are the DEFENDERS and `attackerName` labels the NPC attacker.
   */
  playerRole?: 'attacker' | 'defender'
  seed: number
  rounds: number
  attackerPower: number
  defenderPower: number
  wounds: BattleWoundResult[]
  /** Snapshot for accurate narrative regeneration (BattleReportView re-invokes the simulator with these same names). */
  leaderName?: string
  /** The player leader's combat trait (Phase 6) — snapshotted because it scales the casualty budget inside the simulator, so the report must regenerate with it. BattleReportView feeds it to whichever side the player commanded (attacker on an attack, defender on a defense). */
  leaderTrait?: CombatTrait
  /** Flavour label for the attacking NPC on a defense report (`playerRole: 'defender'`) — the mirror of `defenderName`, replaying exactly what npcSimulation passed as `attackerName`. */
  attackerName?: string
  /** The battle's terrain (Phase 7) — snapshotted because its intensity bias changes wounds at regen time; its power effect is already baked into the stored powers. Absent on missions (no map location) and on pre-Phase-7 reports. */
  terrain?: BattleTerrain
  /** Player-framed outcome tier (Phase 8) — the report header; drives the aftermath applied at resolve time. Absent on pre-Phase-8 reports (fall back to `won`). */
  outcomeTier?: BattleOutcomeTier
  defenderName: string
  /** Resources stolen from the defender's stockpile on a winning Raid (banked via the normal expedition payload). */
  lootedResources?: Partial<Resources>
  /** Human-readable territorial consequence, e.g. "Conquered Sacred Peak" or "Seized Whitecrag Iron Mine". */
  outcomeSummary: string
  /** Names of the player's disciples who died (or were crippled out of the sect) in this battle (HEALTH_SYSTEM_PLAN Phase 5) — snapshotted so the report shows a last-stand line even after they leave the roster. */
  deaths?: string[]
}

/** Newest-first arrival report, capped, mirroring missionLog (§9). */
export interface ExpeditionLogEntry {
  id: string
  purpose: ExpeditionPurpose
  targetLocationId: LocationId
  locationName: string
  discipleNames: string[]
  /** Combat temperaments, parallel to `discipleNames` — snapshotted so BattleReportView regenerates the same wound epithets (Phase 3 #8). Absent on non-combat arrivals and pre-v20 entries. */
  discipleTemperaments?: DiscipleTemperament[]
  payload: ExpeditionPayload
  incidents: ExpeditionIncident[]
  resolvedAt: number
  /** Present only for Claim/Raid arrivals that went through combat (FIRST_REALM_PLAN §4.7). */
  battleResult?: BattleResult
}

/** Which resolver delivered the report — drives the card icon and the filter chips. */
export type CombatReportSource = 'mission' | 'expedition' | 'defense'

/**
 * One delivered battle report (the inbox is the canonical home; the mission and
 * expedition logs are short activity feeds that merely reference the same fight).
 * Storage is deliberately thin: `battle` holds the outcome + seed only, and the
 * round-by-round narrative is regenerated by BattleReportView (§4.7).
 */
export interface CombatReportEntry {
  id: string
  source: CombatReportSource
  /** Headline on the card and in the report title — mission name, location name, or the attacking sect's raid line. */
  title: string
  /** Second card line: location for a mission, attacker name for a defense. */
  subtitle?: string
  /** The player's roster in this fight — passed straight to BattleReportView. */
  participantNames: string[]
  /** Parallel to `participantNames`; absent on backfilled pre-v24 entries → the simulator falls back to a name hash. */
  participantTemperaments?: DiscipleTemperament[]
  battle: BattleResult
  resolvedAt: number
  read: boolean
  /** `id` of the originating missionLog/expeditionLog entry, so a feed row can select this report instead of opening its own modal. */
  sourceEntryId?: string
}

/** An NPC sect's growth/decline standing (FIRST_REALM_PLAN §2.3 / §4.3). */
export type NpcSectTier = 'minor' | 'regional' | 'major' | 'legendary'

/**
 * A live NPC sect entity (FIRST_REALM_PLAN §2.3). Occupies exactly ONE seat
 * (the one-seat rule, §1) — conquest mutates `seatSiteId` (relocation) or
 * splices the sect out of `WorldState.npcSects` entirely (destroyed).
 * `LocationRuntime.ownerId` on the seat stays the authoritative source of
 * truth; `seatSiteId` is the reverse index only.
 */
export interface NpcSect {
  id: string
  name: string
  tier: NpcSectTier
  regionId: RegionId
  seatSiteId: SectSiteId
  /** Abstract defensive/offensive power; grows/shrinks over time (§4.3). */
  strength: number
  /** Resource outposts this sect holds; abandoned if it relocates. */
  outpostIds?: LocationId[]
  /** What a Raid can steal. */
  stockpile: Partial<Resources>
  /** 0..1 AI temperament driving how readily it climbs/raids. */
  aggression: number
  /** Ids of rival sects this one preferentially climbs/raids (FIRST_REALM_PLAN §8 Wave D). Dangling ids (rival destroyed) are ignored, not cleaned. */
  rivalIds?: string[]
  status: 'active' | 'declining'
  /** Epoch ms this sect's next autonomous pulse is due (FIRST_REALM_PLAN §4.3) — jittered per-entity so 24-32 sects don't all fire the same tick. */
  nextActionAt: number
  /** Epoch ms this sect settled its CURRENT seat — drives time-held strength growth (§4.3); reset on every relocation (climb, or refounded by emergence). */
  seatSince: number
}

/** All mutable world-map runtime state (§9). Every collection is sparse or empty at founding. */
export interface WorldState {
  /** Seed for the node generator — kept for debugging + lazy province generation (§5.4). */
  seed: number
  /** Sparse. Only provinces the player has discovered. */
  provinces: Record<ProvinceId, ProvinceRuntime>
  /** Sparse. Only locations the player has touched; absent = pristine defaults. */
  locations: Record<LocationId, LocationRuntime>
  /** Generated minor nodes, authoritative once written, keyed by province. */
  generatedNodes: Record<ProvinceId, GeneratedNodeRecord[]>
  /** Active expeditions. Multi-slot by design (§8.1). */
  expeditions: Expedition[]
  /** Newest-first arrival reports, capped. */
  expeditionLog: ExpeditionLogEntry[]
  /** Every living NPC sect (FIRST_REALM_PLAN §2.3), one per occupied prestige/minor seat. */
  npcSects: NpcSect[]
  /** Epoch ms the emergence mechanic next tries to spawn a minor sect onto a free Poor seat (§4.3), gated on ≥4 free seats. */
  nextNpcEmergenceAt: number
}

/** Empty-shell state with no buildings and zeroed resources. `createNewGame` (state/initialState.ts) builds the real Wave 1 starting state on top of this. */
export function createInitialGameState(): GameState {
  const now = Date.now()
  return {
    saveVersion: SAVE_VERSION,
    createdAt: now,
    lastSavedAt: now,
    simClock: { totalElapsedMs: 0 },
    worldClock: { totalElapsedMs: 0 },
    resources: createEmptyResources(),
    materials: {},
    buildings: {},
    disciples: [],
    items: [],
    missionBoard: { offers: [], nextRefreshAt: 0 },
    activeMissions: [],
    missionLog: [],
    reports: [],
    completedResearch: [],
    reputation: 0,
    factionRelationships: {},
    diplomaticActionCooldowns: {},
    nextWorldEventAt: 0,
    nextEventAt: 0,
    nextUpkeepAt: 0,
    eventLog: [],
    loginStreak: { current: 0, longest: 0, lastLoginDate: '' },
  }
}
