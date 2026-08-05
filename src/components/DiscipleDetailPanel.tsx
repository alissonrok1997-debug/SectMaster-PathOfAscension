import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getBuildingDef, SECT_HALL_ID } from '../game/data/buildingDefs'
import { getBoostEligibility } from '../game/engine/cultivationBoost'
import { getBreakthroughEligibility, getMoraleCultivationMultiplier, isReadyForBreakthrough } from '../game/engine/cultivation'
import { getAssignEligibility } from '../game/engine/buildingAssignment'
import { getExpelEligibility } from '../game/engine/recruitment'
import { getDiscoveredTechniques, getTeachEligibility } from '../game/engine/techniques'
import { getTechniqueDef } from '../game/data/techniqueDefs'
import { EQUIPMENT_SLOTS } from '../game/engine/equipment'
import { getEquipmentCombatPower } from '../game/engine/itemQuality'
import { getItemDef } from '../game/data/itemDefs'
import { getItemQualityDef } from '../game/data/itemQualityDefs'
import { formatCountdown } from '../game/utils/formatDuration'
import { getInjurySeverity, HEALTH_REGEN_PER_SECOND } from '../game/engine/injury'
import { isDowned } from '../game/engine/downed'
import { CULTIVATION_REALMS, type EquipmentSlotId, type InjurySeverity } from '../game/types'

const INJURY_LABEL: Record<InjurySeverity, string> = {
  none: '',
  minor: 'Minor Injury',
  major: 'Major Injury',
  critical: 'Critical Injury',
}

const SLOT_LABELS: Record<EquipmentSlotId, string> = {
  weapon: 'Weapon',
  bodyArmor: 'Body Armor',
  accessory1: 'Accessory 1',
  accessory2: 'Accessory 2',
}

const SLOT_MATCHES_ITEM: Record<EquipmentSlotId, 'Weapon' | 'Armor' | 'Accessory'> = {
  weapon: 'Weapon',
  bodyArmor: 'Armor',
  accessory1: 'Accessory',
  accessory2: 'Accessory',
}

type DetailTab = 'equipment' | 'consumables' | 'techniques'

