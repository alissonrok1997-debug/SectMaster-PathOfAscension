import type { CombatReportEntry, CombatReportSource } from '../game/types'
import { TIER_LABEL } from '../game/engine/combat/battleSimulator'

const SOURCE_LABEL: Record<CombatReportSource, string> = {
  mission: 'Mission',
  expedition: 'Expedition',
  defense: 'Defense',
}

/** Compact "2m ago" / "3h ago" / "5d ago" relative time for a card's meta line. */
function relativeTime(then: number, now: number): string {
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function ReportCard({
  entry,
  selected,
  now,
  onSelect,
}: {
  entry: CombatReportEntry
  selected: boolean
  now: number
  onSelect: () => void
}) {
  const { battle } = entry
  const tier = battle.outcomeTier ? TIER_LABEL[battle.outcomeTier] : battle.won ? 'Victory' : 'Defeat'
  const roster =
    entry.participantNames.length <= 2 ? entry.participantNames.join(', ') : `${entry.participantNames.length} disciples`
  const deaths = battle.deaths?.length ?? 0

  return (
    <button
      type="button"
      className={`report-card${selected ? ' selected' : ''}${entry.read ? '' : ' unread'}`}
      onClick={onSelect}
    >
      <span className="report-card-title">
        {!entry.read && <span className="report-card-dot" aria-label="Unread" />}
        {entry.title}
        <span className={`report-card-tier tier-${battle.outcomeTier ?? (battle.won ? 'decisive' : 'defeat')}`}>{tier}</span>
      </span>
      <span className="report-card-meta">
        {entry.subtitle ?? SOURCE_LABEL[entry.source]} &middot; {relativeTime(entry.resolvedAt, now)}
      </span>
      <span className="report-card-roster">
        {roster}
        {deaths > 0 && <span className="report-card-deaths"> &middot; {deaths} fallen</span>}
      </span>
    </button>
  )
}
