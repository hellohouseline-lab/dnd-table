import { beforeAll, describe, expect, it } from 'vitest'
import { BITS } from './bits.ts'
import { DEFAULT_BOXES, openBox, parseBoxSettings, partyLevel, rarityCap, rerollFind, type BoxAsk } from './boxes.ts'
import { buildCatalogue, type Entry } from './catalogue.ts'
import { walletCopper } from './money.ts'
import { loadEquipment, loadMagicItems } from './srd/index.ts'

let entries: Entry[]
beforeAll(async () => {
  entries = buildCatalogue({ magic: await loadMagicItems(), equipment: await loadEquipment(), bits: BITS, yours: [] })
})

/** The same rolls every time. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const ask: BoxAsk = { container: 'chest', richness: 'valuable', level: 3, search: 'none' }
const rank = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary']

describe('opening a box', () => {
  it('caps magic items by the party level', () => {
    expect([1, 4, 5, 10, 11, 17].map(rarityCap)).toEqual([
      'Uncommon',
      'Uncommon',
      'Rare',
      'Rare',
      'Very Rare',
      'Legendary',
    ])
    expect(partyLevel([2, 3, 3, 4])).toBe(3)
    expect(partyLevel([])).toBe(1)
    for (let seed = 1; seed < 60; seed++) {
      const box = openBox(entries, { ...ask, richness: 'treasure' }, DEFAULT_BOXES, seeded(seed))
      for (const f of box.finds.filter((f) => f.entry.source === 'magic')) {
        expect(rank.indexOf(f.entry.rarity ?? '')).toBeLessThanOrEqual(1)
      }
    }
  })

  it('fills each richness as the settings say', () => {
    const rand = seeded(7)
    const junk = openBox(entries, { ...ask, richness: 'junk' }, DEFAULT_BOXES, rand)
    expect(junk.finds.every((f) => f.entry.source !== 'magic')).toBe(true)
    expect(walletCopper(junk.coins)).toBeLessThanOrEqual(20)
    const valuable = openBox(entries, ask, DEFAULT_BOXES, rand)
    expect(valuable.finds.filter((f) => f.entry.source === 'magic')).toHaveLength(1)
    expect(walletCopper(valuable.coins)).toBeGreaterThanOrEqual(1000)
    const hoard = openBox(entries, { ...ask, container: 'hoard', richness: 'treasure' }, DEFAULT_BOXES, rand)
    expect(walletCopper(hoard.coins)).toBeGreaterThanOrEqual(10000)
  })

  it('lets the search roll trim or add', () => {
    const low = openBox(entries, { ...ask, search: 'low' }, DEFAULT_BOXES, seeded(3))
    expect(low.finds.every((f) => f.entry.source === 'bits')).toBe(true)
    expect(walletCopper(low.coins)).toBe(0)
    const fair = openBox(entries, { ...ask, search: 'fair' }, DEFAULT_BOXES, seeded(3))
    expect(walletCopper(fair.coins)).toBe(0)
    const plain = openBox(entries, ask, DEFAULT_BOXES, seeded(3))
    const great = openBox(entries, { ...ask, search: 'great' }, DEFAULT_BOXES, seeded(3))
    const things = (b: typeof plain) => b.finds.reduce((n, f) => n + (f.entry.source === 'bits' ? 0 : 1), 0)
    expect(things(great)).toBeGreaterThanOrEqual(things(plain))
  })

  it('pairs a +1 with a real weapon or armour, and rerolls like for like', () => {
    let found = false
    for (let seed = 1; seed < 400 && !found; seed++) {
      const box = openBox(entries, { ...ask, richness: 'treasure', level: 11 }, DEFAULT_BOXES, seeded(seed))
      const plus = box.finds.find((f) => f.entry.gift.kind === 'magic' && f.entry.gift.magic.bonus)
      if (plus && plus.entry.gift.kind === 'magic') {
        expect(plus.entry.gift.base).not.toBeNull()
        expect(plus.entry.name).toMatch(/ \+\d$/)
        found = true
      }
    }
    expect(found).toBe(true)
    const box = openBox(entries, ask, DEFAULT_BOXES, seeded(9))
    const magic = box.finds.find((f) => f.entry.source === 'magic')!
    const again = rerollFind(entries, ask, magic, seeded(10))
    expect(again.entry.source).toBe('magic')
    expect(again.entry.key).not.toBe(magic.entry.key)
  })

  it('reads saved settings, keeping the defaults for anything odd', () => {
    const read = parseBoxSettings({ junk: { bits: [5, 1], gold: 'lots' }, treasure: { magic: [4, 4] } })
    expect(read.junk.bits).toEqual([1, 5])
    expect(read.junk.gold).toEqual(DEFAULT_BOXES.junk.gold)
    expect(read.treasure.magic).toEqual([4, 4])
    expect(parseBoxSettings(null)).toEqual(DEFAULT_BOXES)
  })
})