export function DiscipleDetailPanel({ discipleId }: { discipleId: string }) {
  // Subscribing to the whole state so countdowns (away/injury/boost/learning) re-render every tick.
  const state = useGameStore((s) => s.state)
  const assignDisciple = useGameStore((s) => s.assignDisciple)
  const activateCultivationBoost = useGameStore((s) => s.activateCultivationBoost)
  const attemptBreakthrough = useGameStore((s) => s.attemptBreakthrough)
  const equipItem = useGameStore((s) => s.equipItem)
  const unequipItem = useGameStore((s) => s.unequipItem)
  const useConsumable = useGameStore((s) => s.useConsumable)
  const teachTechnique = useGameStore((s) => s.teachTechnique)
  const expelDisciple = useGameStore((s) => s.expelDisciple)

  const [tab, setTab] = useState<DetailTab>('equipment')

  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return null

  const assignableBuildings = Object.keys(state.buildings)
    .filter((id) => id !== SECT_HALL_ID)
    .map((id) => getBuildingDef(id))

  const isAway = disciple.awayUntil !== undefined
  const isDownedNow = isDowned(disciple, Date.now())
  const injurySeverity = getInjurySeverity(disciple)
  const isInjured = injurySeverity !== 'none'
  const isCritical = injurySeverity === 'critical'
  const hpPct = (disciple.health / disciple.maxHp) * 100
  // Recovery is now a flat regen, so "recovers in" is an estimate of time to full HP, not a stored timer.
  const msToFullHp = ((disciple.maxHp - disciple.health) / (HEALTH_REGEN_PER_SECOND * disciple.maxHp)) * 1000
  const isBoosted = disciple.activeBoostUntil !== undefined && disciple.activeBoostUntil > Date.now()
  const isLearning = disciple.learningTechniqueId !== undefined
  const isFinalRealm = CULTIVATION_REALMS.indexOf(disciple.realm) === CULTIVATION_REALMS.length - 1
  const boostEligibility = getBoostEligibility(state, disciple.id)
  const readyForBreakthrough = isReadyForBreakthrough(disciple)
  const breakthroughEligibility = getBreakthroughEligibility(state, disciple.id)
  const expelEligibility = getExpelEligibility(state, disciple.id)

  const discoveredTechniques = getDiscoveredTechniques(state)
  const knownTechniqueDefs = disciple.knownTechniques.map((id) => getTechniqueDef(id))
  const learningTechnique = disciple.learningTechniqueId ? getTechniqueDef(disciple.learningTechniqueId) : undefined
  const teachableTechniques = discoveredTechniques.filter((t) => !disciple.knownTechniques.includes(t.id))

  const healingPillStock = state.items.find((i) => i.itemId === 'minorHealingPill')?.quantity ?? 0
  const qiPillStock = state.items.find((i) => i.itemId === 'qiReplenishmentPill')?.quantity ?? 0

  // Each equipment piece is its own instance (unique Quality), so options are instances, not defs.
  const equipOptionsForSlot = (slot: EquipmentSlotId) =>
    state.items.filter((i) => {
      if (i.quantity <= 0) return false
      const def = getItemDef(i.itemId)
      return def.category === 'Equipment' && def.slotType === SLOT_MATCHES_ITEM[slot]
    })

  const canUseHealing = healingPillStock > 0 && disciple.health < disciple.maxHp
  const canUseQi = qiPillStock > 0 && !isAway && !isFinalRealm

  return (
    <div className="disciple-detail">
      <div className="disciple-card-header">
        <h3>{disciple.name}</h3>
        <span className="disciple-grade">{disciple.grade}</span>
      </div>
      <p className="panel-hint">
        {disciple.role} &middot; {disciple.realm} <span className="disciple-substage">{disciple.subRealm}/9</span>
      </p>
      {(() => {
        const mult = getMoraleCultivationMultiplier(disciple.morale)
        const pct = Math.round((mult - 1) * 100)
        const effect = pct === 0 ? 'normal cultivation' : `cultivation ${pct > 0 ? '+' : ''}${pct}%`
        return (
          <p className="panel-hint">
            Morale {disciple.morale} &middot; {effect}
          </p>
        )
      })()}

      <div className="disciple-hp">
        <div className="progress-bar">
          <div className={`progress-bar-fill ${isCritical ? 'hp-critical' : 'hp'}`} style={{ width: `${hpPct}%` }} />
        </div>
        <p className="panel-hint">
          HP {hpPct.toFixed(2)}%{isInjured && !isDownedNow ? ` · ${INJURY_LABEL[injurySeverity]} · recovers in ~${formatCountdown(msToFullHp)}` : ''}
        </p>
      </div>

      {isDownedNow ? (
        <p className="status-badge injured-badge">
          Downed — incapacitated, comes to in {formatCountdown((disciple.downedUntil ?? Date.now()) - Date.now())}
        </p>
      ) : (
        isCritical &&
        !isAway && (
          <p className="disciple-critical-warning">⚠ Critically wounded — dispatching them on a mission or expedition risks their death.</p>
        )
      )}

      {isBoosted && (
        <p className="status-badge boosted-badge">
          Active Cultivation Boost &middot; {formatCountdown((disciple.activeBoostUntil ?? Date.now()) - Date.now())}{' '}
          remaining
        </p>
      )}

      {isAway ? (
        <p className="status-badge away-badge">
          Away (Presence Requirement) &middot; returns in{' '}
          {formatCountdown((disciple.awayUntil ?? Date.now()) - Date.now())}
        </p>
      ) : isDownedNow ? (
        <p className="panel-hint">Incapacitated — cannot be assigned or dispatched until recovered.</p>
      ) : (
        <label className="disciple-assignment">
          Assigned to:{' '}
          <select
            value={disciple.assignedBuildingId ?? ''}
            onChange={(e) => assignDisciple(disciple.id, e.target.value || undefined)}
          >
            <option value="">Idle / Rest</option>
            {assignableBuildings.map((def) => {
              const full = !getAssignEligibility(state, disciple.id, def.id).canAssign
              return (
                <option key={def.id} value={def.id} disabled={full}>
                  {def.name}
                  {full ? ' (slots full)' : ''}
                </option>
              )
            })}
          </select>
        </label>
      )}

      {disciple.assignedBuildingId === 'trainingGround' && !isAway && (
        <div className="boost-controls">
          <button disabled={!boostEligibility.canActivate} onClick={() => activateCultivationBoost(disciple.id)}>
            Activate Cultivation Boost (20 Qi Stone, 15 Spirit Herb)
          </button>
          {!boostEligibility.canActivate && boostEligibility.reason && (
            <p className="upgrade-blocked-reason">{boostEligibility.reason}</p>
          )}
        </div>
      )}

      {readyForBreakthrough && (
        <div className="boost-controls breakthrough-controls">
          <button disabled={!breakthroughEligibility.canBreakthrough} onClick={() => attemptBreakthrough(disciple.id)}>
            Break through to next realm ({breakthroughEligibility.cost} Qi Stone &middot;{' '}
            {Math.round(breakthroughEligibility.successChance * 100)}% success)
          </button>
          {!breakthroughEligibility.canBreakthrough && breakthroughEligibility.reason && (
            <p className="upgrade-blocked-reason">{breakthroughEligibility.reason}</p>
          )}
        </div>
      )}

      <div className="disciple-detail-tabs">
        <button className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>
          Equipment
        </button>
        <button className={tab === 'consumables' ? 'active' : ''} onClick={() => setTab('consumables')}>
          Consumables
        </button>
        <button className={tab === 'techniques' ? 'active' : ''} onClick={() => setTab('techniques')}>
          Techniques
        </button>
      </div>

      {tab === 'equipment' && (
        <div className="equipment-section">
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipped = disciple.equipment[slot]
            const equippedDef = equipped ? getItemDef(equipped.itemId) : undefined
            const options = equipOptionsForSlot(slot)

            return (
              <div className="equipment-slot-row" key={slot}>
                <span className="equipment-slot-label">{SLOT_LABELS[slot]}</span>
                {equipped && equippedDef ? (
                  <>
                    <span className="equipment-slot-item">
                      {equippedDef.name}
                      {equipped.quality && (
                        <span style={{ color: getItemQualityDef(equipped.quality).color }}>
                          {' '}&middot; {equipped.quality}
                        </span>
                      )}{' '}
                      (+{getEquipmentCombatPower(equipped.itemId, equipped.quality)} CP)
                    </span>
                    <button disabled={isAway} onClick={() => unequipItem(disciple.id, slot)}>
                      Unequip
                    </button>
                  </>
                ) : options.length > 0 ? (
                  <select
                    value=""
                    disabled={isAway}
                    onChange={(e) => {
                      if (e.target.value) equipItem(disciple.id, e.target.value)
                    }}
                  >
                    <option value="">Equip…</option>
                    {options.map((inst) => {
                      const def = getItemDef(inst.itemId)
                      return (
                        <option key={inst.id} value={inst.id}>
                          {def.name}
                          {inst.quality ? ` · ${inst.quality}` : ''} (+
                          {getEquipmentCombatPower(inst.itemId, inst.quality)} CP)
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <span className="panel-hint">Empty</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'consumables' && (
        <div className="consumable-controls">
          {canUseHealing && (
            <button onClick={() => useConsumable(disciple.id, 'minorHealingPill')}>
              Use Minor Healing Pill ({healingPillStock})
            </button>
          )}
          {canUseQi && (
            <button onClick={() => useConsumable(disciple.id, 'qiReplenishmentPill')}>
              Use Qi Replenishment Pill ({qiPillStock})
            </button>
          )}
          {!canUseHealing && !canUseQi && (
            <p className="panel-hint">No consumables to use right now.</p>
          )}
        </div>
      )}

      {tab === 'techniques' && (
        <div className="technique-section">
          {knownTechniqueDefs.length > 0 && (
            <p className="technique-known">
              {knownTechniqueDefs.map((t) => `${t.name} (+${t.combatPowerBonus} CP)`).join(', ')}
            </p>
          )}
          {isLearning && learningTechnique && (
            <p className="status-badge boosted-badge">
              Learning {learningTechnique.name} &middot;{' '}
              {formatCountdown((disciple.learningTechniqueUntil ?? Date.now()) - Date.now())} remaining
            </p>
          )}
          {teachableTechniques.map((technique) => {
            const eligibility = getTeachEligibility(state, disciple.id, technique.id)
            return (
              <div className="equipment-slot-row" key={technique.id}>
                <span className="equipment-slot-label">{technique.name}</span>
                <button disabled={!eligibility.canTeach} onClick={() => teachTechnique(disciple.id, technique.id)}>
                  Teach
                </button>
                {!eligibility.canTeach && eligibility.reason && (
                  <span className="panel-hint">{eligibility.reason}</span>
                )}
              </div>
            )
          })}
          {knownTechniqueDefs.length === 0 && !isLearning && teachableTechniques.length === 0 && (
            <p className="panel-hint">No techniques discovered yet — research unlocks them.</p>
          )}
        </div>
      )}

      <div className="disciple-expel">
        <button
          type="button"
          className="demolish-button"
          disabled={!expelEligibility.canExpel}
          onClick={() => {
            if (
              window.confirm(
                `Expel ${disciple.name} from the sect? They leave permanently; any equipped gear returns to your inventory.`,
              )
            ) {
              expelDisciple(disciple.id)
            }
          }}
        >
          Expel Disciple
        </button>
        {!expelEligibility.canExpel && expelEligibility.reason && (
          <p className="panel-hint">{expelEligibility.reason}</p>
        )}
      </div>
    </div>
  )
}
