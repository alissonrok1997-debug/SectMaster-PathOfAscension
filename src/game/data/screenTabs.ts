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
  icon: string
}

export const SCREEN_TABS: ScreenTab[] = [
  { id: 'sect', label: 'Sect', icon: '🏯' },
  { id: 'buildings', label: 'Buildings', icon: '🏗️' },
  { id: 'disciples', label: 'Disciples', icon: '🧘' },
  { id: 'missions', label: 'Missions', icon: '🗺️' },
  { id: 'workshop', label: 'Workshop', icon: '⚒️' },
  { id: 'research', label: 'Research', icon: '📜' },
  { id: 'world', label: 'World', icon: '🌏' },
  { id: 'reports', label: 'Reports', icon: '📨' },
  { id: 'system', label: 'System', icon: '⚙️' },
]

export const DEFAULT_SCREEN_TAB: ScreenTabId = 'sect'
