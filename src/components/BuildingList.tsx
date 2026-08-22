import { useLayoutEffect, useState } from 'react'
import {
  getAllBuildingDefs,
  SECT_HALL_ID,
  SPECIALIZATION_SLOT_COUNT,
} from '../game/data/buildingDefs'
import { getClaimedSpecializationCount } from '../game/engine/specializationSlots'
import { getUpgradeEligibility } from '../game/engine/upgradeEligibility'
import { computeSectRank } from '../game/engine/sectRank'
import { useGameStore } from '../game/state/store'
import { BuildingPlate } from './BuildingPlate'
import { ClaimRow, WorksRow } from './WorksRow'
import { BuildingDetailPanel } from './BuildingDetailPanel'
import { SpecializationSlotPicker } from './SpecializationSlotPicker'
import { BottomSheet } from './BottomSheet'

const CLAIM_SHEET_ID = '__claim'

/**
 * THE SECT'S WORKS LEDGER.
 *
 * The screen answers one question — what is being raised now, and what should be raised
 * next — and the layout is built from that sentence:
 *
 *   band · register · THE PLATE (always the Sect Hall) · the action · then the roll.
 *
 * Everything below is pure derivation over values the model already holds. No store action,
 * no new state, no save field.
 */
export function BuildingList() {
  const state = useGameStore((s) => s.state)
  const startUpgrade = useGameStore((s) => s.startUpgrade)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const hallLevel = state.buildings[SECT_HALL_ID]?.level ?? 1
  const rank = computeSectRank(hallLevel)
  const claimedCount = getClaimedSpecializationCount(state)
  const openSlots = Math.max(0, SPECIALIZATION_SLOT_COUNT - claimedCount)
  const eligibility = getUpgradeEligibility(state, SECT_HALL_ID)

  /*
   * THE QUEUE GETS ITS OWN RULE, at the top of the roll.
   *
   * This is the fix the whole redesign exists for: the sect has ONE construction queue, and
   * until now the running build lived inside a bottom sheet you could only reach by already
   * knowing which tile to tap. A player with work in progress opened Buildings and could not
   * see it.
   *
   * When the Hall itself is what's raising, this is undefined and the plate carries the bar
   * instead — so the news is never in two places at once.
   */
  const raisingId = Object.values(state.buildings).find(
    (b) => b.constructionEndsAt !== undefined && b.id !== SECT_HALL_ID,
  )?.id
  const raisingDurationMs = raisingId ? getUpgradeEligibility(state, raisingId).durationMs : undefined

  /*
   * THE ROLL — Core, then Specializations, level descending inside each.
   *
   * Grouping on `slotType` rather than on `def.category`: category splits a realistic
   * compound into five groups of one to three, so the rules would outnumber the rows (tried
   * on paper first, recorded as deviation 6). Core vs Specializations is two always-populated
   * groups, it is the terminology the screen already used, and the Specializations rule
   * carries the scarcity — 4 / 6 — exactly where the realm rule carries its count.
   *
   * The Hall is on the plate and the building being raised is in its own group, so neither
   * appears twice.
   */
  const inRoll = (id: string) => id !== SECT_HALL_ID && id !== raisingId && state.buildings[id] !== undefined
  const byLevelDesc = (a: string, b: string) =>
    (state.buildings[b]?.level ?? 0) - (state.buildings[a]?.level ?? 0)

  const groups = (['core', 'specialization'] as const).map((slotType) => ({
    slotType,
    title: slotType === 'core' ? 'Core' : 'Specializations',
    count:
      slotType === 'core'
        ? undefined
        : `${claimedCount} / ${SPECIALIZATION_SLOT_COUNT}`,
    members: getAllBuildingDefs()
      .filter((def) => def.slotType === slotType)
      .map((def) => def.id)
      .filter(inRoll)
      .sort(byLevelDesc),
  }))

  // If the open building gets demolished while its sheet is up, close the sheet instead of
  // leaving it over now-empty content.
  useLayoutEffect(() => {
    if (selectedId && selectedId !== CLAIM_SHEET_ID && !state.buildings[selectedId]) {
      setSelectedId(null)
    }
  }, [selectedId, state.buildings])

  const closeSheet = () => setSelectedId(null)

  return (
    <section className="panel building-list-panel">
      {/* The band (asset C4/E) with its empty centre third — the screen announces itself
          rather than opening with a left-aligned h2 over a stack of grey hints. */}
      <div className="roster-titlebar">
        <h2>Buildings</h2>
      </div>

      {/*
       * THE REGISTER. The rank, the level ceiling and the slot count as two quiet lines on
       * the ground — a colophon, not a box in the position of highest attention. The old
       * `panel-hint` about the single queue is folded into the second line, because it is an
       * administrative fact and not the screen's opening statement.
       */}
      <div className="roster-register">
        <p className="roster-register-line">
          Sect Rank <span className="roster-register-value">{rank.name}</span> &middot; No building may pass Level{' '}
          <span className="roster-register-value">{rank.levelCap}</span>
          {rank.nextRankAtHallLevel !== undefined && ` · Next rank at Sect Hall ${rank.nextRankAtHallLevel}.`}
        </p>
        <p className="roster-register-line">
          Specialization slots{' '}
          <span className="roster-register-value">
            {claimedCount} / {SPECIALIZATION_SLOT_COUNT}
          </span>{' '}
          claimed &middot; One upgrade may run at a time.
        </p>
      </div>

      <BuildingPlate onSelect={setSelectedId} />

      {/* §7's one primary per screen. The cost is on the plate above, so the button says one
          thing; the reason it can't be pressed goes underneath it in plain language. */}
      <button
        className="roster-action primary"
        disabled={!eligibility.canUpgrade}
        onClick={() => startUpgrade(SECT_HALL_ID)}
      >
        Upgrade to Lv{eligibility.targetLevel}
      </button>
      {!eligibility.canUpgrade && eligibility.reason && (
        <p className="roster-register-line works-blocked">{eligibility.reason}</p>
      )}

      {raisingId && (
        <div className="realm-group">
          <div className="realm-rule">
            <span className="realm-rule-name">Under construction</span>
            <span className="realm-rule-count">1</span>
          </div>
          <WorksRow buildingId={raisingId} onSelect={setSelectedId} raising durationMs={raisingDurationMs} />
        </div>
      )}

      {groups.map((group) => (
        <div className="realm-group" key={group.slotType}>
          <div className="realm-rule">
            <span className="realm-rule-name">{group.title}</span>
            <span className="realm-rule-count">{group.count ?? group.members.length}</span>
          </div>
          {group.members.map((id) => (
            <WorksRow key={id} buildingId={id} onSelect={setSelectedId} />
          ))}
          {group.slotType === 'specialization' && openSlots > 0 && (
            <ClaimRow open={openSlots} onSelect={() => setSelectedId(CLAIM_SHEET_ID)} />
          )}
        </div>
      ))}

      {/*
       * `parchment leaf` — the same two classes `DiscipleDetailModal` passes. `.parchment` is
       * the token ladder, which reaches a portalled panel because custom properties inherit
       * from the element that declares them and `createPortal` does not change that (§12).
       * `.leaf` is the material plus the dark→paper remap, which is what keeps
       * `SpecializationSlotPicker` — not yet converted — resolving to paper values inside it.
       */}
      <BottomSheet open={selectedId !== null} onClose={closeSheet} height="full" panelClassName="parchment leaf">
        {selectedId === CLAIM_SHEET_ID && <SpecializationSlotPicker onClaimed={closeSheet} />}
        {selectedId && selectedId !== CLAIM_SHEET_ID && state.buildings[selectedId] && (
          <BuildingDetailPanel buildingId={selectedId} />
        )}
      </BottomSheet>
    </section>
  )
}
