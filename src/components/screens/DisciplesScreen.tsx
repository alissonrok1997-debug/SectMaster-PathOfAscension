import { DiscipleRoster } from '../DiscipleRoster'

/**
 * PILOT — the parchment surface language, scoped to this screen only (OMA, 2026-08-12).
 *
 * Everything inside inverts the game's ground: light cards on a deep green ground instead of
 * dark cards on near-black. It deliberately contradicts step 3's de-boxing and §2.2's
 * "accents are strokes, never fills" — see §23. It is contained here on purpose, so the other
 * eight screens are untouched while OMA decides whether it rolls out.
 *
 * TWO CLASSES, TWO JOBS (2026-08-15):
 *
 *   .parchment            the token ladder, and nothing else. Every rule in App.css's
 *                         PARCHMENT section is a descendant of THIS class, so anything that
 *                         carries it gets the surface — including a `BottomSheet` portalled
 *                         to <body>, which no descendant selector of the wrapper below can
 *                         ever reach. That is the whole reason for the split, and it is why
 *                         the detail sheet does not need the tokens in `:root` (§12/§19 both
 *                         claim it does; measured, it does not).
 *
 *   .disciples-parchment  layout only — the negative margin, the padding, and the green
 *                         ground with its misted peaks. Roster-only and deliberately NOT
 *                         generalised: §19 rules the scenery non-portable, and peaks behind
 *                         a bottom sheet would be nonsense.
 *
 * Deleting both classes still reverts the screen completely.
 */
export function DisciplesScreen() {
  return (
    <div className="parchment disciples-parchment">
      <DiscipleRoster />
    </div>
  )
}
