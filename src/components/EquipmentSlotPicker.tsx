import { useGameStore } from '../game/state/store'
import { getItemDef } from '../game/data/itemDefs'
import { getItemQualityDef } from '../game/data/itemQualityDefs'
import { getEquipmentCombatPower } from '../game/engine/itemQuality'
import { describeAffix } from '../game/data/itemAffixDefs'
import { BottomSheet } from './BottomSheet'
import type { EquipmentSlotId, ItemInstance } from '../game/types'

interface EquipmentSlotPickerProps {
  discipleId: string
  slot: EquipmentSlotId
  slotLabel: string
  /** Candidate instances for this slot, already filtered by the parent's slot-type rule. */
  options: ItemInstance[]
  equipped?: ItemInstance
  disabled: boolean
  onClose: () => void
}

/**
 * Replaces the native <select> per equipment slot. A dropdown can only show a name; this
 * shows quality colour and — the reason it exists — the CP delta against what's already
 * worn, so the choice can be made without arithmetic.
 */
export function EquipmentSlotPicker({
  discipleId,
  slot,
  slotLabel,
  options,
  equipped,
  disabled,
  onClose,
}: EquipmentSlotPickerProps) {
  const equipItem = useGameStore((s) => s.equipItem)
  const unequipItem = useGameStore((s) => s.unequipItem)

  const equippedCp = equipped ? getEquipmentCombatPower(equipped.itemId, equipped.quality) : 0

  return (
    /* Opens stacked ON the leaf, so it takes the same surface — otherwise a dark sheet
       slides over a parchment one. */
    <BottomSheet
      open
      onClose={onClose}
      title={slotLabel}
      height="full"
      panelClassName="parchment leaf"
    >
      {equipped && (
        <button
          type="button"
          className="slot-option slot-option-unequip"
          disabled={disabled}
          onClick={() => {
            unequipItem(discipleId, slot)
            onClose()
          }}
        >
          Unequip {equipped.forgedName ?? getItemDef(equipped.itemId).name}
        </button>
      )}

      {options.length === 0 ? (
        <p className="panel-hint">Nothing in the inventory fits this slot.</p>
      ) : (
        options.map((inst) => {
          const def = getItemDef(inst.itemId)
          const cp = getEquipmentCombatPower(inst.itemId, inst.quality)
          const delta = cp - equippedCp
          return (
            <button
              key={inst.id}
              type="button"
              className="slot-option"
              disabled={disabled}
              onClick={() => {
                equipItem(discipleId, inst.id)
                onClose()
              }}
            >
              <span className="slot-option-main">
                <span className="slot-option-name">
                  {inst.forgedName ?? def.name}
                  {inst.quality && (
                    <span style={{ color: getItemQualityDef(inst.quality).color }}> · {inst.quality}</span>
                  )}
                </span>
                {inst.affixes && inst.affixes.length > 0 && (
                  <span className="slot-option-affixes">{inst.affixes.map(describeAffix).join(' · ')}</span>
                )}
              </span>
              <span className={`slot-option-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                {delta > 0 ? '+' : ''}
                {delta} CP
              </span>
            </button>
          )
        })
      )}
    </BottomSheet>
  )
}
