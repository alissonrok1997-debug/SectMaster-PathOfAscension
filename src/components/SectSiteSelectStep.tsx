import type { Resources } from '../game/types'
import type { SectSiteDefinition } from '../game/data/world/sectSiteDefs'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { ModifierBundleList } from './ModifierBundleList'

function formatBonus(bonus: Partial<Resources>): string {
  return (Object.entries(bonus) as [keyof Resources, number][])
    .map(([key, amount]) => `+${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}

interface Props {
  sites: SectSiteDefinition[]
  selectedSiteId?: string
  onSelect: (sectSiteId: string) => void
}

export function SectSiteSelectStep({ sites, selectedSiteId, onSelect }: Props) {
  return (
    <div className="founding-cards">
      {sites.map((site) => {
        const selected = site.id === selectedSiteId
        return (
          <button
            key={site.id}
            className={`founding-card${selected ? ' selected' : ''}`}
            onClick={() => onSelect(site.id)}
            aria-pressed={selected}
          >
            <h3>{site.name}</h3>
            <p className="founding-card-desc">{site.description}</p>
            <p className="panel-hint">
              {site.buildingSlots} building slots · travel offset {site.travelUnitOffset >= 0 ? '+' : ''}
              {site.travelUnitOffset}
            </p>
            <ModifierBundleList bundle={site.modifiers} />
            {site.startingBonus ? (
              <p className="panel-hint">Founding grant: {formatBonus(site.startingBonus)}</p>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
