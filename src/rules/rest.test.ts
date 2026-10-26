import { describe, expect, it } from 'vitest'
import { sampleFighter, sampleWizard } from '../screens/dev/sampleData.ts'
import type { FeatureEntry } from './character.ts'
import { hitDieHealing, longRest, shortRest } from './rest.ts'

const secondWind: FeatureEntry = {
  id: 'f1',
  name: 'Second Wind',
  description: '',
  usesMax: 1,
  usesLeft: 0,
  recharge: 'short',
}
const surge: FeatureEntry = {
  id: 'f2',
  name: 'Action Surge',
  description: '',
  usesMax: 1,
  usesLeft: 0,
  recharge: 'short',
}
const rage: FeatureEntry = { id: 'f3', name: 'Rage', description: '', usesMax: 2, usesLeft: 0, recharge: 'long' }
const darkvision: FeatureEntry = {
  id: 'f4',
  name: 'Darkvision',
  description: '',
  usesMax: null,
  usesLeft: 0,
  recharge: null,
}

const tired = {
  ...sampleFighter,
  level: 5,
  currentHp: 9,
  maxHp: 44,
  tempHp: 5,
  hitDiceUsed: 4,
  features: [secondWind, surge, rage, darkvision],
  spellcasting: { ...sampleWizard.spellcasting, slotsUsed: [2, 1, 0, 0, 0, 0, 0, 0, 0] },
  exhaustion: 2,
  deathSaveSuccesses: 1,
  deathSaveFailures: 2,
  stable: false,
  dead: false,
}

describe('a short rest', () => {
  it('recharges short-rest features only', () => {
    const { patch, changes } = shortRest(tired)
    expect(patch.features?.map((f) => f.usesLeft)).toEqual([1, 1, 0, 0])
    expect(changes).toEqual(['Second Wind and Action Surge are ready again'])
  })

  it('changes nothing when nothing needs it', () => {
    expect(shortRest({ ...tired, features: [darkvision] })).toEqual({ patch: {}, changes: [] })
  })
})

describe('a long rest', () => {
  const { patch, changes } = longRest(tired)

  it('restores all hit points and drops temporary ones', () => {
    expect(patch).toMatchObject({ currentHp: 44, tempHp: 0 })
  })

  it('gives back half the hit dice, rounded down', () => {
    expect(patch.hitDiceUsed).toBe(2)
  })

  it('gives back at least one hit die, even at level 1', () => {
    expect(longRest({ ...tired, level: 1, hitDiceUsed: 1 }).patch.hitDiceUsed).toBe(0)
  })

  it('restores every spell slot and feature use', () => {
    expect(patch.spellcasting?.slotsUsed.every((n) => n === 0)).toBe(true)
    expect(patch.features?.map((f) => f.usesLeft)).toEqual([1, 1, 2, 0])
  })

  it('takes away one level of exhaustion and resets death saves', () => {
    expect(patch).toMatchObject({ exhaustion: 1, deathSaveSuccesses: 0, deathSaveFailures: 0 })
  })

  it('says what changed in plain words', () => {
    expect(changes).toEqual([
      'back to 44 hit points',
      '2 hit dice back',
      'all spell slots back',
      'Second Wind, Action Surge and Rage ready again',
      'exhaustion down to 1',
    ])
  })
})

describe('spending a hit die', () => {
  it('heals the roll plus Constitution, never below 0', () => {
    expect(hitDieHealing(7, 2)).toBe(9)
    expect(hitDieHealing(1, -2)).toBe(0)
  })
})
