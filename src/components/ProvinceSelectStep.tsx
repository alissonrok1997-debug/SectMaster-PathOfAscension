import type { FoundingProvinceOption } from '../game/engine/world/founding'
import { getLandmarksForProvince } from '../game/data/world/landmarkDefs'
import { getResourceArchetype } from '../game/data/world/resourceArchetypeDefs'
import { getNeighbours } from '../game/data/world/worldGraph'
import { SpiritVeinBadge } from './SpiritVeinBadge'

/** Summarises the resource archetypes a province's landmarks offer, as unique icon+label chips. */
function resourceSummary(provinceId: string): { icon: string; label: string }[] {
  const seen = new Map<string, { icon: string; label: string }>()
  for (const loc of getLandmarksForProvince(provinceId)) {
    if (loc.kind !== 'resource') continue
    const archetype = getResourceArchetype(loc.archetypeId)
    if (!seen.has(archetype.id)) seen.set(archetype.id, { icon: archetype.icon, label: archetype.label })
  }
  return [...seen.values()]
}

interface Props {
  options: FoundingProvinceOption[]
  selectedProvinceId?: string
  onSelect: (provinceId: string) => void
}

export function ProvinceSelectStep({ options, selectedProvinceId, onSelect }: Props) {
  return (
    <div className="founding-cards">
      {options.map(({ province }) => {
        const selected = province.id === selectedProvinceId
        return (
          <button
            key={province.id}
            className={`founding-card${selected ? ' selected' : ''}`}
            onClick={() => onSelect(province.id)}
            aria-pressed={selected}
          >
            <h3>{province.name}</h3>
            <p className="panel-hint founding-card-meta">
              {province.theme} · {province.climate} · Difficulty {province.difficultyTier}
            </p>
            <p className="founding-card-desc">{province.description}</p>
            <p>
              <SpiritVeinBadge tier={province.spiritVeinTier} />
            </p>
            <div className="founding-chip-row">
              {resourceSummary(province.id).map((r) => (
                <span key={r.label} className="founding-chip">
                  {r.icon} {r.label}
                </span>
              ))}
            </div>
            <p className="panel-hint">
              {getNeighbours(province.id).length} neighbouring province
              {getNeighbours(province.id).length === 1 ? '' : 's'}
              {province.controllingFactionId ? ` · contested by ${province.controllingFactionId}` : ''}
            </p>
          </button>
        )
      })}
    </div>
  )
}
