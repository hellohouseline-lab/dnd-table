import { beforeAll, describe, expect, it } from 'vitest'
import {
  loadBackgrounds,
  loadClasses,
  loadEquipment,
  type SrdBackground,
  type SrdClass,
  type SrdEquipment,
} from '../srd/index.ts'
import { emptyDraft } from './draft.ts'
import { gearSummary, itemName, optionWords, toInventory } from './gearStep.ts'

let classes: Record<string, SrdClass>
let acolyte: SrdBackground
let equipment: SrdEquipment
beforeAll(async () => {
  classes = Object.fromEntries((await loadClasses()).map((c) => [c.index, c]))
  acolyte = (await loadBackgrounds())[0]
  equipment = await loadEquipment()
})
const scores = { strength: 15, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 13, charisma: 10 }

describe("the builder's gear step", () => {
  it('writes options in plain British words', () => {
    expect(itemName('Leather Armor')).toBe('Leather Armour')
    const fighter = classes.fighter.startingChoices
    expect(optionWords(fighter[0].options[1], equipment)).toBe('Leather Armour, Longbow and 20 × Arrow')
    expect(optionWords(fighter[1].options[0], equipment)).toBe('a martial weapon and Shield')
  })

  it("makes a fighter's kit, with AC from chain mail and a shield", () => {
    const draft = {
      ...emptyDraft(),
      gearPicks: [
        { option: 0, picks: [] },
        { option: 0, picks: [['longsword']] },
        { option: 1, picks: [] },
        { option: 0, picks: [] },
      ],
      backgroundGearPicks: [{ option: 0, picks: [['amulet']] }],
    }
    const gear = gearSummary(draft, classes.fighter, acolyte, equipment, scores)
    expect(gear.missing).toEqual([])
    expect(gear.ac).toMatchObject({ ac: 18 })
    expect(gear.attacks.map((a) => a.name)).toEqual(['Longsword', 'Handaxe'])
    expect(gear.wallet.gp).toBe(15)
    expect(gear.capacity).toBe(225)
    const inventory = toInventory(gear.owned, gear.worn, equipment)
    expect(inventory.find((i) => i.item === 'chain-mail')).toMatchObject({ name: 'Chain Mail', worn: true, weight: 55 })
    expect(inventory.find((i) => i.item === 'shield')?.worn).toBe(true)
    expect(inventory.find((i) => i.item === 'handaxe')?.quantity).toBe(2)
  })

  it('says what is left to choose', () => {
    const gear = gearSummary(emptyDraft(), classes.wizard, acolyte, equipment, scores)
    expect(gear.missing).toEqual(['Make 3 more gear choices', 'Make the last background choice'])
    expect(gear.owned.map((o) => o.item)).toEqual(expect.arrayContaining(['spellbook', 'clothes-common', 'pouch']))
    expect(gear.ac?.ac).toBe(11)
  })
})
