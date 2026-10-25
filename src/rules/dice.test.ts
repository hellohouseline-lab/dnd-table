import { describe, expect, it } from 'vitest'
import type { AttackEntry } from './character.ts'
import {
  combineModes,
  diceText,
  keptSum,
  parseDice,
  requestProblem,
  secureDraw,
  settleRoll,
  type DieSides,
  type Draw,
  type RollRequest,
} from './dice.ts'
import {
  abilityCheck,
  attackRoll,
  conditionEffects,
  freeRoll,
  initiativeRoll,
  savingThrow,
  skillCheck,
} from './rolls.ts'

/** A draw that hands out the given numbers in order. */
function fixed(...values: number[]): Draw {
  let i = 0
  return () => values[i++]
}

const d20: RollRequest['dice'] = [{ sides: 20, count: 1 }]
const longswordDamage = { dice: [{ sides: 8 as DieSides, count: 1 }], modifier: 3, type: 'slashing' }

describe('parseDice', () => {
  it('reads counts and sides', () => {
    expect(parseDice('2d6')).toEqual([{ sides: 6, count: 2 }])
    expect(parseDice('d20')).toEqual([{ sides: 20, count: 1 }])
    expect(parseDice('1d8 + 1d6')).toEqual([
      { sides: 8, count: 1 },
      { sides: 6, count: 1 },
    ])
  })

  it('adds dice of the same kind together and leaves out flat bonuses', () => {
    expect(parseDice('1d6+2d6+3')).toEqual([{ sides: 6, count: 3 }])
  })

  it('ignores dice that do not exist and anything else', () => {
    expect(parseDice('1d7')).toEqual([])
    expect(parseDice('')).toEqual([])
    expect(parseDice('lots')).toEqual([])
  })

  it('writes dice back as text', () => {
    expect(diceText(parseDice('2d6+1d4'))).toBe('2d6+1d4')
  })
})

describe('settleRoll', () => {
  it('adds the dice and the bonus', () => {
    const outcome = settleRoll(
      { dice: [{ sides: 6, count: 2 }], modifier: 3, mode: 'normal', damage: null },
      fixed(4, 5),
    )
    expect(outcome.total).toBe(12)
    expect(outcome.natural).toBeNull()
  })

  it('keeps the higher d20 with advantage and the lower with disadvantage', () => {
    const advantage = settleRoll({ dice: d20, modifier: 2, mode: 'advantage', damage: null }, fixed(7, 15))
    expect(advantage.dice).toEqual([
      { sides: 20, value: 7, dropped: true },
      { sides: 20, value: 15, dropped: false },
    ])
    expect(advantage).toMatchObject({ total: 17, natural: 15 })

    const disadvantage = settleRoll({ dice: d20, modifier: 2, mode: 'disadvantage', damage: null }, fixed(7, 15))
    expect(disadvantage).toMatchObject({ total: 9, natural: 7 })
  })

  it('keeps only one die when both d20s match', () => {
    const outcome = settleRoll({ dice: d20, modifier: 0, mode: 'advantage', damage: null }, fixed(11, 11))
    expect(outcome.dice.filter((die) => die.dropped)).toHaveLength(1)
    expect(outcome.total).toBe(11)
  })

  it('throws damage with an attack', () => {
    const outcome = settleRoll({ dice: d20, modifier: 5, mode: 'normal', damage: longswordDamage }, fixed(12, 6))
    expect(outcome.total).toBe(17)
    expect(outcome.damage).toMatchObject({ total: 9, critical: false })
  })

  it('doubles the damage dice on a natural 20, but not the bonus', () => {
    const outcome = settleRoll({ dice: d20, modifier: 5, mode: 'normal', damage: longswordDamage }, fixed(20, 6, 8))
    expect(outcome.damage).toMatchObject({ total: 17, critical: true })
    expect(outcome.damage?.dice).toHaveLength(2)
  })

  it('throws no damage on a natural 1, which always misses', () => {
    const outcome = settleRoll({ dice: d20, modifier: 5, mode: 'normal', damage: longswordDamage }, fixed(1))
    expect(outcome.natural).toBe(1)
    expect(outcome.damage).toBeNull()
  })

  it('uses the d20 that counts for advantage on an attack', () => {
    const outcome = settleRoll(
      { dice: d20, modifier: 5, mode: 'advantage', damage: longswordDamage },
      fixed(1, 20, 4, 4),
    )
    expect(outcome.natural).toBe(20)
    expect(outcome.damage?.critical).toBe(true)
  })

  it('never lets damage go below 0', () => {
    const outcome = settleRoll(
      { dice: d20, modifier: 0, mode: 'normal', damage: { dice: [{ sides: 4, count: 1 }], modifier: -3, type: '' } },
      fixed(10, 1),
    )
    expect(outcome.damage?.total).toBe(0)
  })

  it('treats damage with no dice as flat', () => {
    const outcome = settleRoll(
      { dice: d20, modifier: 5, mode: 'normal', damage: { dice: [], modifier: 4, type: 'bludgeoning' } },
      fixed(20),
    )
    expect(outcome.damage).toMatchObject({ total: 4, critical: true, dice: [] })
  })

  it('ignores advantage on anything but a single d20', () => {
    const outcome = settleRoll(
      { dice: [{ sides: 6, count: 1 }], modifier: 0, mode: 'advantage', damage: null },
      fixed(3),
    )
    expect(outcome.dice).toHaveLength(1)
  })
})

