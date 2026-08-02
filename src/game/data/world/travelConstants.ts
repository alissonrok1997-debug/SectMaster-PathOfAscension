/**
 * Travel + expedition tuning (WORLD_MAP_DESIGN §8 / §10). Dev-placeholder scale
 * like every other number in this prototype (seconds, not hours) so the loop can
 * be verified live. Travel time is the straight-line map distance from the seat
 * to the target (the same metric the influence bubble uses), turned into real
 * durations by this single ms-per-map-unit dial — so a node that reads as closer
 * is always a shorter trip, and the round-trip label never contradicts the map.
 */

/** Milliseconds of travel per unit of normalized map distance (map spans 0..1 per axis). */
export const MS_PER_MAP_DISTANCE = 20_000

/** Baseline units added per province hop crossed (§8.2). Home-province trips pay none. */
export const INTER_PROVINCE_UNITS = 4

/**
 * Flat concurrency cap on active expeditions (§8.1). A derived value, not a
 * single-slot queue — parallel expeditions are the whole point of assigning
 * disciples to the world. A constant for now; a later wave can scale it off sect
 * rank or a building, which is why callers read it through a function.
 */
export const BASE_MAX_CONCURRENT_EXPEDITIONS = 4

/** How many resolved expeditions the arrival log keeps, mirroring MISSION_LOG_LIMIT. */
export const EXPEDITION_LOG_LIMIT = 10
