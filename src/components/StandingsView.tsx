import type { NpcSect, NpcSectTier } from '../game/types'
import { useGameStore } from '../game/state/store'
import { getSite } from '../game/engine/world/worldAccess'
import { getFreePoorSeatIds } from '../game/engine/world/relocation'
import { getPublicSeatStrength } from '../game/engine/world/territory'

const TIER_LABELS: Record<NpcSectTier, string> = { legendary: 'Legendary', major: 'Major', regional: 'Regional', minor: 'Minor' }
const TIER_RANK: Record<NpcSectTier, number> = { legendary: 0, major: 1, regional: 2, minor: 3 }

function sortSects(sects: NpcSect[]): NpcSect[] {
  return [...sects].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.strength - a.strength)
}

/**
 * The standings/territory readout (FIRST_REALM_PLAN §7): who holds what and
 * how strong they are, since Wave C's NPC sim now changes the map without any
 * player input — this is the one place to see it all at a glance. Recent
 * ownership changes surface through the existing Sect Chronicle (EventLogPanel),
 * which already carries `source: 'npcSim'` entries; this view is the current
 * snapshot, not the history.
 */
export function StandingsView() {
  const state = useGameStore((s) => s.state)
  const npcSects = state.world?.npcSects ?? []
  const freePoorSeats = state.world ? getFreePoorSeatIds(state.world, state.world.locations) : []
  const nameById = new Map(npcSects.map((s) => [s.id, s.name]))

  return (
    <section className="panel standings-view">
      <h2>Standing</h2>
      <p className="panel-hint">
        Every living sect in the First Realm and the seat it holds. {freePoorSeats.length} Poor seat
        {freePoorSeats.length === 1 ? '' : 's'} still stand free.
      </p>

      {/* Rows, not a table — a table can't survive 360px. Strength trails, tabular. */}
      <div className="site-list">
        {state.sectLocation && (
          <div className="site-row standings-card owner-player">
            <span className="site-row-text">
              <span className="site-row-name">Your Sect</span>
              <span className="site-row-owner">
                You &middot; {getSite(state.world, state.sectLocation.sectSiteId).name}
              </span>
            </span>
            {/* The same scalar every NPC row shows (MULTIPLAYER_PLAN §2) — read from the seat runtime,
                not recomputed here, so this row reads exactly what a rival would see of you. */}
            <span className="standings-strength">{getPublicSeatStrength(state.world, state.sectLocation.sectSiteId)}</span>
          </div>
        )}
        {sortSects(npcSects).map((sect) => {
          // Rivalries (FIRST_REALM_PLAN §8 Wave D); dangling ids (rival destroyed) resolve to nothing and drop out.
          const rivals = (sect.rivalIds ?? []).map((id) => nameById.get(id)).filter((n): n is string => !!n)
          return (
            <div
              key={sect.id}
              className={`site-row standings-card owner-npc ${sect.status === 'declining' ? 'declining' : ''}`}
            >
                <span className="site-row-text">
                <span className="site-row-name">{sect.name}</span>
                <span className="site-row-owner">
                  {TIER_LABELS[sect.tier]} &middot; {getSite(state.world, sect.seatSiteId).name}
                  {sect.status === 'declining' ? ' · declining' : ''}
                  {rivals.length > 0 ? ` · rivals: ${rivals.join(', ')}` : ''}
                </span>
              </span>
              <span className="standings-strength">{sect.strength}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
