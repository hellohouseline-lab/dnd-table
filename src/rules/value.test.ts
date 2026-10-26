import { beforeAll, describe, expect, it } from 'vitest'
import { marketValue, priceVerdict, valueWords } from './value.ts'
import { loadEquipment, loadMagicItems, type SrdEquipment, type SrdMagicItem } from './srd/index.ts'

let equipment: SrdEquipment
let magic: SrdMagicItem[]
beforeAll(async () => {
  equipment = await loadEquipment()
  magic = await loadMagicItems()
})

describe('market value', () => {
  it('knows book prices, bits and bobs, and a guide for magic', () => {
    expect(valueWords(marketValue({ item: 'longsword' }, equipment, magic))).toBe('15 gp')
    expect(valueWords(marketValue({ item: 'arrow' }, equipment, magic), 20)).toBe('1 gp')
    expect(valueWords(marketValue({ item: 'bits-silver-ring' }, equipment, magic))).toBe('10 gp')
    expect(marketValue({ item: 'bits-bent-spoon' }, equipment, magic)).toBeNull()
    expect(valueWords(marketValue({ item: null, magic: 'cloak-of-protection' }, equipment, magic))).toBe(
      'about 100 gp to 500 gp',
    )
    expect(valueWords(marketValue({ item: 'longsword', magic: 'weapon-1', bonus: 1 }, equipment, magic))).toBe(
      'about 115 gp to 515 gp',
    )
    expect(valueWords(marketValue({ item: null, magic: 'potion-of-healing-common' }, equipment, magic))).toBe('50 gp')
    expect(marketValue({ item: null }, equipment, magic)).toBeNull()
  })

  it('says whether a price is cheap, fair or pricey', () => {
    const sword = marketValue({ item: 'longsword' }, equipment, magic)
    expect([priceVerdict(1000, sword), priceVerdict(1500, sword), priceVerdict(2500, sword)]).toEqual([
      'cheap',
      'fair',
      'pricey',
    ])
    const cloak = marketValue({ item: null, magic: 'cloak-of-protection' }, equipment, magic)
    expect([priceVerdict(5000, cloak), priceVerdict(30000, cloak), priceVerdict(80000, cloak)]).toEqual([
      'cheap',
      'fair',
      'pricey',
    ])
    expect(priceVerdict(100, null)).toBeNull()
  })
})
