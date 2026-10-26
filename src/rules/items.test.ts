import { beforeAll, describe, expect, it } from 'vitest'
import { sampleFighter } from '../screens/dev/sampleData.ts'
import { usableItems, wornArmourClass, USABLE } from './items.ts'
import { loadEquipment, type SrdEquipment } from './srd/index.ts'

let equipment: SrdEquipment
beforeAll(async () => {
  equipment = await loadEquipment()
})

describe('items', () => {
  it('lists what can be used, and not what has run out', () => {
    const usable = usableItems(sampleFighter.inventory).map((u) => u.item.name)
    expect(usable).toEqual(['Potion of Healing', "Healer's Kit", "Alchemist's Fire (flask)"])
    const emptyKit = sampleFighter.inventory.map((i) => (i.item === 'healers-kit' ? { ...i, uses: 0 } : i))
    expect(usableItems(emptyKit).map((u) => u.item.name)).not.toContain("Healer's Kit")
  })

  it('knows the four potions of healing', () => {
    expect(USABLE['potion-of-healing-common']).toMatchObject({ kind: 'heal', bonus: 2, dice: [{ sides: 4, count: 2 }] })
    expect(USABLE['potion-of-healing-supreme']).toMatchObject({ bonus: 20, dice: [{ sides: 4, count: 10 }] })
  })

  it('works out AC from the armour worn', () => {
    expect(wornArmourClass(sampleFighter, sampleFighter.inventory, equipment)).toBe(18)
    const noShield = sampleFighter.inventory.map((i) => (i.item === 'shield' ? { ...i, worn: false } : i))
    expect(wornArmourClass(sampleFighter, noShield, equipment)).toBe(16)
    expect(wornArmourClass(sampleFighter, [], equipment)).toBeNull()
  })
})
