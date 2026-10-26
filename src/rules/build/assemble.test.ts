import { beforeAll, describe, expect, it } from 'vitest'
import { loadBackgrounds, loadClasses, loadEquipment, loadFeatures, loadRaces, loadSpells } from '../srd/index.ts'
import { assembleBuild, type BuilderData } from './assemble.ts'
import { emptyDraft, withRacePicked, type BuilderDraft } from './draft.ts'
import { spellPlan, spellsMissing } from './spellsStep.ts'
import { withClassPicked } from './steps.ts'

let data: BuilderData
beforeAll(async () => {
  data = {
    races: await loadRaces(),
    classes: await loadClasses(),
    features: await loadFeatures(),
    backgrounds: await loadBackgrounds(),
    equipment: await loadEquipment(),
    spells: await loadSpells(),
  }
})
const cls = (index: string) => data.classes.find((c) => c.index === index)!
const scores = { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }

function wizard(): BuilderDraft {
  return {
    ...withClassPicked({ ...withRacePicked(emptyDraft(), 'elf'), subrace: 'high-elf' }, 'wizard'),
    traitPicks: { 'high-elf-cantrip': 'fire-bolt' },
    languagePicks: ['Draconic'],
    classSkillPicks: ['arcana', 'history'],
    background: 'acolyte',
    backgroundLanguagePicks: ['Giant', 'Orc'],
    scoreMethod: 'standard',
    baseScores: scores,
    gearPicks: [
      { option: 0, picks: [] },
      { option: 0, picks: [] },
      { option: 0, picks: [] },
    ],
    backgroundGearPicks: [{ option: 0, picks: [['amulet']] }],
    cantripPicks: ['light', 'mage-hand', 'ray-of-frost'],
    spellPicks: ['magic-missile', 'shield', 'sleep', 'mage-armor', 'burning-hands', 'detect-magic'],
    preparedPicks: ['magic-missile', 'shield', 'sleep', 'mage-armor'],
    name: 'Elowen',
  }
}

describe("the builder's spells", () => {
  it('knows how each class keeps its spells at level 1', () => {
    const wiz = spellPlan(cls('wizard'), 1, null, { ...scores, intelligence: 17 }, data.spells)
    expect(wiz).toMatchObject({ cantrips: 3, spells: 6, how: 'spellbook', prepare: 4, maxLevel: 1 })
    expect(wiz.spellList.every((s) => s.level === 1 && s.classes.includes('wizard'))).toBe(true)
    const cleric = spellPlan(cls('cleric'), 1, 'life', { ...scores, wisdom: 16 }, data.spells)
    expect(cleric).toMatchObject({ cantrips: 3, spells: 4, how: 'prepared' })
    expect(cleric.always.map((s) => s.name)).toEqual(['Bless', 'Cure Wounds'])
    expect(cleric.spellList.map((s) => s.name)).not.toContain('Bless')
    expect(spellPlan(cls('bard'), 1, null, scores, data.spells)).toMatchObject({ cantrips: 2, spells: 4, how: 'known' })
    expect(spellPlan(cls('fighter'), 1, null, scores, data.spells)).toMatchObject({
      cantrips: 0,
      spells: 0,
      how: 'none',
    })
  })

  it('says what is left to pick', () => {
    const plan = spellPlan(cls('wizard'), 1, null, { ...scores, intelligence: 17 }, data.spells)
    expect(spellsMissing({ ...emptyDraft(), cantripPicks: ['light'] }, plan)).toEqual([
      'Pick 2 more cantrips',
      'Pick 6 more spells for your spellbook',
    ])
  })
})

describe('assembling the character', () => {
  it('makes a high elf wizard ready to play', () => {
    const build = assembleBuild(wizard(), data)!
    expect(build).toMatchObject({
      name: 'Elowen',
      race: 'Elf',
      subrace: 'High Elf',
      className: 'Wizard',
      background: 'Acolyte',
      level: 1,
      maxHp: 7,
      armourClass: 13,
      speed: 30,
      hitDie: 6,
      saveProficiencies: ['intelligence', 'wisdom'],
    })
    expect(build.scores).toMatchObject({ dexterity: 16, intelligence: 16 })
    expect(build.skillProficiencies.sort()).toEqual(['arcana', 'history', 'insight', 'perception', 'religion'])
    expect(build.languages).toBe('Common, Elvish, Draconic, Giant, Orc')
    expect(build.spellcasting).toMatchObject({ ability: 'intelligence', slotsMax: [2, 0, 0, 0, 0, 0, 0, 0, 0] })
    const spells = build.spellcasting.spells
    expect(spells.filter((s) => s.level === 0).map((s) => s.name)).toEqual([
      'Light',
      'Mage Hand',
      'Ray of Frost',
      'Fire Bolt',
    ])
    expect(spells.filter((s) => s.level === 1 && s.prepared)).toHaveLength(4)
    expect(spells.find((s) => s.index === 'detect-magic')?.prepared).toBe(false)
    expect(build.attacks.map((a) => a.name)).toEqual(['Quarterstaff'])
    expect(build.wallet.gp).toBe(15)
    expect(build.features.map((f) => f.name)).toEqual(
      expect.arrayContaining(['Darkvision', 'Arcane Recovery', 'Shelter of the Faithful']),
    )
    expect(build.features.find((f) => f.name === 'Arcane Recovery')).toMatchObject({ usesMax: 1, recharge: 'long' })
  })

  it("gives a fighter a fighting style and Second Wind's use, and a barbarian rages", () => {
    const fighter = assembleBuild(
      {
        ...wizard(),
        className: 'fighter',
        subclass: null,
        classSkillPicks: ['athletics', 'insight'],
        featurePicks: { 'fighter-fighting-style': ['fighter-fighting-style-defense'] },
        cantripPicks: [],
        spellPicks: [],
        gearPicks: [
          { option: 0, picks: [] },
          { option: 0, picks: [['longsword']] },
          { option: 1, picks: [] },
          { option: 0, picks: [] },
        ],
      },
      data,
    )!
    expect(fighter.features.find((f) => f.name === 'Second Wind')).toMatchObject({ usesMax: 1, recharge: 'short' })
    expect(fighter.features.map((f) => f.name)).toContain('Fighting Style: Defense')
    expect(fighter.armourClass).toBe(18)
    // Chain mail needs Strength 13; with 8 the fighter is slowed.
    expect(fighter.speed).toBe(20)
    expect(fighter.spellcasting.spells).toEqual([expect.objectContaining({ name: 'Fire Bolt' })])
    const barbarian = assembleBuild(
      { ...wizard(), className: 'barbarian', cantripPicks: [], spellPicks: [], gearPicks: [] },
      data,
    )!
    expect(barbarian.features.find((f) => f.name === 'Rage')).toMatchObject({ usesMax: 2, recharge: 'long' })
  })
})
