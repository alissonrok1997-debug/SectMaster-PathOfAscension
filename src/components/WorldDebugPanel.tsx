import type { Resources, SiteModifierBundle } from '../game/types'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { WORLD_DEF } from '../game/data/world/worldDef'
import { hopDistance, getNeighbours } from '../game/data/world/worldGraph'
import {
  getProvince,
  getProvinceLocations,
  getProvinceSites,
  getProvinceSpiritVein,
} from '../game/engine/world/worldQueries'
import { getResourceArchetype } from '../game/data/world/resourceArchetypeDefs'
import { getExplorationArchetype } from '../game/data/world/explorationArchetypeDefs'

function formatYield(yieldPerVisit: Partial<Resources>): string {
  return (Object.entries(yieldPerVisit) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}

/** Renders only the modifier fields that differ from their identity default, as ± lines. */
function formatBundle(bundle: SiteModifierBundle): string[] {
  const lines: string[] = []
  const pct = (mult: number) => `${mult >= 1 ? '+' : ''}${Math.round((mult - 1) * 100)}%`
  if (bundle.cultivationSpeedMult !== 1) lines.push(`Cultivation ${pct(bundle.cultivationSpeedMult)}`)
  if (bundle.defenceMult !== 1) lines.push(`Defence ${pct(bundle.defenceMult)}`)
  if (bundle.travelTimeMult !== 1) lines.push(`Travel time ${pct(bundle.travelTimeMult)}`)
  if (bundle.recruitmentRateMult !== 1) lines.push(`Recruitment ${pct(bundle.recruitmentRateMult)}`)
  if (bundle.upkeepMult !== 1) lines.push(`Upkeep ${pct(bundle.upkeepMult)}`)
  if (bundle.buildTimeMult !== 1) lines.push(`Build time ${pct(bundle.buildTimeMult)}`)
  for (const [key, mult] of Object.entries(bundle.productionMultByResource) as [keyof Resources, number][]) {
    lines.push(`${RESOURCE_LABELS[key]} ${pct(mult)}`)
  }
  return lines
}

/**
 * Debug-only static-world dump (WORLD_MAP_DESIGN Phase 1 verification). Renders
 * the handcrafted provinces, their sect sites, and their landmark locations
 * straight from the data/world defs via worldQueries — no gameplay, no state.
 * Retired once the real World Map screens exist (Phase 4).
 */
export function WorldDebugPanel() {
  const referenceProvinceId = WORLD_DEF.provinceIds[0]

  return (
    <section className="panel debug-panel">
      <h2>Debug: World Map (Phase 1 static data)</h2>
      <p className="panel-hint">
        Static province/site/location data rendered via worldQueries. Hop distances are measured from{' '}
        <strong>{getProvince(referenceProvinceId).name}</strong>. No gameplay yet — this is the Phase 1
        verification view and is retired when the real World Map screens land.
      </p>
      {WORLD_DEF.provinceIds.map((provinceId) => {
        const province = getProvince(provinceId)
        const vein = getProvinceSpiritVein(provinceId)
        const hops = hopDistance(referenceProvinceId, provinceId)
        return (
          <div key={provinceId} style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border, #333)' }}>
            <h3 style={{ marginBottom: '0.25rem' }}>
              {province.name} <span className="panel-hint">({province.theme} · {province.climate})</span>
            </h3>
            <p className="panel-hint" style={{ marginTop: 0 }}>{province.description}</p>
            <p style={{ margin: '0.25rem 0' }}>
              Spirit Vein: <strong>{vein.name}</strong> (cultivation ×{vein.cultivationMult}, recruit ×{vein.recruitQualityMult})
              {' · '}Difficulty {province.difficultyTier}
              {' · '}Hops from {getProvince(referenceProvinceId).name}: {hops === Infinity ? '—' : hops}
              {' · '}Neighbours: {getNeighbours(provinceId).map((n) => getProvince(n).name).join(', ') || 'none'}
              {province.controllingFactionId ? ` · Controlled by ${province.controllingFactionId}` : ''}
            </p>

            <div style={{ marginTop: '0.5rem' }}>
              <strong>Sect Sites</strong>
              <ul style={{ margin: '0.25rem 0' }}>
                {getProvinceSites(provinceId).map((site) => (
                  <li key={site.id}>
                    {site.name} — {site.buildingSlots} slots, travel offset {site.travelUnitOffset}
                    {formatBundle(site.modifiers).length > 0 ? `: ${formatBundle(site.modifiers).join(', ')}` : ' (no modifiers)'}
                    {site.startingBonus ? ` · start bonus ${formatYield(site.startingBonus)}` : ''}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <strong>Locations</strong>
              <ul style={{ margin: '0.25rem 0' }}>
                {getProvinceLocations(provinceId).map((loc) => (
                  <li key={loc.id}>
                    {loc.kind === 'resource' ? (
                      <>
                        {getResourceArchetype(loc.archetypeId).icon} {loc.name} — yields {formatYield(loc.yieldPerVisit)},
                        capacity {loc.capacity === Infinity ? '∞' : loc.capacity}
                        {loc.regenPerDay ? ` (+${loc.regenPerDay}/day)` : ''}, danger {loc.dangerTier}, {loc.travelUnits} units, party ≤{loc.maxParty}
                      </>
                    ) : (
                      <>
                        {getExplorationArchetype(loc.archetypeId).icon} {loc.name} — exploration, danger {loc.dangerTier},
                        {' '}{loc.travelUnits} units, +{Math.round(loc.knowledgePerVisit * 100)}% knowledge/visit, discovery: {loc.discoveryRule.kind}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}
    </section>
  )
}
