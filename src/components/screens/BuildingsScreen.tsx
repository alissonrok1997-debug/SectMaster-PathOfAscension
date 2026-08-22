import { BuildingList } from '../BuildingList'

/**
 * The second parchment screen (§22 step 19) — the one that proves the plate generalises off
 * a roster, before step 20 graduates the tokens to `:root` across all nine screens.
 *
 * TWO CLASSES, TWO JOBS — the same split `DisciplesScreen` uses, and for the same reason:
 *
 *   .parchment           the token ladder and nothing else, so anything carrying this class
 *                        gets the surface — including a portalled `BottomSheet`, which no
 *                        descendant selector of the wrapper could ever reach.
 *
 *   .buildings-parchment layout only — the negative margin, the padding, and the ground.
 *
 * NO SCENERY, deliberately. `.disciples-parchment` puts misted peaks behind its roster;
 * §19 rules that scenery non-portable, and §20 allows one atmospheric layer per screen
 * *composed for where the holes are*. With opaque cream rows filling the column there are no
 * holes — a ground here would be ~90% hidden and would only lower the contrast of the text
 * sitting on it. So this class has no `::before` at all, which also means none of the
 * fixed-position traps that cost a day on Disciples.
 */
export function BuildingsScreen() {
  return (
    <div className="parchment buildings-parchment">
      <BuildingList />
    </div>
  )
}
