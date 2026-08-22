import { useState } from 'react'
import { WorldMapView } from '../WorldMapView'
import { ProvinceDetailView } from '../ProvinceDetailView'
import { StandingsView } from '../StandingsView'

/**
 * The World tab container (WORLD_MAP_DESIGN §12.1). Sub-view selection is LOCAL
 * React state, never GameState — which map screen the player is looking at is not
 * game state and must never be saved.
 *
 * `sites` and `map` are two views of the same data, so they are peers of Standing
 * rather than a second toggle nested inside Map. That collapses the audit's "three nav layers
 * on World" — subnav + view toggle + the global tab bar — down to two.
 */
type WorldTab = 'map' | 'sites' | 'standings'

const WORLD_TABS: { id: WorldTab; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'sites', label: 'Sites' },
  { id: 'standings', label: 'Standing' },
]

export function WorldScreen() {
  const [tab, setTab] = useState<WorldTab>('map')
  const [selection, setSelection] = useState<{ provinceId: string; territoryId?: string } | null>(null)

  return (
    <div className="world-screen">
      {/* The province sub-view owns the screen: its own back header replaces the subnav. */}
      <nav className="segmented world-subnav" hidden={selection !== null}>
        {WORLD_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`segmented-item ${tab === t.id ? 'active' : ''}`}
            aria-current={tab === t.id ? 'true' : undefined}
            onClick={() => {
              setTab(t.id)
              if (t.id === 'map' || t.id === 'sites') setSelection(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {(tab === 'map' || tab === 'sites') &&
        (selection ? (
          <ProvinceDetailView
            provinceId={selection.provinceId}
            territoryId={selection.territoryId}
            onBack={() => setSelection(null)}
          />
        ) : (
          <WorldMapView
            view={tab === 'sites' ? 'list' : 'map'}
            onSelectProvince={(provinceId, territoryId) => setSelection({ provinceId, territoryId })}
          />
        ))}

      {tab === 'standings' && <StandingsView />}
    </div>
  )
}
