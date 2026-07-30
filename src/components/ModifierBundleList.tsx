import type { Resources, SiteModifierBundle } from '../game/types'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'

/**
 * Renders a SiteModifierBundle as ± lines (WORLD_MAP_DESIGN §12.5). Pure display:
 * it shows only the fields that differ from their identity default of 1, with no
 * per-field special-casing beyond formatting. `defenceMult` is shown honestly
 * even though it is inert until a conflict system exists (§14).
 */
function pct(mult: number): string {
  return `${mult >= 1 ? '+' : ''}${Math.round((mult - 1) * 100)}%`
}

export function ModifierBundleList({ bundle }: { bundle: SiteModifierBundle }) {
  const lines: { label: string; mult: number }[] = []
  if (bundle.cultivationSpeedMult !== 1) lines.push({ label: 'Cultivation speed', mult: bundle.cultivationSpeedMult })
  if (bundle.defenceMult !== 1) lines.push({ label: 'Defence', mult: bundle.defenceMult })
  if (bundle.travelTimeMult !== 1) lines.push({ label: 'Travel time', mult: bundle.travelTimeMult })
  if (bundle.recruitmentRateMult !== 1) lines.push({ label: 'Recruitment rate', mult: bundle.recruitmentRateMult })
  if (bundle.upkeepMult !== 1) lines.push({ label: 'Upkeep', mult: bundle.upkeepMult })
  if (bundle.buildTimeMult !== 1) lines.push({ label: 'Build time', mult: bundle.buildTimeMult })
  for (const [key, mult] of Object.entries(bundle.productionMultByResource) as [keyof Resources, number][]) {
    lines.push({ label: `${RESOURCE_LABELS[key]} production`, mult })
  }

  if (lines.length === 0) return <p className="panel-hint">No modifiers.</p>

  return (
    <ul className="modifier-list">
      {lines.map((line) => {
        // Lower-is-better fields (travel time, upkeep, build time) read as a benefit when below 1.
        const lowerIsBetter = line.label === 'Travel time' || line.label === 'Upkeep' || line.label === 'Build time'
        const good = lowerIsBetter ? line.mult < 1 : line.mult > 1
        return (
          <li key={line.label} className={good ? 'mod-good' : 'mod-bad'}>
            {line.label}: {pct(line.mult)}
          </li>
        )
      })}
    </ul>
  )
}
