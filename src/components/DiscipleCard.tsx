import { useGameStore } from '../game/state/store'
import { getBuildingDef, SECT_HALL_ID } from '../game/data/buildingDefs'
import { getBoostEligibility } from '../game/engine/cultivationBoost'
import { getDiscipleCultivationRate } from '../game/engine/cultivation'
import { getAssignEligibility } from '../game/engine/buildingAssignment'
import { getDiscipleCombatPower } from '../game/engine/combatPower'
import { getResearchCultivationRateMultiplier } from '../game/engine/research'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { getDiscoveredTechniques, getTeachEligibility } from '../game/engine/techniques'
import { getTechniqueDef } from '../game/data/techniqueDefs'
import { EQUIPMENT_SLOTS } from '../game/engine/equipment'
import { getEquipmentCombatPower } from '../game/engine/itemQuality'
import { getItemDef } from '../game/data/itemDefs'
import { getItemQualityDef } from '../game/data/itemQualityDefs'
import { formatCountdown, formatDurationAdaptive } from '../game/utils/formatDuration'
import { CULTIVATION_REALMS, type DiscipleInstance, type EquipmentSlotId } from '../game/types'

const INJURY_LABEL: Record<DiscipleInstance['injury'], string> = {
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

export function DiscipleCard({ discipleId }: { discipleId: string }) {
  // Subscribing to the whole state so countdowns (away/injury) re-render every tick.
  const state = useGameStore((s) => s.state)
  const assignDisciple = useGameStore((s) => s.assignDisciple)
  const activateCultivationBoost = useGameStore((s) => s.activateCultivationBoost)
  const equipItem = useGameStore((s) => s.equipItem)
  const unequipItem = useGameStore((s) => s.unequipItem)
  const useConsumable = useGameStore((s) => s.useConsumable)
  const teachTechnique = useGameStore((s) => s.teachTechnique)

  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return null

  const assignableBuildings = Object.keys(state.buildings)
    .filter((id) => id !== SECT_HALL_ID)
    .map((id) => getBuildingDef(id))

  const isAway = disciple.awayUntil !== undefined
  const isInjured = disciple.injury !== 'none'
  const isBoosted = disciple.activeBoostUntil !== undefined && disciple.activeBoostUntil > Date.now()
  const isLearning = disciple.learningTechniqueId !== undefined
  const boostEligibility = getBoostEligibility(state, disciple.id)
  const trainingHallLevel = state.buildings.trainingHall?.level ?? 0
  const doctrineMods = getDoctrineModifiers(state)
  const cultivationRateMultiplier = getResearchCultivationRateMultiplier(state) * doctrineMods.cultivationRateMult
  const cultivationRate = getDiscipleCultivationRate(disciple, trainingHallLevel, cultivationRateMultiplier)
  const pointsRemaining = Math.max(0, 100 - disciple.cultivationProgress)
  const etaToNextRealm = cultivationRate > 0 ? formatDurationAdaptive(pointsRemaining / cultivationRate) : null
  const combatPower = getDiscipleCombatPower(disciple, doctrineMods.combatPowerMult)
  const isFinalRealm = CULTIVATION_REALMS.indexOf(disciple.realm) === CULTIVATION_REALMS.length - 1
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

  return (
    <div className={`disciple-card ${isAway ? 'away' : ''} ${isInjured ? 'injured' : ''}`}>
      <div className="disciple-card-header">
        <h3>{disciple.name}</h3>
        <span className="disciple-grade">{disciple.grade}</span>
      </div>
      <p className="panel-hint">
        {disciple.role} &middot; Talent {disciple.talent} &middot; Combat Power {combatPower}
      </p>

      <div className="disciple-realm">{disciple.realm}</div>
      <div className="progress-bar">
        <div className="progress-bar-fill day" style={{ width: `${disciple.cultivationProgress}%` }} />
      </div>
      <p className="panel-hint cultivation-detail">
        {disciple.cultivationProgress.toFixed(1)} / 100 pts &middot;{' '}
        {etaToNextRealm ? `${etaToNextRealm} to next realm` : 'Not cultivating'}
        <br />
        {cultivationRate > 0 && `+${cultivationRate.toFixed(2)} pts/s`}
      </p>

      <div className="disciple-stat-row">
        <span>Loyalty {disciple.loyalty}</span>
        <span>Morale {disciple.morale}</span>
        <span>Health {disciple.health}</span>
      </div>

      {isInjured && (
        <p className="status-badge injured-badge">
          {INJURY_LABEL[disciple.injury]} &middot; recovers in{' '}
          {formatCountdown((disciple.injuryRecoversAt ?? Date.now()) - Date.now())}
        </p>
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

      <div className="equipment-section">
        <p className="panel-hint">Equipment</p>
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

      <div className="technique-section">
        <p className="panel-hint">Techniques</p>
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
      </div>

      {(healingPillStock > 0 || qiPillStock > 0) && (
        <div className="consumable-controls">
          {healingPillStock > 0 && isInjured && (
            <button onClick={() => useConsumable(disciple.id, 'minorHealingPill')}>
              Use Minor Healing Pill ({healingPillStock})
            </button>
          )}
          {qiPillStock > 0 && !isAway && !isFinalRealm && (
            <button onClick={() => useConsumable(disciple.id, 'qiReplenishmentPill')}>
              Use Qi Replenishment Pill ({qiPillStock})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
