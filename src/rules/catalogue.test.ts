import { beforeAll, describe, expect, it } from 'vitest'
import { BITS } from './bits.ts'
import { buildCatalogue, filterCatalogue, magicType, type DmItem, type Entry } from './catalogue.ts'
import { giftItem } from './magic.ts'
import { loadEquipment, loadMagicItems, type SrdMagicItem } from './srd/index.ts'

let magic: SrdMagicItem[]
let all: Entry[]
const seal: DmItem = {
  id: 'k1',
  name: 'The Raven Seal',
  description: 'A black wax seal stamped with a raven. The mayor would kill for it.',
  type: 'other',
  rarity: null,
  key: true,
}
beforeAll(async () => {
  magic = await loadMagicItems()
  all = buildCatalogue({ magic, equipment: await loadEquipment(), bits: BITS, yours: [seal] })
})
const none = { sources: [], rarities: [], types: [], search: '' }
const item = (index: string) => magic.find((m) => m.index === index)!

describe('the Give catalogue', () => {
  it('sorts wondrous items into types by name', () => {
    expect(magicType(item('amulet-of-health'))).toBe('amulets')
    expect(magicType(item('cloak-of-protection'))).toBe('cloaks')
    expect(magicType(item('boots-of-elvenkind'))).toBe('boots-gloves')
    expect(magicType(item('bag-of-holding'))).toBe('bags')
    expect(magicType(item('ring-of-protection'))).toBe('rings')
    expect(magicType(item('potion-of-healing-greater'))).toBe('potions')
  })

  it('filters by source, rarity, type and words', () => {
    const rings = filterCatalogue(all, { ...none, rarities: ['Uncommon'], types: ['rings'] })
    expect(rings.length).toBeGreaterThan(0)
    expect(rings.every((e) => e.source === 'magic' && e.rarity === 'Uncommon' && e.type === 'rings')).toBe(true)
    // Two tags in one group widen; a rarity leaves out things that have none.
    const both = filterCatalogue(all, { ...none, types: ['rings', 'amulets'] })
    expect(new Set(both.map((e) => e.type))).toEqual(new Set(['rings', 'amulets']))
    expect(filterCatalogue(all, { ...none, sources: ['bits'], search: 'spoon' }).map((e) => e.name)).toEqual([
      'Bent spoon',
    ])
    expect(filterCatalogue(all, { ...none, sources: ['yours'] })[0]).toMatchObject({
      name: 'The Raven Seal',
      line: 'Key item',
    })
  })

  it('gives bits and your own items with what they are', () => {
    const spoon = all.find((e) => e.name === 'Bent spoon')!
    expect(giftItem(spoon.gift, 1)).toMatchObject({
      item: null,
      name: 'Bent spoon',
      note: expect.stringContaining('Pewter'),
    })
    expect(giftItem({ kind: 'yours', item: seal }, 1)).toMatchObject({ name: 'The Raven Seal', note: seal.description })
  })
})