describe('keptSum and secureDraw', () => {
  it('leaves out dropped dice', () => {
    expect(
      keptSum([
        { sides: 20, value: 3, dropped: true },
        { sides: 20, value: 18, dropped: false },
      ]),
    ).toBe(18)
  })

  it('draws whole numbers from 1 to the number of sides, all of them in time', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) seen.add(secureDraw(20))
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })
})

describe('combineModes', () => {
  it('cancels advantage and disadvantage, however many of each', () => {
    expect(combineModes(['advantage', 'disadvantage', 'disadvantage'])).toBe('normal')
    expect(combineModes(['normal', 'advantage', 'advantage'])).toBe('advantage')
    expect(combineModes(['disadvantage'])).toBe('disadvantage')
    expect(combineModes([])).toBe('normal')
  })
})

describe('requestProblem', () => {
  it('accepts an ordinary roll', () => {
    expect(requestProblem({ dice: [{ sides: 6, count: 8 }], mode: 'normal', damage: null })).toBeNull()
  })

  it('explains what the server would refuse', () => {
    expect(requestProblem({ dice: [], mode: 'normal', damage: null })).toMatch(/at least one/)
    expect(requestProblem({ dice: [{ sides: 6, count: 21 }], mode: 'normal', damage: null })).toMatch(/at most 20/)
    expect(requestProblem({ dice: [{ sides: 6, count: 2 }], mode: 'advantage', damage: null })).toMatch(/single d20/)
    expect(
      requestProblem({
        dice: d20,
        mode: 'normal',
        damage: {
          dice: [
            { sides: 6, count: 20 },
            { sides: 8, count: 1 },
          ],
          modifier: 0,
          type: '',
        },
      }),
    ).toMatch(/damage/)
  })
})

const fighter = {
  id: 'c1',
  level: 2,
  scores: { strength: 16, dexterity: 12, constitution: 15, intelligence: 10, wisdom: 12, charisma: 8 },
  saveProficiencies: ['strength', 'constitution'] as const,
  skillProficiencies: ['athletics', 'perception', 'stealth'],
  skillExpertise: ['stealth'],
  conditions: [] as string[],
  exhaustion: 0,
  attacks: [] as AttackEntry[],
}
const character = { ...fighter, saveProficiencies: [...fighter.saveProficiencies] }
const total = (request: RollRequest) => request.parts.reduce((sum, part) => sum + part.value, 0)

