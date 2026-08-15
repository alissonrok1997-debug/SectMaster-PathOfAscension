export type ScreenTabId =
  | 'sect'
  | 'buildings'
  | 'disciples'
  | 'missions'
  | 'workshop'
  | 'research'
  | 'world'
  | 'reports'
  | 'system'

export interface ScreenTab {
  id: ScreenTabId
  label: string
}

/**
 * Order only — no icon field. Tab glyphs are inline SVG keyed on `id` in `UiIcon`
 * (GAME_UI_DESIGN_SYSTEM §15: UI chrome is never emoji, and JSX can't live in a data file).
 */
export const SCREEN_TABS: ScreenTab[] = [
  { id: 'sect', label: 'Sect' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'disciples', label: 'Disciples' },
  { id: 'missions', label: 'Missions' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'research', label: 'Doctrine' },
  { id: 'world', label: 'World' },
  { id: 'reports', label: 'Dispatches' },
  { id: 'system', label: 'System' },
]

export const DEFAULT_SCREEN_TAB: ScreenTabId = 'sect'
