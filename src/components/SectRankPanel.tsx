import { useGameStore } from '../game/state/store'
import { computeSectRank } from '../game/engine/sectRank'
import { SECT_HALL_ID } from '../game/data/buildingDefs'

export function SectRankPanel() {
  const hallLevel = useGameStore((s) => s.state.buildings[SECT_HALL_ID]?.level ?? 1)
  const rank = computeSectRank(hallLevel)

  return (
    <section className="panel">
      <h2>Sect Rank</h2>
      <div className="rank-readout">{rank.name}</div>
      <p className="panel-hint">
        Sect Hall Lv{hallLevel} &middot; every building capped at level {rank.levelCap} at this rank
        {rank.nextRankAtHallLevel !== undefined
          ? ` (next rank at Sect Hall Lv${rank.nextRankAtHallLevel})`
          : ' (top rank scoped for Wave 1)'}
        .
      </p>
    </section>
  )
}