describe('ready-made rolls', () => {
  it('rolls an ability check with the ability modifier', () => {
    const request = abilityCheck(character, 'strength')
    expect(request).toMatchObject({
      label: 'Strength check',
      kind: 'check',
      modifier: 3,
      mode: 'normal',
      characterId: 'c1',
    })
    expect(request.parts).toEqual([{ label: 'Strength', value: 3 }])
  })

  it('adds proficiency to a proficient save only', () => {
    expect(savingThrow(character, 'constitution')).toMatchObject({ label: 'Constitution save', modifier: 4 })
    expect(savingThrow(character, 'wisdom')).toMatchObject({ label: 'Wisdom save', modifier: 1 })
  })

  it('breaks a skill into ability, proficiency and expertise', () => {
    const stealth = skillCheck(character, 'stealth')
    expect(stealth.label).toBe('Stealth check')
    expect(stealth.parts.map((part) => part.label)).toEqual(['Dexterity', 'Proficiency', 'Expertise'])
    expect(stealth.modifier).toBe(5)
    expect(total(stealth)).toBe(stealth.modifier)
  })

  it('keeps a +0 ability so the log shows where the bonus came from', () => {
    expect(skillCheck(character, 'history').parts).toEqual([{ label: 'Intelligence', value: 0 }])
  })

  it('rolls initiative as a Dexterity check', () => {
    expect(initiativeRoll(character)).toMatchObject({ label: 'Initiative', kind: 'initiative', modifier: 1 })
  })

  it('rolls a weapon attack with its damage', () => {
    const longsword: AttackEntry = {
      id: 'a1',
      name: 'Longsword',
      weapon: 'longsword',
      proficient: true,
      magicBonus: 1,
      ability: 'strength',
      damageDice: '',
      damageType: '',
    }
    const request = attackRoll(character, longsword)
    expect(request).toMatchObject({ label: 'Longsword', kind: 'attack', modifier: 6 })
    expect(request.damage).toEqual({ dice: [{ sides: 8, count: 1 }], modifier: 4, type: 'slashing' })
  })

  it('rolls an unarmed strike with flat damage of 1 + Strength', () => {
    const unarmed: AttackEntry = {
      id: 'a2',
      name: 'Unarmed strike',
      weapon: null,
      proficient: true,
      magicBonus: 0,
      ability: 'strength',
      damageDice: '',
      damageType: 'Bludgeoning',
    }
    expect(attackRoll(character, unarmed).damage).toEqual({ dice: [], modifier: 4, type: 'bludgeoning' })
  })

  it('passes on advantage and secrecy', () => {
    expect(abilityCheck(character, 'wisdom', { mode: 'advantage', secret: true })).toMatchObject({
      mode: 'advantage',
      secret: true,
    })
  })

  it('makes a free roll with no bonus', () => {
    expect(freeRoll([{ sides: 6, count: 8 }])).toMatchObject({
      label: '8d6',
      kind: 'free',
      modifier: 0,
      mode: 'normal',
    })
    expect(freeRoll(d20, { mode: 'disadvantage' }).mode).toBe('disadvantage')
    expect(freeRoll([{ sides: 6, count: 2 }], { mode: 'advantage' }).mode).toBe('normal')
  })
})

describe('conditions', () => {
  it('gives disadvantage to a poisoned character on checks and attacks, not saves', () => {
    const poisoned = { ...character, conditions: ['poisoned'] }
    expect(abilityCheck(poisoned, 'strength').mode).toBe('disadvantage')
    expect(initiativeRoll(poisoned).mode).toBe('disadvantage')
    expect(savingThrow(poisoned, 'strength').mode).toBe('normal')
  })

  it('names the condition in the log', () => {
    expect(abilityCheck({ ...character, conditions: ['poisoned'] }, 'strength').parts).toContainEqual({
      label: 'Poisoned: disadvantage',
      value: 0,
    })
  })

  it('cancels a condition against advantage the player chose', () => {
    expect(abilityCheck({ ...character, conditions: ['poisoned'] }, 'strength', { mode: 'advantage' }).mode).toBe(
      'normal',
    )
  })

  it('follows exhaustion levels', () => {
    expect(conditionEffects({ conditions: [], exhaustion: 1 }, 'check', 'strength')).toHaveLength(1)
    expect(conditionEffects({ conditions: [], exhaustion: 2 }, 'save', 'strength')).toHaveLength(0)
    expect(conditionEffects({ conditions: [], exhaustion: 3 }, 'save', 'strength')).toHaveLength(1)
    expect(conditionEffects({ conditions: [], exhaustion: 3 }, 'attack', null)).toHaveLength(1)
  })

  it('gives restrained creatures disadvantage on Dexterity saves only', () => {
    expect(conditionEffects({ conditions: ['restrained'], exhaustion: 0 }, 'save', 'dexterity')).toHaveLength(1)
    expect(conditionEffects({ conditions: ['restrained'], exhaustion: 0 }, 'save', 'wisdom')).toHaveLength(0)
  })

  it('gives an invisible attacker advantage', () => {
    expect(conditionEffects({ conditions: ['invisible'], exhaustion: 0 }, 'attack', null)).toEqual([
      { mode: 'advantage', reason: 'Invisible' },
    ])
  })
})
