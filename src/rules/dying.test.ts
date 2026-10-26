import { describe, expect, it } from 'vitest'
import { deathSave, deathSavePatch, hitWhileDown, isDying, opportunityThreats, type Threat } from './dying.ts'
import { monsterAttacksPerAction, threatReach } from './turn.ts'

const fresh = { successes: 0, failures: 0, stable: false, dead: false }

describe('death saves', () => {
  it('counts 10 or more as a success and under 10 as a failure', () => {
    expect(deathSave(10, fresh)).toMatchObject({ successes: 1, failures: 0, result: 'success' })
    expect(deathSave(9, fresh)).toMatchObject({ successes: 0, failures: 1, result: 'failure' })
  })

  it('counts a natural 1 as two failures', () => {
    expect(deathSave(1, fresh)).toMatchObject({ failures: 2, result: 'failure' })
    expect(deathSave(1, { ...fresh, failures: 2 })).toMatchObject({ failures: 3, dead: true, result: 'dead' })
  })

  it('brings a character back with a natural 20', () => {
    expect(deathSave(20, { ...fresh, failures: 2 })).toEqual({ ...fresh, result: 'awake' })
  })

  it('makes a character stable on the third success, and dead on the third failure', () => {
    expect(deathSave(15, { ...fresh, successes: 2 })).toMatchObject({ stable: true, result: 'stable' })
    expect(deathSave(4, { ...fresh, failures: 2 })).toMatchObject({ dead: true, result: 'dead' })
  })

  it('counts a hit while down as a failure, two for a critical', () => {
    expect(hitWhileDown(fresh, false)).toMatchObject({ failures: 1, dead: false })
    expect(hitWhileDown({ ...fresh, failures: 1 }, true)).toMatchObject({ failures: 3, dead: true })
    expect(hitWhileDown({ ...fresh, successes: 3, stable: true }, false)).toMatchObject({ stable: false })
  })

  it('ticks the sheet after a death save rolled outside a fight', () => {
    const down = { deathSaveSuccesses: 1, deathSaveFailures: 0, conditions: ['unconscious', 'prone'] }
    expect(deathSavePatch(down, 12)).toEqual({
      deathSaveSuccesses: 2,
      deathSaveFailures: 0,
      stable: false,
      dead: false,
    })
    expect(deathSavePatch(down, 20)).toMatchObject({ currentHp: 1, conditions: ['prone'], deathSaveSuccesses: 0 })
  })

  it('knows who is dying', () => {
    expect(isDying({ currentHp: 0, stable: false, dead: false })).toBe(true)
    expect(isDying({ currentHp: 0, stable: true, dead: false })).toBe(false)
    expect(isDying({ currentHp: 3, stable: false, dead: false })).toBe(false)
  })
})

describe('opportunity attacks', () => {
  const goblin: Threat = {
    id: 'goblin',
    side: 'monster',
    x: 3,
    y: 2,
    reachFt: 5,
    reactionUsed: false,
    down: false,
    conditions: [],
  }
  const thorin = { side: 'character' as const, disengaged: false }

  it('gives a creature a chance when someone leaves its reach', () => {
    expect(opportunityThreats(thorin, { x: 2, y: 2 }, { x: 0, y: 0 }, [goblin])).toEqual(['goblin'])
  })

  it("doesn't for moving about inside its reach, or arriving in it", () => {
    expect(opportunityThreats(thorin, { x: 2, y: 2 }, { x: 2, y: 3 }, [goblin])).toEqual([])
    expect(opportunityThreats(thorin, { x: 0, y: 0 }, { x: 2, y: 2 }, [goblin])).toEqual([])
  })

  it('respects a reach of 10 feet', () => {
    const ogre = { ...goblin, id: 'ogre', reachFt: 10 }
    expect(opportunityThreats(thorin, { x: 2, y: 2 }, { x: 1, y: 2 }, [ogre])).toEqual([])
    expect(opportunityThreats(thorin, { x: 2, y: 2 }, { x: 0, y: 2 }, [ogre])).toEqual(['ogre'])
  })

  it("doesn't when the mover Disengaged, or for allies, or creatures that can't react", () => {
    const leave = (threats: Threat[], disengaged = false) =>
      opportunityThreats({ ...thorin, disengaged }, { x: 2, y: 2 }, { x: 0, y: 0 }, threats)
    expect(leave([goblin], true)).toEqual([])
    expect(leave([{ ...goblin, side: 'character' }])).toEqual([])
    expect(leave([{ ...goblin, reactionUsed: true }])).toEqual([])
    expect(leave([{ ...goblin, down: true }])).toEqual([])
    expect(leave([{ ...goblin, conditions: ['stunned'] }])).toEqual([])
  })

  it("reads a monster's reach from its melee attacks", () => {
    expect(threatReach([{ desc: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target.' }])).toBe(5)
    expect(
      threatReach([
        { desc: 'The ogre makes two attacks.' },
        { desc: 'Melee Weapon Attack: +6 to hit, reach 10 ft., one target.' },
        { desc: 'Ranged Weapon Attack: +6 to hit, range 30/120 ft., one target.' },
      ]),
    ).toBe(10)
    expect(threatReach([])).toBe(5)
  })

  it("counts a monster's attacks from its Multiattack", () => {
    const multi = (desc: string) => [{ name: 'Multiattack', desc }]
    expect(monsterAttacksPerAction([{ name: 'Scimitar', desc: 'Melee Weapon Attack' }])).toBe(1)
    expect(monsterAttacksPerAction(multi('The aboleth makes three tentacle attacks.'))).toBe(3)
    expect(
      monsterAttacksPerAction(
        multi(
          'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
        ),
      ),
    ).toBe(3)
    expect(
      monsterAttacksPerAction(
        multi('The mummy can use its Dreadful Glare and makes one attack with its rotting fist.'),
      ),
    ).toBe(1)
    expect(monsterAttacksPerAction(multi('The hydra makes as many bite attacks as it has heads.'))).toBe(2)
  })
})
