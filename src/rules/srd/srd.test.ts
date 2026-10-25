// Checks the imported SRD data: that the import found everything, and a few entries the sheet relies on.
import { describe, expect, it } from 'vitest'
import { classDefaults, classFeatures, describeBonuses, raceDefaults, raceTraits, slotsFor } from './defaults.ts'
import {
  byName,
  CONDITIONS,
  findWeapon,
  loadBackgrounds,
  loadClasses,
  loadFeatures,
  loadRaces,
  loadSpells,
  SKILLS,
  WEAPONS,
} from './index.ts'

describe('the imported SRD data', () => {
  it('has every skill, condition and weapon', () => {
    expect(SKILLS).toHaveLength(18)
    expect(CONDITIONS).toHaveLength(15)
    expect(WEAPONS).toHaveLength(36)
  })

  it('maps skills to their abilities', () => {
    expect(SKILLS.find((s) => s.index === 'athletics')?.ability).toBe('strength')
    expect(SKILLS.find((s) => s.index === 'perception')?.ability).toBe('wisdom')
  })

  it('has the longsword as the Player’s Handbook lists it', () => {
    expect(findWeapon('longsword')).toMatchObject({
      name: 'Longsword',
      category: 'Martial',
      range: 'Melee',
      damageDice: '1d8',
      damageType: 'Slashing',
      versatileDice: '1d10',
      properties: ['versatile'],
    })
  })

  it('has every class, race, background and spell', async () => {
    expect(await loadClasses()).toHaveLength(12)
    expect((await loadRaces()).races).toHaveLength(9)
    expect(await loadBackgrounds()).toHaveLength(1)
    expect(await loadSpells()).toHaveLength(319)
    expect(Object.keys(await loadFeatures()).length).toBeGreaterThan(400)
  })

  it('finds entries by name as typed', async () => {
    const classes = await loadClasses()
    expect(byName(classes, ' fighter ')?.index).toBe('fighter')
    expect(byName(classes, 'Artificer')).toBeUndefined()
  })
})

describe('defaults from the SRD', () => {
  it('gives a fighter d10 hit dice and Strength and Constitution saves', async () => {
    const fighter = byName(await loadClasses(), 'Fighter')!
    expect(classDefaults(fighter, 2)).toMatchObject({
      hitDie: 10,
      saveProficiencies: ['strength', 'constitution'],
      spellcastingAbility: null,
    })
  })

  it('gives a level 3 wizard four 1st-level slots and two 2nd-level slots', async () => {
    const wizard = byName(await loadClasses(), 'Wizard')!
    expect(slotsFor(wizard, 3)).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(classDefaults(wizard, 3).spellcastingAbility).toBe('intelligence')
  })

  it('gives a hill dwarf speed 25 and +2 CON, +1 WIS', async () => {
    const dwarf = byName((await loadRaces()).races, 'Dwarf')!
    expect(raceDefaults(dwarf, 'hill-dwarf')).toMatchObject({ speed: 25, bonusesText: '+2 CON, +1 WIS' })
  })

  it('writes ability bonuses in words', () => {
    expect(describeBonuses({ strength: 2, charisma: 1 })).toBe('+2 STR, +1 CHA')
  })

  it('lists a level 2 fighter’s class features', async () => {
    const fighter = byName(await loadClasses(), 'Fighter')!
    const names = classFeatures(fighter, null, 2, await loadFeatures()).map((f) => f.name)
    expect(names).toContain('Second Wind')
    expect(names).toContain('Action Surge (1 use)')
  })

  it('lists a hill dwarf’s traits, including the subrace’s', async () => {
    const races = await loadRaces()
    const dwarf = byName(races.races, 'Dwarf')!
    const names = raceTraits(races, dwarf, 'hill-dwarf').map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['Darkvision', 'Dwarven Resilience', 'Dwarven Toughness']))
  })
})
