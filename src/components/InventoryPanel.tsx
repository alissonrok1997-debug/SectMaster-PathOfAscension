import { useGameStore } from '../game/state/store'
import { getItemDef } from '../game/data/itemDefs'
import { getItemQualityDef } from '../game/data/itemQualityDefs'
import { describeAffix } from '../game/data/itemAffixDefs'
import { describeProvenance } from '../game/engine/itemProvenance'
import { MATERIAL_DEFS } from '../game/data/materialDefs'

export function InventoryPanel() {
  const items = useGameStore((s) => s.state.items)
  const materials = useGameStore((s) => s.state.materials)
  const heldMaterials = MATERIAL_DEFS.filter((m) => (materials[m.id] ?? 0) > 0)

  return (
    <section className="panel inventory-panel">
      <h2>Inventory</h2>
      {heldMaterials.length > 0 && (
        <>
          <h3 className="inventory-subheading">Crafting Materials</h3>
          <ul className="inventory-list">
            {heldMaterials.map((m) => (
              <li className="inventory-entry" key={m.id}>
                <span className="inventory-name">{m.name}</span>
                <span className="inventory-category">Material</span>
                <span className="inventory-qty">×{materials[m.id]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {items.length === 0 ? (
        <p className="panel-hint">Nothing crafted yet — the sect's inventory is empty.</p>
      ) : (
        <ul className="inventory-list">
          {items.map((item) => {
            const def = getItemDef(item.itemId)
            const qualityDef = item.quality ? getItemQualityDef(item.quality) : undefined
            return (
              <li className="inventory-entry" key={item.id}>
                <span className="inventory-name">
                  {item.forgedName ?? def.name}
                  {item.forgedName && <span className="inventory-subtitle"> — {def.name}</span>}
                </span>
                <span className="inventory-category">{def.category}</span>
                {qualityDef ? (
                  <span className="inventory-quality" style={{ color: qualityDef.color }}>
                    {qualityDef.label}
                  </span>
                ) : (
                  <span className="inventory-rarity">{def.rarity}</span>
                )}
                <span className="inventory-qty">{qualityDef ? '' : `×${item.quantity}`}</span>
                {item.affixes && item.affixes.length > 0 && (
                  <span className="inventory-affixes">{item.affixes.map(describeAffix).join(' · ')}</span>
                )}
                {def.category === 'Equipment' && (
                  <span className="inventory-provenance">{describeProvenance(item)}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
