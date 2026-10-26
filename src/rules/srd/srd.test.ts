// Checks the imported SRD data: that the import found everything, and a few entries the sheet relies on.
import { describe, expect, it } from 'vitest'
import { newBuild } from '../character.ts'
import {
  addMissingFeatures,
  classDefaults,
  classFeatures,
  describeBonuses,
  raceDefaults,
  raceTraits,
  slotsFor,
  withBackground,
  withClass,
  withLevel,
  withRace,
} from './defaults.ts'
import {
  byName,
  CONDITIONS,
  findWeapon,
  loadBackgrounds,
  loadClasses,
  loadEquipment,
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

  it('lists a level 2 fighter’s class features, with uses read from the name', async () => {
    const fighter = byName(await loadClasses(), 'Fighter')!
    const features = classFeatures(fighter, null, 2, await loadFeatures())
    expect(features.map((f) => f.name)).toContain('Second Wind')
    expect(features.find((f) => f.name === 'Action Surge')).toMatchObject({ usesMax: 1, usesLeft: 1 })
  })

  it('keeps only the highest version of a feature that improves with level', async () => {
    const fighter = byName(await loadClasses(), 'Fighter')!
    const features = classFeatures(fighter, null, 17, await loadFeatures())
    expect(features.filter((f) => f.name === 'Action Surge')).toHaveLength(1)
    expect(features.find((f) => f.name === 'Action Surge')?.usesMax).toBe(2)
    expect(features.filter((f) => f.name.startsWith('Extra Attack'))).toHaveLength(1)
  })

  it('reads uses per rest, such as Channel Divinity', async () => {
    const cleric = byName(await loadClasses(), 'Cleric')!
    const features = classFeatures(cleric, null, 2, await loadFeatures())
    expect(features.find((f) => f.name === 'Channel Divinity')).toMatchObject({ usesMax: 1, recharge: 'short' })
  })

  it('doesn’t add a feature the character already has under its short name', () => {
    const existing = [{ id: 'x', name: 'Extra Attack', description: '', usesMax: null, usesLeft: 0, recharge: null }]
    const extra = [{ id: 'y', name: 'Extra Attack (2)', description: '', usesMax: null, usesLeft: 0, recharge: null }]
    expect(addMissingFeatures(existing, extra)).toHaveLength(1)
  })

  it('fills in the form when a class is picked', async () => {
    const wizard = byName(await loadClasses(), 'Wizard')!
    const build = withClass({ ...newBuild(), level: 3 }, wizard)
    expect(build).toMatchObject({ className: 'Wizard', hitDie: 6, saveProficiencies: ['intelligence', 'wisdom'] })
    expect(build.spellcasting.ability).toBe('intelligence')
    expect(build.spellcasting.slotsMax).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
  })

  it('keeps proficiencies and languages the player already typed', async () => {
    const fighter = byName(await loadClasses(), 'Fighter')!
    const dwarf = byName((await loadRaces()).races, 'Dwarf')!
    const typed = { ...newBuild(), otherProficiencies: 'Smith’s tools', languages: 'Common' }
    expect(withClass(typed, fighter).otherProficiencies).toBe('Smith’s tools')
    expect(withRace(typed, dwarf)).toMatchObject({ speed: 25, languages: 'Common' })
    expect(withRace(newBuild(), dwarf).languages).toBe('Common, Dwarvish')
  })

  it('adds a background’s skills without losing others', async () => {
    const acolyte = (await loadBackgrounds())[0]
    const build = withBackground({ ...newBuild(), skillProficiencies: ['athletics', 'insight'] }, acolyte)
    expect(build.skillProficiencies).toEqual(['athletics', 'insight', 'religion'])
  })

  it('updates spell slots with the level, and never leaves more used than there are', async () => {
    const wizard = byName(await loadClasses(), 'Wizard')!
    const level3 = withClass({ ...newBuild(), level: 3 }, wizard)
    const used = { ...level3, spellcasting: { ...level3.spellcasting, slotsUsed: [4, 2, 0, 0, 0, 0, 0, 0, 0] } }
    const level1 = withLevel(used, 1, wizard)
    expect(level1.spellcasting.slotsMax).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(level1.spellcasting.slotsUsed).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('adds features only once', async () => {
    const fighter = byName(await loadClasses(), 'Fighter')!
    const features = classFeatures(fighter, null, 1, await loadFeatures())
    expect(addMissingFeatures(features, features)).toHaveLength(features.length)
  })

  it('lists a hill dwarf’s traits, including the subrace’s', async () => {
    const races = await loadRaces()
    const dwarf = byName(races.races, 'Dwarf')!
    const names = raceTraits(races, dwarf, 'hill-dwarf').map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['Darkvision', 'Dwarven Resilience', 'Dwarven Toughness']))
  })

  it('has the gear, starting kits and level-up choices the builder needs', async () => {
    const equipment = await loadEquipment()
    expect(equipment.items.filter((i) => i.kind === 'armor')).toHaveLength(13)
    expect(equipment.categories['martial-weapons'].length).toBeGreaterThan(10)
    const classes = await loadClasses()
    expect(classes.every((c) => c.startingChoices.length > 0)).toBe(true)
    expect(classes.find((c) => c.index === 'barbarian')?.levels[3].extras.rage_count).toBe(3)
    const backgrounds = await loadBackgrounds()
    expect(backgrounds[0]).toMatchObject({ gold: 15, languageChoices: 2 })
    expect(backgrounds[0].ideals.length).toBeGreaterThan(0)
    const features = await loadFeatures()
    expect(features['metamagic-1'].choice).toMatchObject({ kind: 'feature', choose: 2 })
    expect(features['favored-enemy-1-type'].choice?.from).toContain('undead')
    const races = await loadRaces()
    expect(races.races.find((r) => r.index === 'half-elf')?.abilityBonusChoice?.choose).toBe(2)
    expect(races.traits['draconic-ancestry-red']).toMatchObject({ damageType: 'fire' })
  })
})
