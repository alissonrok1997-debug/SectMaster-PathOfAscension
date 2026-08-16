import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { computeDiscipleCapacity } from '../game/engine/discipleCapacity'
import { getBreakthroughAllSummary, isReadyForBreakthrough } from '../game/engine/cultivation'
import { isDowned } from '../game/engine/downed'
import { publishBreakthroughMoment } from './breakthroughChannel'
import { getEffectiveRecruitmentCost } from '../game/engine/recruitment'
import { getSectUpkeepPerCycle, isUpkeepAffordable } from '../game/engine/upkeep'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import { CULTIVATION_REALMS } from '../game/types'
import { DiscipleCard } from './DiscipleCard'
import { DiscipleDetailModal } from './DiscipleDetailModal'

export function DiscipleRoster() {
  const state = useGameStore((s) => s.state)
  const recruitDisciple = useGameStore((s) => s.recruitDisciple)
  const attemptBreakthroughAll = useGameStore((s) => s.attemptBreakthroughAll)
  const [openDiscipleId, setOpenDiscipleId] = useState<string | null>(null)

  const capacity = computeDiscipleCapacity(state.buildings)
  const cost = getEffectiveRecruitmentCost(state)
  const atCapacity = state.disciples.length >= capacity
  const canAfford = state.resources.spiritStones >= cost
  const upkeep = getSectUpkeepPerCycle(state)
  const upkeepAffordable = isUpkeepAffordable(state)
  const nextUpkeepIn = formatDurationAdaptive(Math.max(0, state.nextUpkeepAt - Date.now()) / 1000)
  const breakthroughAll = getBreakthroughAllSummary(state)

  /*
   * §3's "one thing". The plate goes to whoever is *demanding action* — a disciple ready to
   * break through — and falls back to the head of the talent sort, so it is never empty and
   * it turns gold exactly when the game's biggest moment is available. Pure selection over
   * values that already exist: no new state, no store, no save field.
   */
  const sorted = [...state.disciples].sort((a, b) => b.talent - a.talent)
  const hero = sorted.find(isReadyForBreakthrough) ?? sorted[0]

  /*
   * THE ROLL. Everyone who isn't on the plate is grouped by realm, highest realm first, and
   * sorted by sub-realm inside each group so whoever is nearest the gate rises to the top of
   * their block.
   *
   * A person's realm *is* their rank in a cultivation world, so grouping on it turns an
   * invisible talent sort into a picture of the sect's spiritual altitude — and it lets the
   * cards drop the realm name entirely and carry only the stage ordinal.
   *
   * Pure derivation over `CULTIVATION_REALMS` and fields the model already holds: no store
   * wiring, no new state, no save field.
   */
  const rest = hero ? sorted.filter((d) => d.id !== hero.id) : sorted
  const groups = [...CULTIVATION_REALMS]
    .reverse()
    .map((realm) => ({
      realm,
      members: rest.filter((d) => d.realm === realm).sort((a, b) => b.subRealm - a.subRealm),
    }))
    .filter((group) => group.members.length > 0)

  /*
   * A batch of breakthroughs resolves several disciples independently, so it gets the tally
   * moment rather than the bloom — a single verdict over mixed outcomes would be a lie
   * (§16.3). Same snapshot-then-compare trick as the single attempt, and a disciple missing
   * from the post-action roster means they died.
   */
  const onBreakthroughAll = () => {
    const before = state.disciples.filter((d) => isReadyForBreakthrough(d)).map((d) => ({ id: d.id, name: d.name, realm: d.realm }))
    attemptBreakthroughAll()
    const now = Date.now()
    const after = useGameStore.getState().state.disciples
    publishBreakthroughMoment({
      kind: 'tally',
      results: before.map((b) => {
        const d = after.find((x) => x.id === b.id)
        if (!d) return { name: b.name, consequence: 'death' as const }
        if (d.realm !== b.realm) return { name: d.name, realm: d.realm }
        return { name: d.name, consequence: isDowned(d, now) ? ('downed' as const) : ('wound' as const) }
      }),
    })
  }

  /*
   * THE ON-SCREEN ORDER — the plate, then each realm group top to bottom. The detail sheet's
   * prev/next steps this, so the arrows follow what the player can actually see.
   *
   * `DiscipleDetailModal` used to re-sort by talent, which was right until the roll was
   * grouped by realm and then quietly was not: `›` from the plate could land anywhere. Pure
   * derivation over values computed just above; no store, no state, no save field.
   */
  const order = [...(hero ? [hero.id] : []), ...groups.flatMap((g) => g.members.map((d) => d.id))]

  return (
    <section className="panel disciple-roster-panel">
      {/* Title over the ornamental band (asset C4/E), whose centre third is empty by design.
          The screen announces itself instead of opening with a left-aligned h2 and a stack
          of grey hints. */}
      <div className="roster-titlebar">
        <h2>Disciples</h2>
      </div>

      {/*
       * THE REGISTER. The same administrative facts the ledger card carried, demoted to two
       * quiet lines on the ground — a colophon under the title rather than a dark box in the
       * position of highest attention. Nothing was dropped; the plate now opens the screen.
       */}
      <div className="roster-register">
        <p className="roster-register-line">
          Sect Disciples{' '}
          <span className="roster-register-value">
            {state.disciples.length} / {capacity}
          </span>
          {atCapacity && ' · full'} &middot; Capacity is set by the Dormitory level.
        </p>
        {state.disciples.length > 0 && (
          <p className="roster-register-line">
            Hourly Upkeep {Math.round(upkeep.spiritStones)} Spirit Stone &middot; {Math.round(upkeep.qiStone)} Qi Stone
            &middot; Next levy in {nextUpkeepIn}.
          </p>
        )}
        {!upkeepAffordable && state.disciples.length > 0 && (
          <p className="roster-register-warn">Can't afford the next upkeep — morale will drop.</p>
        )}
      </div>

      {state.disciples.length === 0 ? (
        <p className="roster-empty">No disciples yet. Recruit one to start filling the sect.</p>
      ) : (
        <>
          {hero && <DiscipleCard key={hero.id} discipleId={hero.id} hero onSelect={setOpenDiscipleId} />}

          {/* The batch action sits under the plate, attached to the moment it belongs to,
              rather than inside the administrative block it used to live in. */}
          {breakthroughAll.readyCount > 0 && (
            <>
              <button
                className="roster-action primary"
                disabled={!breakthroughAll.canAffordAll}
                onClick={onBreakthroughAll}
              >
                Break through all ({breakthroughAll.readyCount} ready &middot; {breakthroughAll.totalCost} Qi Stone)
              </button>
              {!breakthroughAll.canAffordAll && (
                <p className="roster-register-warn">
                  Need {breakthroughAll.totalCost} Qi Stone for all {breakthroughAll.readyCount} ready disciple
                  {breakthroughAll.readyCount > 1 ? 's' : ''}.
                </p>
              )}
            </>
          )}

          {groups.map((group) => (
            <div className="realm-group" key={group.realm}>
              <div className="realm-rule">
                <span className="realm-rule-name">{group.realm}</span>
                <span className="realm-rule-count">{group.members.length}</span>
              </div>
              <div className="disciple-grid">
                {group.members.map((d) => (
                  <DiscipleCard key={d.id} discipleId={d.id} onSelect={setOpenDiscipleId} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/*
       * "Add another" belongs at the end of the list it adds to — but OUTSIDE the empty
       * check, or a new sect has an empty roster and no way to fill it.
       *
       * The foot is `position: sticky`, not fixed: it rides just above the tab bar while
       * there is roll left to scroll, and settles into its natural place at the end of the
       * list. A third fixed bar would cost 44px of the ~600px between the two real ones
       * (§1.6) on every screen state, including the short ones where the button is already
       * visible; sticky costs nothing until the roster is long enough to need it.
       */}
      <div className="roster-foot">
        <button className="roster-action" disabled={atCapacity || !canAfford} onClick={recruitDisciple}>
          Recruit Disciple ({cost} Spirit Stones)
        </button>
      </div>

      {openDiscipleId && (
        <DiscipleDetailModal
          initialDiscipleId={openDiscipleId}
          order={order}
          onClose={() => setOpenDiscipleId(null)}
        />
      )}
    </section>
  )
}
