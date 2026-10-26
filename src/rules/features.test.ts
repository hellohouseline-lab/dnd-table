import { describe, expect, it } from 'vitest'
import {
  concentrationTimer,
  durationRounds,
  featureCost,
  featureRule,
  isRaging,
  rageDamage,
  RAGE,
  roundsLeftWords,
} from './features.ts'

describe('features', () => {
  it('reads what a feature costs from its text', () => {
    expect(featureCost('Rage', 'On your turn, you can enter a rage as a bonus action.')).toBe('bonus')
    expect(featureCost('Second Wind', 'On your turn, you can use a bonus action to regain hit points')).toBe('bonus')
    expect(featureCost('Uncanny Dodge', 'you can use your reaction to halve the attack’s damage')).toBe('reaction')
    expect(featureCost('Lay on Hands', 'As an action, you can touch a creature')).toBe('action')
    expect(featureCost('Action Surge', 'On your turn, you can take one additional action')).toBe('surge')
    expect(featureCost('Darkvision', 'You can see in dim light within 60 feet')).toBe('free')
  })

  it('knows the features the table runs itself', () => {
    expect(featureRule('Rage')).toBe('rage')
    expect(featureRule(' second wind ')).toBe('secondWind')
    expect(featureRule('Action Surge')).toBe('actionSurge')
    expect(featureRule('Cunning Action')).toBeNull()
  })

  it('works out Rage', () => {
    expect([rageDamage(1), rageDamage(9), rageDamage(16)]).toEqual([2, 3, 4])
    expect(isRaging({ effects: [RAGE] })).toBe(true)
    expect(isRaging({ effects: [] })).toBe(false)
  })

  it('counts durations in rounds', () => {
    expect(durationRounds('1 minute')).toBe(10)
    expect(durationRounds('Up to 1 minute')).toBe(10)
    expect(durationRounds('Up to 10 minutes')).toBe(100)
    expect(durationRounds('1 round')).toBe(1)
    expect(durationRounds('Up to 1 hour')).toBe(600)
    expect(durationRounds('Instantaneous')).toBeNull()
    expect(durationRounds('Until dispelled')).toBeNull()
    expect(RAGE.roundsLeft).toBe(10)
  })

  it('makes concentration timers', () => {
    expect(concentrationTimer('Bless', 'Up to 1 minute')).toEqual({
      key: 'concentration',
      name: 'Bless (concentration)',
      spell: 'Bless',
      roundsLeft: 10,
    })
    expect(concentrationTimer('Odd', 'Special')).toBeNull()
    expect([roundsLeftWords(1), roundsLeftWords(7), roundsLeftWords(100)]).toEqual([
      'last round',
      '7 rounds left',
      'about 10 minutes left',
    ])
  })
})
