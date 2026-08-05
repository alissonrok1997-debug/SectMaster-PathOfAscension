import type { NpcSect, NpcSectTier } from '../game/types'
import { useGameStore } from '../game/state/store'
import { getSectSiteDef } from '../game/data/world/sectSiteDefs'
import { getFreePoorSeatIds } from '../game/engine/world/relocation'

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
  const freePoorSeats = state.world ? getFreePoorSeatIds(state.world.locations) : []
  const nameById = new Map(npcSects.map((s) => [s.id, s.name]))

  return (
    <section className="panel standings-view">
      <h2>Standings</h2>
      <p className="panel-hint">
        Every living sect in the First Realm and the seat it holds. {freePoorSeats.length} Poor seat
        {freePoorSeats.length === 1 ? '' : 's'} still stand free.
      </p>

      <div className="recipe-grid">
        {state.sectLocation && (
          <div className="recipe-card standings-card owner-player">
            <div className="recipe-card-header">
              <h3>Your Sect</h3>
              <span className="recipe-discipline">You</span>
            </div>
            <p className="recipe-meta">Seat: {getSectSiteDef(state.sectLocation.sectSiteId).name}</p>
          </div>
        )}
        {sortSects(npcSects).map((sect) => (
          <div key={sect.id} className={`recipe-card standings-card ${sect.status === 'declining' ? 'declining' : ''}`}>
            <div className="recipe-card-header">
              <h3>{sect.name}</h3>
              <span className="recipe-discipline">{TIER_LABELS[sect.tier]}</span>
            </div>
            <p className="recipe-meta">Seat: {getSectSiteDef(sect.seatSiteId).name}</p>
            <p className="recipe-meta">
              Strength: {sect.strength}
              {sect.status === 'declining' ? ' · declining' : ''}
            </p>
            {(() => {
              // Rivalries (FIRST_REALM_PLAN §8 Wave D); dangling ids (rival destroyed) resolve to nothing and drop out.
              const rivals = (sect.rivalIds ?? []).map((id) => nameById.get(id)).filter((n): n is string => !!n)
              return rivals.length > 0 ? <p className="recipe-meta">Rivals: {rivals.join(', ')}</p> : null
            })()}
          </div>
        ))}
      </div>
    </section>
  )
}
