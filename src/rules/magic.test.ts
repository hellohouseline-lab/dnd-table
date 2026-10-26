import { beforeAll, describe, expect, it } from 'vitest'
import { syncAttacks } from './manage.ts'
import { wornArmourClass } from './items.ts'
import { attunedCount, giftItem, giftName, magicWords, needsBase, toggleAttuned } from './magic.ts'
import { sampleFighter } from '../screens/dev/sampleData.ts'
import { loadEquipment, loadMagicItems, type SrdEquipment, type SrdMagicItem } from './srd/index.ts'

let equipment: SrdEquipment
let magic: SrdMagicItem[]
beforeAll(async () => {
  equipment = await loadEquipment()
  magic = await loadMagicItems()
})
const gear = (index: string) => equipment.items.find((i) => i.index === index)!
const item = (index: string) => magic.find((m) => m.index === index)!

describe('magic items', () => {
  it('has the free rules magic items, without the "any" parents', () => {
    expect(magic.length).toBeGreaterThan(300)
    expect(magic.some((m) => m.index === 'potion-of-healing')).toBe(false)
    expect(item('cloak-of-protection')).toMatchObject({ rarity: 'Uncommon', attune: true })
    expect(item('weapon-2')).toMatchObject({ kind: 'weapon', bonus: 2 })
    expect(magicWords(item('cloak-of-protection'))).toBe('Uncommon · needs attuning')
  })

  it('pairs a +1 with a weapon, and the +1 reaches the attack card and the AC', () => {
    expect(needsBase(item('weapon-1'))).toBe('weapon')
    expect(needsBase(item('armor-1'))).toBe('armor')
    expect(needsBase(item('bag-of-holding'))).toBeNull()
    const sword = giftItem({ kind: 'magic', magic: item('weapon-1'), base: gear('longsword') }, 1)
    expect(sword).toMatchObject({ item: 'longsword', name: 'Longsword +1', bonus: 1, magic: 'weapon-1', weight: 3 })
    const attacks = syncAttacks([], [sword], equipment, 'Martial Weapons')
    expect(attacks).toMatchObject([{ name: 'Longsword +1', weapon: 'longsword', magicBonus: 1, proficient: true }])
    // A plain longsword alongside is a second card.
    const plain = giftItem({ kind: 'gear', item: gear('longsword') }, 1)
    expect(syncAttacks(attacks, [sword, plain], equipment, 'Martial Weapons')).toHaveLength(2)

    const mail = { ...giftItem({ kind: 'magic', magic: item('armor-1'), base: gear('chain-mail') }, 1), worn: true }
    expect(mail.name).toBe('Chain Mail +1')
    expect(wornArmourClass(sampleFighter, [mail], equipment)).toBe(17)
    expect(giftName({ kind: 'typed', name: '  A letter sealed with black wax ' })).toBe(
      'A letter sealed with black wax',
    )
  })

  it('attunes to three at most', () => {
    const rings = ['cloak-of-protection', 'ring-of-protection', 'cloak-of-elvenkind', 'amulet-of-health'].map((i) =>
      giftItem({ kind: 'magic', magic: item(i), base: null }, 1),
    )
    let pack = rings
    for (const r of rings.slice(0, 3)) pack = toggleAttuned(pack, r.id)!
    expect(attunedCount(pack)).toBe(3)
    expect(toggleAttuned(pack, rings[3].id)).toBeNull()
    expect(attunedCount(toggleAttuned(pack, rings[0].id)!)).toBe(2)
  })
})
