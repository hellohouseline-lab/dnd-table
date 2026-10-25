// The milestone 2 check: type in a Dwarf Fighter, change Strength, and the bonuses move with it.
import { describe, expect, it } from 'vitest'
import { newBuild, type Character } from './character.ts'
import { deriveSheet } from './sheet.ts'

const dwarfFighter = {
  ...newBuild(),
  name: 'Dwarf Fighter',
  race: 'Dwarf',
  subrace: 'Hill Dwarf',
  className: 'Fighter',
  level: 2,
  scores: { strength: 16, dexterity: 12, constitution: 15, intelligence: 10, wisdom: 12, charisma: 8 },
  hitDie: 10,
  hitDiceUsed: 0,
  saveProficiencies: ['strength', 'constitution'],
  skillProficiencies: ['athletics', 'perception'],
  attacks: [
    {
      id: 'a1',
      name: 'Longsword',
      weapon: 'longsword',
      proficient: true,
      magicBonus: 0,
      ability: 'strength',
      damageDice: '',
      damageType: '',
    },
  ],
} satisfies Partial<Character> as Character

describe('deriveSheet', () => {
  const sheet = deriveSheet(dwarfFighter)

  it('works out the modifiers and proficiency bonus', () => {
    expect(sheet.modifiers).toEqual({
      strength: 3,
      dexterity: 1,
      constitution: 2,
      intelligence: 0,
      wisdom: 1,
      charisma: -1,
    })
    expect(sheet.proficiencyBonus).toBe(2)
  })

  it('adds proficiency to the class’s saves only', () => {
    expect(sheet.saves.find((s) => s.ability === 'strength')).toEqual({ ability: 'strength', proficient: true, bonus: 5 })
    expect(sheet.saves.find((s) => s.ability === 'dexterity')).toEqual({ ability: 'dexterity', proficient: false, bonus: 1 })
  })

  it('works out skills, passive Perception and initiative', () => {
    expect(sheet.skills.find((s) => s.index === 'athletics')).toMatchObject({ rank: 'proficient', bonus: 5 })
    expect(sheet.skills.find((s) => s.index === 'stealth')).toMatchObject({ rank: 'none', bonus: 1 })
    expect(sheet.passivePerception).toBe(13)
    expect(sheet.initiative).toBe(1)
  })

  it('fills in the longsword attack from the SRD', () => {
    expect(sheet.attacks[0].result).toMatchObject({ toHit: 5, damage: '1d8+3', versatileDamage: '1d10+3' })
  })

  it('moves the attack and Strength save when Strength changes', () => {
    const stronger = deriveSheet({ ...dwarfFighter, scores: { ...dwarfFighter.scores, strength: 18 } })
    expect(stronger.attacks[0].result.toHit).toBe(6)
    expect(stronger.attacks[0].result.damage).toBe('1d8+4')
    expect(stronger.saves.find((s) => s.ability === 'strength')?.bonus).toBe(6)
  })

  it('counts hit dice', () => {
    expect(sheet.hitDice).toEqual({ die: 10, total: 2, left: 2 })
    expect(deriveSheet({ ...dwarfFighter, hitDiceUsed: 1 }).hitDice.left).toBe(1)
  })

  it('has no spell numbers without a spellcasting ability', () => {
    expect(sheet.spell).toBeNull()
  })

  it('works out spell numbers when there is one', () => {
    const caster = deriveSheet({
      ...dwarfFighter,
      spellcasting: { ...dwarfFighter.spellcasting, ability: 'wisdom' },
    })
    expect(caster.spell).toEqual({ ability: 'wisdom', saveDc: 11, attackBonus: 3 })
  })
})
