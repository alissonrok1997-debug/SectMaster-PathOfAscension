import { useGameStore } from '../game/state/store'
import { getItemDef } from '../game/data/itemDefs'
import { getItemQualityDef } from '../game/data/itemQualityDefs'

export function InventoryPanel() {
  const items = useGameStore((s) => s.state.items)

  return (
    <section className="panel inventory-panel">
      <h2>Inventory</h2>
      {items.length === 0 ? (
        <p className="panel-hint">Nothing crafted yet — the sect's inventory is empty.</p>
      ) : (
        <ul className="inventory-list">
          {items.map((item) => {
            const def = getItemDef(item.itemId)
            const qualityDef = item.quality ? getItemQualityDef(item.quality) : undefined
            return (
              <li className="inventory-entry" key={item.id}>
                <span className="inventory-name">{def.name}</span>
                <span className="inventory-category">{def.category}</span>
                {qualityDef ? (
                  <span className="inventory-quality" style={{ color: qualityDef.color }}>
                    {qualityDef.label}
                  </span>
                ) : (
                  <span className="inventory-rarity">{def.rarity}</span>
                )}
                <span className="inventory-qty">{qualityDef ? '' : `×${item.quantity}`}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
