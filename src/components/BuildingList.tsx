import { useLayoutEffect, useRef, useState } from 'react'
import { getAllBuildingDefs } from '../game/data/buildingDefs'
import { BuildingTile } from './BuildingTile'
import { BuildingDetailPanel } from './BuildingDetailPanel'

export function BuildingList() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The building whose detail is mounted. Set on open/switch and left in place when closed, so the
  // drawer can animate shut (and reopen instantly) without depending on an animation-complete event.
  const [renderedId, setRenderedId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const clipRef = useRef<HTMLDivElement>(null)

  const toggle = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
    } else {
      setSelectedId(id)
      setRenderedId(id)
    }
  }

  // Animate the drawer with the Web Animations API: measure the current height, snap the resting
  // style to its next state (auto when open so content can grow freely, 0 when closed), measure
  // that, then animate between the two. WAAPI sidesteps the CSS-transition restart/same-frame
  // pitfalls that otherwise pin the height at 0.
  useLayoutEffect(() => {
    const clip = clipRef.current
    if (!clip) return
    // Clear any in-flight animation first so measurements reflect real layout, not an animated value.
    clip.getAnimations().forEach((a) => a.cancel())

    const from = clip.getBoundingClientRect().height
    clip.style.height = selectedId ? 'auto' : '0px'
    const to = clip.getBoundingClientRect().height

    if (from === to) return
    clip.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 260, easing: 'ease' })
  }, [selectedId, renderedId])

  // Point the drawer's caret at the horizontal center of the selected tile so it reads as an attached tab.
  useLayoutEffect(() => {
    if (!selectedId) return
    const positionCaret = () => {
      const grid = gridRef.current
      const drawer = drawerRef.current
      if (!grid || !drawer) return
      const tile = grid.querySelector<HTMLElement>(`[data-building-id="${selectedId}"]`)
      if (!tile) return
      const tileRect = tile.getBoundingClientRect()
      const drawerRect = drawer.getBoundingClientRect()
      drawer.style.setProperty('--caret-x', `${tileRect.left + tileRect.width / 2 - drawerRect.left}px`)
    }
    positionCaret()
    window.addEventListener('resize', positionCaret)
    return () => window.removeEventListener('resize', positionCaret)
  }, [selectedId])

  return (
    <section className="panel building-list-panel">
      <h2>Sect Buildings</h2>
      <p className="panel-hint">
        Single construction queue — only one upgrade can run at a time across the whole sect.
      </p>

      <div className="building-tile-grid" ref={gridRef}>
        {getAllBuildingDefs().map((def) => (
          <BuildingTile key={def.id} buildingId={def.id} active={selectedId === def.id} onSelect={toggle} />
        ))}
      </div>

      <div className={`building-drawer ${selectedId ? 'open' : ''}`} ref={drawerRef}>
        <div className="building-drawer-clip" ref={clipRef}>
          {renderedId && <BuildingDetailPanel buildingId={renderedId} />}
        </div>
      </div>
    </section>
  )
}
