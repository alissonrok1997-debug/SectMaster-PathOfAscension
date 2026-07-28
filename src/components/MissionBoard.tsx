import { useGameStore } from '../game/state/store'
import { getMissionDef } from '../game/data/missionDefs'
import { formatCountdown } from '../game/utils/formatDuration'
import { MissionOfferCard } from './MissionOfferCard'

export function MissionBoard() {
  // Subscribing to the whole state so the refresh countdown re-renders every tick.
  const state = useGameStore((s) => s.state)
  const refreshInMs = state.missionBoard.nextRefreshAt - Date.now()

  return (
    <section className="panel mission-board-panel">
      <div className="mission-board-header">
        <h2>Mission Board</h2>
        <p className="panel-hint">Board refreshes in {formatCountdown(Math.max(0, refreshInMs))}</p>
      </div>
      {state.missionBoard.offers.length === 0 ? (
        <p className="panel-hint">No missions currently posted — check back after the board refreshes.</p>
      ) : (
        <div className="mission-grid">
          {state.missionBoard.offers.map((offer) => (
            <MissionOfferCard key={offer.id} offer={offer} def={getMissionDef(offer.defId)} />
          ))}
        </div>
      )}
    </section>
  )
}
