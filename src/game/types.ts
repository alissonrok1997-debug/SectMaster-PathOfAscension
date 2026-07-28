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

export type InjurySeverity = 'none' | 'minor' | 'major' | 'critical'

export interface DiscipleInstance {
  id: string
  name: string
  realm: CultivationRealm
  /** 0-100 progress toward the next realm's breakthrough. */
  cultivationProgress: number
  talent: number
  role: DiscipleRole
  grade: DiscipleGrade
  loyalty: number
  morale: number
  health: number
  injury: InjurySeverity
  /** Epoch ms when the current injury clears; undefined if uninjured. */
  injuryRecoversAt?: number
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
  rewardGranted: Partial<Resources>
  injuries: { name: string; severity: Exclude<InjurySeverity, 'none'> }[]
  resolvedAt: number
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

/** In-progress territory claim (doc 08 Section 9); single-slot, mirrors CraftingQueueState/ResearchQueueState. */
export interface TerritoryClaimQueueState {
  territoryId: string
  endsAt: number
}

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
  source: 'world' | 'narrative'
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

export const SAVE_VERSION = 10

export interface GameState {
  saveVersion: number
  createdAt: number
  lastSavedAt: number
  simClock: SimClockState
  worldClock: WorldClockState
  resources: Resources
  buildings: Record<string, BuildingInstance>
  disciples: DiscipleInstance[]
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
  /** Territory def ids the sect currently owns (doc 08 Section 9). Ownership is permanent at MVP scope — territory conflict/loss is Wave 9 backlog. */
  ownedTerritories: string[]
  /** Undefined when no territory claim is in progress. */
  territoryClaimQueue?: TerritoryClaimQueueState
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
  /** Resolved world + narrative events, newest first (doc 05 Section 11's Sect Chronicle / Event Log). */
  eventLog: EventLogEntry[]
  /** Consecutive-calendar-day login streak (doc 11 Section 19). */
  loginStreak: LoginStreakState
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
    buildings: {},
    disciples: [],
    items: [],
    missionBoard: { offers: [], nextRefreshAt: 0 },
    activeMissions: [],
    missionLog: [],
    completedResearch: [],
    reputation: 0,
    factionRelationships: {},
    ownedTerritories: [],
    diplomaticActionCooldowns: {},
    nextWorldEventAt: 0,
    nextEventAt: 0,
    eventLog: [],
    loginStreak: { current: 0, longest: 0, lastLoginDate: '' },
  }
}
