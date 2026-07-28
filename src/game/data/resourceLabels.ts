import type { Resources } from '../types'

export const RESOURCE_LABELS: Record<keyof Resources, string> = {
  spiritStones: 'Spirit Stones',
  qiStone: 'Qi Stone',
  spiritWood: 'Spirit Wood',
  ironEssence: 'Iron Essence',
  spiritHerb: 'Spirit Herb',
  knowledge: 'Knowledge',
}

export const RESOURCE_ICONS: Record<keyof Resources, string> = {
  spiritStones: '💰',
  qiStone: '💠',
  spiritWood: '🌲',
  ironEssence: '⛏️',
  spiritHerb: '🌿',
  knowledge: '📚',
}
