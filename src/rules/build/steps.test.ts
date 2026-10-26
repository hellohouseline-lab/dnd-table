import { beforeAll, describe, expect, it } from 'vitest'
import {
  loadBackgrounds,
  loadClasses,
  loadFeatures,
  loadRaces,
  type SrdBackground,
  type SrdClass,
  type SrdFeature,
  type SrdRaces,
} from '../srd/index.ts'
import { emptyDraft, raceSummary, withRacePicked, type BuilderDraft } from './draft.ts'
import {
  allSkills,
  backgroundSummary,
  classSummary,
  finalScores,
  levelOneSubclass,
  methodValues,
  randomBalanced,
  scoresValid,
  startingHp,
  withClassPicked,
} from './steps.ts'

let races: SrdRaces
let classes: Record<string, SrdClass>
let features: Record<string, SrdFeature>
let backgrounds: SrdBackground[]
beforeAll(async () => {
  races = await loadRaces()
  classes = Object.fromEntries((await loadClasses()).map((c) => [c.index, c]))
  features = await loadFeatures()
  backgrounds = await loadBackgrounds()
})

const elf = (): BuilderDraft => ({ ...withRacePicked(emptyDraft(), 'elf'), subrace: 'high-elf' })

describe('the class step', () => {
  it('asks a fighter for two skills and a fighting style', () => {
    const draft = withClassPicked(emptyDraft(), 'fighter')
    const fighter = classSummary(draft, classes.fighter, features, null)
    expect(fighter).toMatchObject({ hitDie: 10, saves: ['strength', 'constitution'], subclass: null })
    expect(fighter.missing).toEqual(['Pick 2 skills', 'Pick your fighting style'])
    const done = classSummary(
      {
        ...draft,
        classSkillPicks: ['athletics', 'perception'],
        featurePicks: { 'fighter-fighting-style': ['fighter-fighting-style-defense'] },
      },
      classes.fighter,
      features,
      null,
    )
    expect(done.missing).toEqual([])
    expect(done.asks[0].options.map((o) => o.name)).toContain('Defense')
  })

  it("doesn't count a skill the race already gives", () => {
    const race = raceSummary(elf(), races)
    expect(race?.skills).toEqual(['perception'])
    const draft = { ...withClassPicked(elf(), 'fighter'), classSkillPicks: ['perception', 'athletics'] }
    expect(classSummary(draft, classes.fighter, features, race).missing).toContain('Pick 2 skills')
  })

  it("picks a cleric's domain for them, and offers a rogue expertise in their own skills", () => {
    expect(levelOneSubclass(classes.cleric)).toBe('life')
    expect(levelOneSubclass(classes.wizard)).toBeNull()
    const cleric = classSummary(withClassPicked(emptyDraft(), 'cleric'), classes.cleric, features, null)
    expect(cleric.subclass?.name).toBe('Life')
    const rogue = {
      ...withClassPicked(emptyDraft(), 'rogue'),
      classSkillPicks: ['stealth', 'acrobatics', 'insight', 'deception'],
    }
    const expertise = classSummary(rogue, classes.rogue, features, null).asks.find((a) => a.kind === 'skill')
    expect(expertise?.options.map((o) => o.index)).toEqual([
      'acrobatics',
      'deception',
      'insight',
      'stealth',
      'thieves-tools',
    ])
  })

  it('asks a draconic sorcerer for a dragon ancestor and a ranger for a favoured enemy', () => {
    const sorcerer = classSummary(withClassPicked(emptyDraft(), 'sorcerer'), classes.sorcerer, features, null)
    expect(sorcerer.asks.map((a) => a.feature)).toContain('dragon-ancestor')
    const ranger = classSummary(withClassPicked(emptyDraft(), 'ranger'), classes.ranger, features, null)
    expect(ranger.asks.map((a) => a.kind)).toEqual(['text', 'text'])
  })
})

describe('the background step', () => {
  it('gives the Acolyte its skills and swaps one you already have', () => {
    const draft = { ...emptyDraft(), background: 'acolyte' }
    const plain = backgroundSummary(draft, backgrounds, [])
    expect(plain).toMatchObject({ skills: ['insight', 'religion'], doubled: [], languages: 2 })
    expect(plain?.missing).toEqual(['Pick 2 languages'])
    const doubled = backgroundSummary(draft, backgrounds, ['insight'])
    expect(doubled).toMatchObject({ doubled: ['insight'], skillPicks: 1 })
    expect(doubled?.missing[0]).toBe('Pick a skill in place of the one you have')
  })

  it('lets you make your own background', () => {
    const own = backgroundSummary({ ...emptyDraft(), background: 'other' }, backgrounds, [])
    expect(own?.missing).toEqual(['Name your background', 'Pick 2 skills', 'Pick 2 languages'])
  })

  it('adds up every skill', () => {
    const draft = {
      ...elf(),
      classSkillPicks: ['athletics', 'insight'],
      background: 'acolyte',
      backgroundSkillPicks: ['history'],
    }
    const race = raceSummary(draft, races)
    const bg = backgroundSummary(draft, backgrounds, ['perception', 'athletics', 'insight'])
    expect(allSkills(draft, race, bg).sort()).toEqual(['athletics', 'history', 'insight', 'perception', 'religion'])
  })
})

describe('the scores step', () => {
  it('checks the standard array and point buy', () => {
    const scores = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }
    expect(scoresValid({ ...emptyDraft(), scoreMethod: 'standard', baseScores: scores })).toBe(true)
    expect(scoresValid({ ...emptyDraft(), scoreMethod: 'standard', baseScores: { ...scores, charisma: 10 } })).toBe(
      false,
    )
    expect(scoresValid({ ...emptyDraft(), scoreMethod: 'pointbuy', baseScores: { ...scores, strength: 13 } })).toBe(
      true,
    )
    expect(scoresValid({ ...emptyDraft(), scoreMethod: 'pointbuy', baseScores: { ...scores, charisma: 15 } })).toBe(
      false,
    )
  })

  it('uses rolled values, best three of four', () => {
    const rolled = [
      [6, 6, 6, 1],
      [5, 5, 5, 5],
      [1, 1, 1, 1],
      [4, 3, 2, 1],
      [6, 5, 4, 3],
      [2, 2, 2, 6],
    ]
    expect(methodValues({ ...emptyDraft(), scoreMethod: 'roll', rolled })).toEqual([18, 15, 3, 9, 15, 10])
  })

  it('deals random but balanced scores, best to the class', () => {
    const scores = randomBalanced('wizard', () => 0.5)
    expect([scores.intelligence, scores.constitution]).toEqual([15, 14])
    expect(Object.values(scores).sort((a, b) => a - b)).toEqual([8, 10, 12, 13, 14, 15])
  })

  it('adds racial bonuses and works out hit points', () => {
    const draft = {
      ...withRacePicked(emptyDraft(), 'dwarf'),
      subrace: 'hill-dwarf',
      baseScores: { strength: 15, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 12, charisma: 13 },
    }
    const race = raceSummary(draft, races)
    const scores = finalScores(draft, race)!
    expect([scores.constitution, scores.wisdom]).toEqual([16, 13])
    expect(startingHp(classes.fighter, scores, race)).toBe(14)
  })
})
