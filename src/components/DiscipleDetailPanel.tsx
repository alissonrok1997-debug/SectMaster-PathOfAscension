import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getBuildingDef } from '../game/data/buildingDefs'
import { getBoostEligibility } from '../game/engine/cultivationBoost'
import { getMoraleCultivationMultiplier, isReadyForBreakthrough } from '../game/engine/cultivation'
import { getExpelEligibility } from '../game/engine/recruitment'
import { getDiscoveredTechniques, getTeachEligibility } from '../game/engine/techniques'
import { getTechniqueDef } from '../game/data/techniqueDefs'
import { EQUIPMENT_SLOTS } from '../game/engine/equipment'
import { SLOT_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import { EquipmentSlotPicker } from './EquipmentSlotPicker'
import { AssignBuildingPicker } from './AssignBuildingPicker'
import { UiIcon } from './UiIcon'
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
import { DiscipleIdentity, subRealmOrdinal } from './DisciplePortrait'
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
  const activateCultivationBoost = useGameStore((s) => s.activateCultivationBoost)
  const useConsumable = useGameStore((s) => s.useConsumable)
  const teachTechnique = useGameStore((s) => s.teachTechnique)
  const expelDisciple = useGameStore((s) => s.expelDisciple)

  const [tab, setTab] = useState<DetailTab>('equipment')
  const [pickerSlot, setPickerSlot] = useState<EquipmentSlotId | null>(null)
  const [postingOpen, setPostingOpen] = useState(false)

  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return null

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

  // Combat Power only changes on discrete events (equip, breakthrough, technique, injury),
  // so it needs no threshold — any movement of a whole point is worth acknowledging.
  const combatPower = getDiscipleCombatPower(disciple, getDoctrineModifiers(state).combatPowerMult)
  const cpFlash = useValueFlash({ cp: combatPower }, () => 1)

  const canUseHealing = healingPillStock > 0 && disciple.health < effectiveMaxHp
  const canUseQi = qiPillStock > 0 && !isAway && !isFinalRealm

  return (
    <div className="disciple-detail">
      {/*
       * THE PLATE (§8). The same component the roster's hero card renders, at the same
       * 118x151 portrait and the same 1.95rem name — so tapping a card opens a larger version
       * of the object you tapped rather than a differently-proportioned header.
       *
       * `.disciple-card plate` is worn for the type scale and the grade wash only; inside the
       * leaf the card's border, ring and fill are subtracted, because the sheet is already
       * paper and a bordered card on it would be a box inside a box (§4).
       */}
      <div className={`disciple-card plate grade-${disciple.grade.toLowerCase()}`}>
        <DiscipleIdentity
          disciple={disciple}
          combatPower={combatPower}
          cpClassName={cpFlash.cp ?? ''}
          alwaysShowGrade
        />
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
          {/* The bar carries its own number (§11), the same way every bar on the roster does.
              The caption below still carries the sentence — §11's third lesson is that the
              sentence outperforms marks, and the number and the sentence say different things. */}
          <span className="bar-pct">{Math.round(disciple.cultivationProgress)}%</span>
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

      {/*
       * THE STANDING. Three facts that used to be three separate grey sentences — morale and
       * loyalty in one `.panel-hint`, HP in another beneath its own full-height bar, and the
       * injury clause buried inside that one. A register is read at a glance; three sentences
       * have to be read.
       *
       * Nothing is dropped. The clauses that only sometimes apply — the injury, the recovery
       * estimate, the morale effect — move to the single note line below, where the roster
       * card already puts its qualifiers.
       */}
      {(() => {
        const mult = getMoraleCultivationMultiplier(disciple.morale)
        const pct = Math.round((mult - 1) * 100)
        const effect = pct === 0 ? 'normal cultivation' : `cultivation ${pct > 0 ? '+' : ''}${pct}%`
        const showInjury = isInjured && !isDownedNow
        const recovery = showInjury && Number.isFinite(msToFullHp) ? `recovers in ~${formatCountdown(msToFullHp)}` : null
        const notes = [showInjury ? INJURY_LABEL[injurySeverity] : null, recovery, effect].filter(Boolean)

        return (
          <>
            <div className="leaf-standing">
              <div className="leaf-stat">
                <span className="leaf-stat-label">Condition</span>
                {/* Whole percent. `toFixed(2)` reads as instrument noise in a slot sized for a
                    glanceable value; the bar carries the proportion. */}
                <span className={`leaf-stat-value${isCritical ? ' bad' : ''}`}>{Math.round(hpPct)}%</span>
                {/*
                 * Inside the Condition cell, not spanning the register. Rendered full width
                 * beneath all three columns it read as a divider under the whole row — a bar
                 * under three numbers implies it measures three numbers. In the cell it is
                 * unambiguously bound to the one it belongs to, and a third of the column is
                 * still long enough to read a proportion from.
                 *
                 * Shown only below 99.5% (§11): a full bar carries no information.
                 */}
                {hpPct < 99.5 && (
                  <div className="progress-bar disciple-row-bar condition">
                    <div
                      className={`progress-bar-fill ${isCritical ? 'hp-critical' : 'hp'}`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="leaf-stat">
                <span className="leaf-stat-label">Morale</span>
                <span className="leaf-stat-value">{disciple.morale}</span>
              </div>
              <div className="leaf-stat">
                <span className="leaf-stat-label">Loyalty</span>
                <span className="leaf-stat-value">{disciple.loyalty}</span>
              </div>
            </div>

            <p className="leaf-standing-note">{notes.join(' · ')}</p>
          </>
        )
      })()}

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
        /*
         * POSTING. Was a native <select>, the most jarring control on a hand-inked parchment
         * sheet and the last one on this screen (two remain in `ProvinceDetailView`, which is
         * un-migrated). It is now the same row-plus-picker shape `EquipmentSlotPicker` already
         * established, so the leaf has one vocabulary for "tap to change a slot", not two.
         *
         * No building glyph: `buildings/trainingGround.png` and its thirteen siblings are
         * full-colour isometric dioramas on floating rock, which at 28px beside flat pine-ink
         * slot glyphs read as an object from a different game. The name in the display face
         * was the information; the icon was decoration.
         */
        <>
          <button type="button" className="leaf-row" onClick={() => setPostingOpen(true)}>
            <span className="leaf-row-text">
              <span className="leaf-row-label">Posting</span>
              <span className="leaf-row-value">
                {disciple.assignedBuildingId ? getBuildingDef(disciple.assignedBuildingId).name : 'Idle / Rest'}
              </span>
            </span>
            <UiIcon name="chevron" className="leaf-row-chevron" />
          </button>

          {postingOpen && (
            <AssignBuildingPicker discipleId={disciple.id} onClose={() => setPostingOpen(false)} />
          )}
        </>
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

      {/*
       * §9 codifies ONE sub-navigation control game-wide, and this strip was the last holdout
       * — recorded as debt in §9, in §19's "known debt", and in DISCIPLES_SCREEN_BUILD. It was
       * deferred twice because converting it inside a World-map step would have widened that
       * step for zero World gain. This is the step it belongs to.
       */}
      <div className="segmented">
        {(
          [
            ['equipment', 'Equipment'],
            ['consumables', 'Pills'],
            ['techniques', 'Techniques'],
          ] as [DetailTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`segmented-item${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'equipment' && (
        <div className="equipment-section">
          {getActiveEquipmentSets(disciple).map(({ def, equippedCount }) => (
            <div className="leaf-set" key={def.id}>
              <span className="leaf-set-name">
                {def.name} ({equippedCount}/{def.pieces.length})
              </span>
              <span className="leaf-set-bonuses">
                {def.bonuses
                  .map((b) => `${equippedCount >= b.count ? '✓ ' : ''}${describeSetBonus(b)}`)
                  .join(' · ')}
              </span>
              <span className="leaf-set-lore">{def.lore}</span>
            </div>
          ))}
          {/*
           * `.leaf-slot`, NOT `.equipment-slot-row`. The shared rule that styles that class
           * sets `--edge: transparent` on it, which shadows the parchment card edge for the
           * whole subtree — measured before this step, not guessed. It also drags in a 3px
           * left stripe (the dark screens' state channel, replaced on paper by the gold ring,
           * §6) and `background: var(--bg)`. And `.equipment-slot-item` is `--positive`, which
           * §2.1 forbids on paper outright.
           *
           * The anatomy also changes. Everything used to run together on one wrapping line —
           * name, quality, CP, affixes, provenance — so a Masterwork sword with two affixes
           * wrapped to four lines of undifferentiated text. Now the slot is a label, the item
           * and its quality are the line that matters, the CP delta is a right-aligned number
           * in gold, and affixes and provenance share one quiet line beneath.
           */}
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipped = disciple.equipment[slot]
            const equippedDef = equipped ? getItemDef(equipped.itemId) : undefined
            const affixes = equipped?.affixes?.length ? equipped.affixes.map(describeAffix).join(' · ') : null
            const sub = equipped ? [affixes, describeProvenance(equipped)].filter(Boolean).join(' · ') : null

            return (
              <button
                type="button"
                className="leaf-slot"
                key={slot}
                disabled={isAway}
                onClick={() => setPickerSlot(slot)}
              >
                <GameIcon
                  className={`leaf-slot-art${equipped ? '' : ' empty'}`}
                  src={SLOT_ART[slot]}
                  alt=""
                  size={28}
                />

                <span className="leaf-slot-text">
                  <span className="leaf-slot-label">{SLOT_LABELS[slot]}</span>
                  {equipped && equippedDef ? (
                    <>
                      <span className="leaf-slot-name">
                        {equipped.forgedName ?? equippedDef.name}
                        {equipped.forgedName && <span className="leaf-slot-base"> — {equippedDef.name}</span>}
                        {equipped.quality && (
                          <span style={{ color: getItemQualityDef(equipped.quality).color }}>
                            {' '}&middot; {equipped.quality}
                          </span>
                        )}
                      </span>
                      {sub && <span className="leaf-slot-sub">{sub}</span>}
                    </>
                  ) : (
                    <span className="leaf-slot-name empty">Empty</span>
                  )}
                </span>

                {equipped && (
                  <span className="leaf-slot-cp">+{getEquipmentCombatPower(equipped.itemId, equipped.quality)}</span>
                )}
                <UiIcon name="chevron" className="leaf-row-chevron" />
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
              /* Same row vocabulary as the equipment slots — one shape for "a thing with an
                 action", instead of a dark box sitting in a tab whose siblings are clean. */
              <div className="leaf-slot leaf-slot-static" key={technique.id}>
                <span className="leaf-slot-text">
                  <span className="leaf-slot-name">{technique.name}</span>
                  {!eligibility.canTeach && eligibility.reason && (
                    <span className="leaf-slot-sub">{eligibility.reason}</span>
                  )}
                </span>
                <button
                  type="button"
                  className="leaf-slot-action"
                  disabled={!eligibility.canTeach}
                  onClick={() => teachTechnique(disciple.id, technique.id)}
                >
                  Teach
                </button>
              </div>
            )
          })}
          {knownTechniqueDefs.length === 0 && !isLearning && teachableTechniques.length === 0 && (
            <p className="panel-hint">No techniques discovered yet — research unlocks them.</p>
          )}
        </div>
      )}

      {/*
       * Expel is not a feature. It was a "Danger zone" heading over a full-width destructive
       * button — §7's quiet tier exists precisely so a rarely-used, irreversible action can
       * sit at the foot without competing with the sheet's real content. The confirm stays:
       * replacing `window.confirm` would be a second overlay pattern (§12).
       */}
      <div className="disciple-expel">
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
