/** Small wuxia-flavored name pool for recruits — flavor only, no gameplay effect. */
const GIVEN_NAMES = [
  'Wei',
  'Xiu',
  'Feng',
  'Lian',
  'Hao',
  'Mei',
  'Jian',
  'Yun',
  'Rui',
  'Chen',
  'Xin',
  'Bo',
  'Qing',
  'Ling',
  'Tao',
]

const FAMILY_NAMES = ['Li', 'Zhao', 'Chen', 'Wang', 'Zhou', 'Sun', 'Han', 'Yang', 'Song', 'Xu']

export function generateDiscipleName(): string {
  const family = FAMILY_NAMES[Math.floor(Math.random() * FAMILY_NAMES.length)]
  const given = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)]
  return `${family} ${given}`
}
