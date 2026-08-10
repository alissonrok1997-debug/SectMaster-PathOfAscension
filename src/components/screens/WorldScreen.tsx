import { useState } from 'react'
import type { RegionId } from '../../game/types'
import { WorldMapView } from '../WorldMapView'
import { ProvinceDetailView } from '../ProvinceDetailView'
import { ActiveExpeditionsPanel } from '../ActiveExpeditionsPanel'
import { ExpeditionLogPanel } from '../ExpeditionLogPanel'
import { DiplomacyView } from '../DiplomacyView'
import { StandingsView } from '../StandingsView'

/**
 * The World tab container (WORLD_MAP_DESIGN §12.1). Sub-view selection is LOCAL
 * React state, never GameState — which map screen the player is looking at is not
 * game state and must never be saved. Phase 4 fills Map + Expeditions; the
 * existing factions/diplomacy/territory panels sit under Diplomacy until Phase 5
 * relocates them into a dedicated DiplomacyView.
 */
type WorldTab = 'map' | 'expeditions' | 'standings' | 'diplomacy'

export function WorldScreen() {
  const [tab, setTab] = useState<WorldTab>('map')
  const [selection, setSelection] = useState<{ provinceId: string; regionId?: RegionId } | null>(null)

  return (
    <div className="world-screen">
      {/* The province sub-view owns the screen: its own back header replaces the subnav. */}
      <nav className="world-subnav" hidden={selection !== null}>
        <button
          className={tab === 'map' ? 'active' : ''}
          onClick={() => {
            setTab('map')
            setSelection(null)
          }}
        >
          Map
        </button>
        <button className={tab === 'expeditions' ? 'active' : ''} onClick={() => setTab('expeditions')}>
          Expeditions
        </button>
        <button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>
          Standings
        </button>
        <button className={tab === 'diplomacy' ? 'active' : ''} onClick={() => setTab('diplomacy')}>
          Diplomacy
        </button>
      </nav>

      {tab === 'map' &&
        (selection ? (
          <ProvinceDetailView
            provinceId={selection.provinceId}
            regionId={selection.regionId}
            onBack={() => setSelection(null)}
          />
        ) : (
          <WorldMapView onSelectProvince={(provinceId, regionId) => setSelection({ provinceId, regionId })} />
        ))}

      {tab === 'expeditions' && (
        <div className="panel-grid">
          <ActiveExpeditionsPanel />
          <ExpeditionLogPanel />
        </div>
      )}

      {tab === 'standings' && <StandingsView />}

      {tab === 'diplomacy' && <DiplomacyView />}
    </div>
  )
}
