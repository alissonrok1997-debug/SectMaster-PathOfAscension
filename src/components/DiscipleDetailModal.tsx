import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { DiscipleDetailPanel } from './DiscipleDetailPanel'

export function DiscipleDetailModal({
  initialDiscipleId,
  onClose,
}: {
  initialDiscipleId: string
  onClose: () => void
}) {
  // Step through disciples in the same talent-sorted order the roster grid shows,
  // so the prev/next arrows follow the on-screen order rather than store order.
  const disciples = [...useGameStore((s) => s.state.disciples)].sort((a, b) => b.talent - a.talent)
  const [selectedId, setSelectedId] = useState(initialDiscipleId)

  let index = disciples.findIndex((d) => d.id === selectedId)
  if (index === -1) index = 0
  const selected = disciples[index]
  if (!selected) {
    onClose()
    return null
  }

  const step = (delta: number) => {
    const next = (index + delta + disciples.length) % disciples.length
    setSelectedId(disciples[next].id)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel disciple-modal" onClick={(e) => e.stopPropagation()}>
        <div className="disciple-modal-nav">
          <button aria-label="Previous disciple" disabled={disciples.length < 2} onClick={() => step(-1)}>
            ‹
          </button>
          <span className="panel-hint">
            {index + 1} / {disciples.length}
          </span>
          <button aria-label="Next disciple" disabled={disciples.length < 2} onClick={() => step(1)}>
            ›
          </button>
        </div>
        <DiscipleDetailPanel discipleId={selected.id} />
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
