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
import { SLOT_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import { EquipmentSlotPicker } from './EquipmentSlotPicker'
import { getEquipmentCombatPower } from '../game/engine/itemQuality'
import { getItemDef } from '../game/data/itemDefs'
import { getItemQualityDef } from '../game/data/itemQualityDefs'
import { describeAffix } from '../game/data/itemAffixDefs'
import { describeSetBonus } from '../game/data/equipmentSetDefs'
import { getActiveEquipmentSets } from '../game/engine/itemAffixes'
import { describeProvenance } from '../game/engine/itemProvenance'
import { formatCountdown } from '../game/utils/formatDuration'
import { getDiscipleCombatPower } from '../game/engine/combatPower'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { DisciplePortrait, RealmLine, subRealmOrdinal } from './DisciplePortrait'
import { publishBreakthroughMoment } from './breakthroughChannel'
import { useValueFlash } from './useValueFlash'
import { getEffectiveMaxHp, getHealthRegenPerSecond, getInjurySeverity } from '../game/engine/injury'
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
  const useConsumable = useGameStore((s) => s.useConsumable)
  const teachTechnique = useGameStore((s) => s.teachTechnique)
  const expelDisciple = useGameStore((s) => s.expelDisciple)

  const [tab, setTab] = useState<DetailTab>('equipment')
  const [pickerSlot, setPickerSlot] = useState<EquipmentSlotId | null>(null)

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
  const effectiveMaxHp = getEffectiveMaxHp(disciple)
  const hpPct = (disciple.health / effectiveMaxHp) * 100
  // Recovery is now a flat regen, so "recovers in" is an estimate of time to full HP, not a stored timer.
  const msToFullHp = ((effectiveMaxHp - disciple.health) / (getHealthRegenPerSecond() * effectiveMaxHp)) * 1000
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

  /*
   * The breakthrough moment reads the outcome the engine already decided (§16.3).
   * `attemptBreakthrough` is a synchronous zustand action, so snapshotting the realm here
   * and re-reading the store straight after tells us what happened without a store field
   * or a save migration for something that lives 1.2 seconds.
   *
   * A missing disciple afterwards is not an error: a failed breakthrough wounds, and
   * `resolveDownedDisciples` can remove a disciple who hits 0 HP. `undefined` means death.
   */
  const onAttemptBreakthrough = () => {
    const before = { name: disciple.name, realm: disciple.realm }
    attemptBreakthrough(disciple.id)
    const after = useGameStore.getState().state.disciples.find((d) => d.id === disciple.id)
    if (!after) {
      publishBreakthroughMoment({ kind: 'failure', name: before.name, consequence: 'death' })
      return
    }
    if (after.realm !== before.realm) {
      publishBreakthroughMoment({ kind: 'success', name: after.name, realm: after.realm })
      return
    }
    publishBreakthroughMoment({
      kind: 'failure',
      name: after.name,
      consequence: isDowned(after, Date.now()) ? 'downed' : 'wound',
    })
  }

  // Combat Power only changes on discrete events (equip, breakthrough, technique, injury),
  // so it needs no threshold — any movement of a whole point is worth acknowledging.
  const combatPower = getDiscipleCombatPower(disciple, getDoctrineModifiers(state).combatPowerMult)
  const cpFlash = useValueFlash({ cp: combatPower }, () => 1)

  const canUseHealing = healingPillStock > 0 && disciple.health < effectiveMaxHp
  const canUseQi = qiPillStock > 0 && !isAway && !isFinalRealm

  return (
    <div className="disciple-detail">
      {/*
       * Portrait + name + realm as one header block (§16.2). The old "{role} · {realm} n/9"
       * hint line is gone: the plaque's nameplate carries the role and the jade line carries
       * the realm, so it was restating both in developer-hint grey.
       */}
      <div className="disciple-sheet-header">
        <DisciplePortrait disciple={disciple} variant="sheet" />
        <div className="disciple-sheet-ident">
          <h3>{disciple.name}</h3>
          <RealmLine disciple={disciple} />
          <span className={`disciple-grade grade-${disciple.grade.toLowerCase()}`}>{disciple.grade}</span>
          <span className={`disciple-sheet-cp ${cpFlash.cp ?? ''}`} title="Combat Power">
            {combatPower}
          </span>
        </div>
      </div>
      {/*
       * The cultivation bar (§16.3), directly under the identity block because cultivation
       * *is* the disciple's identity — HP stays below at 8px.
       *
       * One bar per stage: it measures `cultivationProgress` within the current sub-realm and
       * resets at each one. Step 8 tried a bar spanning all nine sub-realms with stage marks;
       * it was reverted because the marks don't read at either size (§11). The caption carries
       * the position in the realm instead, which is what a player actually wants to know.
       */}
      <section className="disciple-cultivation">
        <div className="cultivation-stage-line">
          <span className="cultivation-realm-name">{disciple.realm}</span>
          <span className="cultivation-stage">{subRealmOrdinal(disciple.subRealm)} stage</span>
        </div>
        <div className="progress-bar hero">
          <div
            className={`progress-bar-fill ${readyForBreakthrough ? 'breakthrough' : 'cultivation'}`}
            style={{ width: `${disciple.cultivationProgress}%` }}
          />
        </div>
        <p className={`cultivation-caption${readyForBreakthrough ? ' ready' : ''}`}>
          {isFinalRealm && disciple.subRealm === 9
            ? 'Ninth stage · no realm lies beyond'
            : readyForBreakthrough
              ? `Peak of ${disciple.realm} — the realm gate stands open`
              : disciple.subRealm === 9
                ? `Final stage · ${Math.round(disciple.cultivationProgress)}% to the realm gate`
                : `Stage ${disciple.subRealm} of 9 · ${Math.round(disciple.cultivationProgress)}% to the next stage`}
        </p>
      </section>

      {(() => {
        const mult = getMoraleCultivationMultiplier(disciple.morale)
        const pct = Math.round((mult - 1) * 100)
        const effect = pct === 0 ? 'normal cultivation' : `cultivation ${pct > 0 ? '+' : ''}${pct}%`
        return (
          <p className="panel-hint">
            Morale {disciple.morale} &middot; {effect} &middot; Loyalty {disciple.loyalty}
          </p>
        )
      })()}

      <div className="disciple-hp">
        <div className="progress-bar">
          <div className={`progress-bar-fill ${isCritical ? 'hp-critical' : 'hp'}`} style={{ width: `${hpPct}%` }} />
        </div>
        <p className="panel-hint">
          HP {hpPct.toFixed(2)}%{isInjured && !isDownedNow ? ` · ${INJURY_LABEL[injurySeverity]}${Number.isFinite(msToFullHp) ? ` · recovers in ~${formatCountdown(msToFullHp)}` : ''}` : ''}
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
          {/* The risk in plain language above the action, never in a tooltip (§16.3). The
              numbers leave the button so the button can say one thing. */}
          <p className="breakthrough-risk">
            {breakthroughEligibility.cost} Qi Stone. {Math.round(breakthroughEligibility.successChance * 100)}% chance
            to succeed.
          </p>
          <p className={`breakthrough-risk-warning${isCritical ? ' grave' : ''}`}>
            {isCritical
              ? `If it fails: a major wound. At this condition it could kill ${disciple.name}.`
              : 'If it fails: a major wound, and the stage falls back.'}
          </p>
          <button
            className="primary breakthrough-ready"
            disabled={!breakthroughEligibility.canBreakthrough}
            onClick={onAttemptBreakthrough}
          >
            Attempt the breakthrough
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
          Pills
        </button>
        <button className={tab === 'techniques' ? 'active' : ''} onClick={() => setTab('techniques')}>
          Techniques
        </button>
      </div>

      {tab === 'equipment' && (
        <div className="equipment-section">
          {getActiveEquipmentSets(disciple).map(({ def, equippedCount }) => (
            <div className="equipment-set-banner" key={def.id}>
              <span className="equipment-set-name">
                {def.name} ({equippedCount}/{def.pieces.length})
              </span>
              <span className="equipment-set-bonuses">
                {def.bonuses
                  .map((b) => `${equippedCount >= b.count ? '✓ ' : ''}${describeSetBonus(b)}`)
                  .join(' · ')}
              </span>
              <span className="equipment-set-lore">{def.lore}</span>
            </div>
          ))}
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipped = disciple.equipment[slot]
            const equippedDef = equipped ? getItemDef(equipped.itemId) : undefined

            return (
              <button
                type="button"
                className="equipment-slot-row"
                key={slot}
                disabled={isAway}
                onClick={() => setPickerSlot(slot)}
              >
                <GameIcon
                  className={`equipment-slot-art ${equipped ? 'filled' : ''}`}
                  src={SLOT_ART[slot]}
                  alt=""
                  size={26}
                />
                <span className="equipment-slot-label">{SLOT_LABELS[slot]}</span>
                {equipped && equippedDef ? (
                  <span className="equipment-slot-item">
                    {equipped.forgedName ?? equippedDef.name}
                    {equipped.forgedName && <span className="inventory-subtitle"> — {equippedDef.name}</span>}
                    {equipped.quality && (
                      <span style={{ color: getItemQualityDef(equipped.quality).color }}>
                        {' '}&middot; {equipped.quality}
                      </span>
                    )}{' '}
                    (+{getEquipmentCombatPower(equipped.itemId, equipped.quality)} CP)
                    {equipped.affixes && equipped.affixes.length > 0 && (
                      <span className="equipment-slot-affixes"> · {equipped.affixes.map(describeAffix).join(' · ')}</span>
                    )}
                    <span className="equipment-slot-provenance">{describeProvenance(equipped)}</span>
                  </span>
                ) : (
                  <span className="panel-hint">Empty</span>
                )}
                <span className="equipment-slot-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            )
          })}

          {pickerSlot && (
            <EquipmentSlotPicker
              discipleId={disciple.id}
              slot={pickerSlot}
              slotLabel={SLOT_LABELS[pickerSlot]}
              options={equipOptionsForSlot(pickerSlot)}
              equipped={disciple.equipment[pickerSlot]}
              disabled={isAway}
              onClose={() => setPickerSlot(null)}
            />
          )}
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

      <div className="disciple-expel danger-zone">
        <p className="danger-zone-title">Danger zone</p>
        <button
          type="button"
          className="demolish-button quiet destructive"
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
