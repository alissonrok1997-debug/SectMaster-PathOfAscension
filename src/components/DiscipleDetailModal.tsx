import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { DiscipleDetailPanel } from './DiscipleDetailPanel'
import { BottomSheet } from './BottomSheet'
import { DiscipleLeafFooter, hasLeafFooterAction } from './DiscipleLeafFooter'
import { UiIcon } from './UiIcon'

export function DiscipleDetailModal({
  initialDiscipleId,
  order,
  onClose,
}: {
  initialDiscipleId: string
  /**
   * The roll's on-screen order — the plate, then each realm group top to bottom, as
   * `DiscipleRoster` renders it. Passed in rather than derived here: this component cannot
   * see the grouping, and deriving it a second time is how the two fell out of step before.
   */
  order: string[]
  onClose: () => void
}) {
  const disciples = useGameStore((s) => s.state.disciples)
  const [selectedId, setSelectedId] = useState(initialDiscipleId)

  // Filtered against the live roster so a disciple who dies while the sheet is open — a
  // failed breakthrough can do exactly that — drops out of the walk instead of stepping to
  // a blank sheet.
  const ids = order.filter((id) => disciples.some((d) => d.id === id))

  let index = ids.indexOf(selectedId)
  if (index === -1) index = 0
  const selected = disciples.find((d) => d.id === ids[index])
  if (!selected) {
    onClose()
    return null
  }

  const step = (delta: number) => setSelectedId(ids[(index + delta + ids.length) % ids.length])
  const canStep = ids.length > 1

  /*
   * The header carries the walk. This replaces `.disciple-modal-nav`, a full row beneath the
   * header that repeated the name already above it — two rows to say one thing, in the
   * screen's most expensive vertical space (§1.7).
   *
   * The arrows are §15 chrome: the monoline `chevron` glyph at 1.5px, mirrored for prev,
   * rather than the ‹ › text characters the old row used.
   */
  const header = (
    <>
      <button
        type="button"
        className="leaf-step"
        aria-label="Previous disciple"
        disabled={!canStep}
        onClick={() => step(-1)}
      >
        <UiIcon name="chevron" className="flip" />
      </button>

      <span className="leaf-ident">
        <span className="leaf-name">{selected.name}</span>
        <span className="leaf-count">
          {index + 1} of {ids.length}
        </span>
      </span>

      <button
        type="button"
        className="leaf-step"
        aria-label="Next disciple"
        disabled={!canStep}
        onClick={() => step(1)}
      >
        <UiIcon name="chevron" />
      </button>
    </>
  )

  return (
    /*
     * `panelClassName` is the whole reason the leaf can be parchment. `BottomSheet` portals
     * to <body>, so no `.parchment` descendant selector written for the roster's wrapper
     * reaches this panel; putting the class ON the panel does. §12 and §19 both say the
     * tokens must graduate to `:root` first — measured, they need not.
     *
     * `title` is still passed: `header` replaces its visual role, but it remains the panel's
     * `aria-label`.
     */
    <BottomSheet
      open
      onClose={onClose}
      title={selected.name}
      height="full"
      panelClassName="parchment leaf"
      header={header}
      /*
       * `footer` is passed conditionally, not always. `BottomSheet` guards on `{footer && …}`
       * and a React element that renders null is still truthy, so passing it unconditionally
       * would draw an empty bar — top rule, padding and all — on every disciple who is not at
       * the gate.
       */
      footer={
        hasLeafFooterAction(disciples, selected.id) ? <DiscipleLeafFooter discipleId={selected.id} /> : undefined
      }
    >
      <DiscipleDetailPanel discipleId={selected.id} />
    </BottomSheet>
  )
}
