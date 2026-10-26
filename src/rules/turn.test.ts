import { describe, expect, it } from 'vitest'
import {
  actionFree,
  attackHits,
  attackMode,
  attacksLeft,
  attacksPerAction,
  FRESH_TURN,
  movementLeft,
  actionReach,
  inReach,
  targetEffects,
  weaponReach,
} from './turn.ts'

describe('Extra Attack', () => {
  it('gives fighters more attacks at 5, 11 and 20, and other martial classes two at 5', () => {
    expect([1, 4, 5, 10, 11, 19, 20].map((level) => attacksPerAction('Fighter', level))).toEqual([1, 1, 2, 2, 3, 3, 4])
    for (const name of ['Barbarian', 'Monk', 'Paladin', 'Ranger']) {
      expect([attacksPerAction(name, 4), attacksPerAction(name, 5), attacksPerAction(name, 20)]).toEqual([1, 2, 2])
    }
    expect(attacksPerAction('Wizard', 20)).toBe(1)
    expect(attacksPerAction(' fighter ', 5)).toBe(2)
  })
})

describe('what is left of a turn', () => {
  it('counts movement from speed, Dash and the feet walked, never below nothing', () => {
    expect(movementLeft(FRESH_TURN, 30)).toBe(30)
    expect(movementLeft({ feetMoved: 20, extraFeet: 30 }, 30)).toBe(40)
    expect(movementLeft({ feetMoved: 45, extraFeet: 0 }, 30)).toBe(0)
  })

  it('counts attacks left from the Attack action', () => {
    expect(attacksLeft(FRESH_TURN, 2)).toBe(2)
    expect(attacksLeft({ actionUsed: true, attacksMade: 1 }, 2)).toBe(1)
    expect(attacksLeft({ actionUsed: true, attacksMade: 2 }, 2)).toBe(0)
    // The action went on something else, such as Dash.
    expect(attacksLeft({ actionUsed: true, attacksMade: 0 }, 2)).toBe(0)
  })

  it('frees the action for other things only before any attack', () => {
    expect(actionFree(FRESH_TURN)).toBe(true)
    expect(actionFree({ actionUsed: true, attacksMade: 1 })).toBe(false)
    expect(actionFree({ actionUsed: true, attacksMade: 0 })).toBe(false)
  })
})

describe('hit or miss', () => {
  it('is the total against armour class, but a natural 20 always hits and a natural 1 always misses', () => {
    expect(attackHits(12, 15, 15)).toBe(true)
    expect(attackHits(11, 14, 15)).toBe(false)
    expect(attackHits(20, 22, 30)).toBe(true)
    expect(attackHits(1, 40, 10)).toBe(false)
  })
})

describe('advantage from the target', () => {
  it('gives disadvantage against a Dodging or invisible target', () => {
    expect(targetEffects({ conditions: [], dodging: true }, 5)).toEqual([{ mode: 'disadvantage', reason: 'Dodging' }])
    expect(attackMode('normal', { conditions: ['invisible'], dodging: false }, 5)).toBe('disadvantage')
  })

  it('makes a prone target easier up close and harder from afar', () => {
    expect(attackMode('normal', { conditions: ['prone'], dodging: false }, 5)).toBe('advantage')
    expect(attackMode('normal', { conditions: ['prone'], dodging: false }, 30)).toBe('disadvantage')
    expect(attackMode('normal', { conditions: ['prone'], dodging: false }, null)).toBe('disadvantage')
  })

  it('gives advantage against helpless targets, and advantage and disadvantage cancel out', () => {
    for (const condition of ['paralyzed', 'restrained', 'stunned', 'unconscious', 'blinded', 'petrified']) {
      expect(attackMode('normal', { conditions: [condition], dodging: false }, 5)).toBe('advantage')
    }
    expect(attackMode('disadvantage', { conditions: ['stunned'], dodging: false }, 5)).toBe('normal')
    expect(attackMode('advantage', { conditions: [], dodging: true }, 5)).toBe('normal')
  })
})

describe('reach and range', () => {
  const longsword = { range: 'Melee' as const, properties: ['versatile'] }
  const glaive = { range: 'Melee' as const, properties: ['heavy', 'reach', 'two-handed'] }
  const dagger = { range: 'Melee' as const, properties: ['finesse', 'light', 'thrown'], normalRange: 20, longRange: 60 }
  const longbow = { range: 'Ranged' as const, properties: ['ammunition'], normalRange: 150, longRange: 600 }

  it('reads a weapon: 5 feet in melee, 10 with reach, and thrown or shot ranges', () => {
    expect(weaponReach(longsword)).toEqual({ melee: 5, normal: null, long: null })
    expect(weaponReach(glaive)).toEqual({ melee: 10, normal: null, long: null })
    expect(weaponReach(dagger)).toEqual({ melee: 5, normal: 20, long: 60 })
    expect(weaponReach(longbow)).toEqual({ melee: null, normal: 150, long: 600 })
    expect(weaponReach(undefined)).toEqual({ melee: 5, normal: null, long: null })
  })

  it('reads a monster action’s text', () => {
    expect(actionReach('Melee Weapon Attack: +4 to hit, reach 5 ft., one target.')).toEqual({ melee: 5, normal: null, long: null })
    expect(actionReach('Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target.')).toEqual({ melee: null, normal: 80, long: 320 })
    expect(actionReach('Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft.')).toEqual({ melee: 5, normal: 20, long: 60 })
  })

  it('allows what reaches, gives disadvantage beyond normal range, and refuses anything further', () => {
    expect(inReach(weaponReach(longsword), 5)).toEqual({ allowed: true, disadvantage: false, why: null })
    expect(inReach(weaponReach(longsword), 10).allowed).toBe(false)
    expect(inReach(weaponReach(longsword), 25).why).toBe("That's 25 ft away, and it only reaches 5 ft")
    expect(inReach(weaponReach(glaive), 10).allowed).toBe(true)
    expect(inReach(weaponReach(dagger), 40)).toEqual({ allowed: true, disadvantage: true, why: 'Beyond normal range (20 ft)' })
    expect(inReach(weaponReach(longbow), 700).allowed).toBe(false)
  })
})
