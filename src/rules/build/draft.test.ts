import { beforeAll, describe, expect, it } from 'vitest'
import { loadRaces, type SrdRaces } from '../srd/index.ts'
import { emptyDraft, raceSummary, togglePick, withRacePicked } from './draft.ts'

let races: SrdRaces
beforeAll(async () => {
  races = await loadRaces()
})

describe("the builder's race step", () => {
  it('adds up a race and its kind, and says what is left to pick', () => {
    const dwarf = withRacePicked(emptyDraft(), 'dwarf')
    expect(raceSummary(dwarf, races)?.missing).toEqual(['Pick a kind of dwarf'])
    const hill = raceSummary({ ...dwarf, subrace: 'hill-dwarf' }, races)
    expect(hill).toMatchObject({ name: 'Hill Dwarf', bonuses: { constitution: 2, wisdom: 1 }, speed: 25, missing: [] })
    expect(hill?.traits.map((t) => t.name)).toContain('Dwarven Toughness')
  })

  it('asks a half-elf for two +1s and a language', () => {
    const halfElf = withRacePicked(emptyDraft(), 'half-elf')
    expect(raceSummary(halfElf, races)?.missing).toEqual(['Pick 2 abilities for your +1s', 'Pick an extra language'])
    const done = raceSummary(
      { ...halfElf, bonusPicks: ['dexterity', 'constitution'], languagePicks: ['Draconic'] },
      races,
    )
    expect(done).toMatchObject({ bonuses: { charisma: 2, dexterity: 1, constitution: 1 }, missing: [] })
    expect(done?.languages).toEqual(['Common', 'Elvish', 'Draconic'])
  })

  it("puts a dragonborn's ancestry in place of the trait that asked", () => {
    const dragonborn = withRacePicked(emptyDraft(), 'dragonborn')
    expect(raceSummary(dragonborn, races)?.missing).toEqual(['Pick your draconic ancestry'])
    const red = raceSummary({ ...dragonborn, traitPicks: { 'draconic-ancestry': 'draconic-ancestry-red' } }, races)
    expect(red?.missing).toEqual([])
    expect(red?.traits.filter((t) => /Draconic Ancestry/.test(t.name))).toHaveLength(1)
  })

  it('asks a high elf for a cantrip, and lets anyone type in another race', () => {
    const high = { ...withRacePicked(emptyDraft(), 'elf'), subrace: 'high-elf' }
    expect(raceSummary(high, races)?.missing).toEqual(['Pick an extra language', 'Pick your cantrip'])
    const fire = raceSummary({ ...high, traitPicks: { 'high-elf-cantrip': 'fire-bolt' } }, races)
    expect(fire?.traits.map((t) => t.name)).toContain('High Elf Cantrip: Fire Bolt')
    const other = withRacePicked(emptyDraft(), 'other')
    expect(raceSummary(other, races)?.missing).toEqual(["Type your race's name"])
    expect(raceSummary({ ...other, otherRace: 'Goliath' }, races)).toMatchObject({ name: 'Goliath', missing: [] })
  })

  it('clears the old race’s picks and keeps picks to their limit', () => {
    const picked = { ...withRacePicked(emptyDraft(), 'half-elf'), bonusPicks: ['strength' as const] }
    expect(withRacePicked(picked, 'dwarf').bonusPicks).toEqual([])
    expect(togglePick(['a', 'b'], 'c', 2)).toEqual(['b', 'c'])
    expect(togglePick(['a', 'b'], 'a', 2)).toEqual(['b'])
  })
})
