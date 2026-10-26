import { describe, expect, it } from 'vitest'
import {
  actionSummary,
  feetBetween,
  healthState,
  initials,
  letteredNames,
  monsterAttack,
  monsterInitiative,
  nextTurn,
  startingSquares,
  turnOrder,
  unknownNames,
  upNext,
  type TurnEntry,
} from './combat.ts'
import { parseDamage } from './dice.ts'
import type { SrdMonsterAction } from './srd/index.ts'

const at = (n: number) => `2026-10-26T20:00:0${n}Z`
const fighter: TurnEntry = { id: 'fighter', initiative: 18, tiebreak: 14, createdAt: at(1) }
const goblinA: TurnEntry = { id: 'goblinA', initiative: 15, tiebreak: 14, createdAt: at(2) }
const wizard: TurnEntry = { id: 'wizard', initiative: 15, tiebreak: 16, createdAt: at(3) }
const goblinB: TurnEntry = { id: 'goblinB', initiative: 9, tiebreak: 14, createdAt: at(4) }
const late: TurnEntry = { id: 'late', initiative: null, tiebreak: 10, createdAt: at(0) }
const fight = [goblinB, late, goblinA, fighter, wizard]

describe('turn order', () => {
  it('goes from the highest initiative down, ties to the higher Dexterity, unrolled last', () => {
    expect(turnOrder(fight).map((e) => e.id)).toEqual(['fighter', 'wizard', 'goblinA', 'goblinB', 'late'])
  })

  it('moves to the next turn and starts a new round after the last', () => {
    expect(nextTurn(fight, null, 1)).toEqual({ currentId: 'fighter', round: 1 })
    expect(nextTurn(fight, 'fighter', 1)).toEqual({ currentId: 'wizard', round: 1 })
    expect(nextTurn(fight, 'goblinB', 1)).toEqual({ currentId: 'fighter', round: 2 })
  })

  it('passes over monsters that are down and anyone without initiative', () => {
    const withDown = fight.map((e) => (e.id === 'goblinA' ? { ...e, out: true } : e))
    expect(nextTurn(withDown, 'wizard', 3)).toEqual({ currentId: 'goblinB', round: 3 })
    expect(upNext(withDown, 'wizard', 3)).toBe('goblinB')
  })

  it('has nobody to go when nobody has rolled', () => {
    expect(nextTurn([late], null, 1)).toEqual({ currentId: null, round: 1 })
  })
})

describe('health', () => {
  it('describes a monster without giving away its hit points', () => {
    expect([7, 4, 3, 1, 0].map((hp) => healthState(hp, 7))).toEqual([
      'healthy',
      'healthy',
      'bloodied',
      'near-death',
      'down',
    ])
    expect(healthState(10, 20)).toBe('bloodied')
    expect(healthState(5, 20)).toBe('near-death')
  })
})

describe('the grid', () => {
  it('counts a diagonal step as 5 feet', () => {
    expect(feetBetween({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(15)
    expect(feetBetween({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(15)
    expect(feetBetween({ x: 2, y: 5 }, { x: 0, y: 0 })).toBe(25)
  })
})

describe('names', () => {
  it('makes token initials', () => {
    expect(initials('Dwarf Fighter')).toBe('DF')
    expect(initials('Elowen')).toBe('EL')
    expect(initials('Unknown creature 2')).toBe('?2')
  })

  it('letters monsters of one kind, carrying on from those already there', () => {
    expect(letteredNames('Goblin', [], 2)).toEqual(['Goblin A', 'Goblin B'])
    expect(letteredNames('Goblin', ['Goblin A'], 2)).toEqual(['Goblin B', 'Goblin C'])
  })

  it('numbers unknown creatures', () => {
    expect(unknownNames([], 2)).toEqual(['Unknown creature 1', 'Unknown creature 2'])
    expect(unknownNames(['Unknown creature 2', 'Thorin'], 1)).toEqual(['Unknown creature 3'])
  })
})

const scimitar: SrdMonsterAction = {
  name: 'Scimitar',
  desc: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
  attackBonus: 4,
  damage: [{ dice: '1d6+2', type: 'slashing' }],
}

describe('monster rolls', () => {
  it('rolls initiative with Dexterity, behind the screen', () => {
    expect(
      monsterInitiative({
        scores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
      }),
    ).toMatchObject({
      kind: 'initiative',
      modifier: 2,
      secret: true,
    })
  })

  it('rolls an attack with its damage, behind the screen', () => {
    expect(monsterAttack('Goblin A', scimitar)).toMatchObject({
      label: 'Goblin A: Scimitar',
      kind: 'attack',
      modifier: 4,
      secret: true,
      damage: { dice: [{ sides: 6, count: 1 }], modifier: 2, type: 'slashing' },
    })
  })

  it('sums damage from several dice', () => {
    expect(parseDamage('2d8+1d6-1')).toEqual({
      dice: [
        { sides: 8, count: 2 },
        { sides: 6, count: 1 },
      ],
      bonus: -1,
    })
    expect(parseDamage('3')).toEqual({ dice: [], bonus: 3 })
  })

  it('sums up an action for the Acting now card', () => {
    expect(actionSummary(scimitar)).toBe('+4 to hit · 1d6+2 slashing')
    expect(
      actionSummary({ name: 'Multiattack', desc: 'The bugbear makes two attacks. Then it rests.', damage: [] }),
    ).toBe('The bugbear makes two attacks.')
  })
})

describe('where miniatures start a fight', () => {
  it('fills columns of six from the given column, skipping squares already taken', () => {
    expect(startingSquares([], 3, 1)).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ])
    expect(startingSquares([{ x: 7, y: 1 }], 7, 7)).toEqual([
      { x: 7, y: 2 },
      { x: 7, y: 3 },
      { x: 7, y: 4 },
      { x: 7, y: 5 },
      { x: 7, y: 6 },
      { x: 8, y: 1 },
      { x: 8, y: 2 },
    ])
  })
})
