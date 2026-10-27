import { beforeAll, describe, expect, it } from 'vitest'
import {
  afterTheFight,
  attackCause,
  canBreakFree,
  causeClock,
  clockWords,
  fortitudeDc,
  makeClock,
  monsterAttackCause,
  monsterTraitKeys,
  spellCause,
  tickEnd,
  tickStart,
  type ConditionClock,
} from './conditionClocks.ts'
import { loadMonsters, loadSpells, type SrdMonster } from './srd/index.ts'

let monsters: SrdMonster[]
const monster = (index: string) => monsters.find((m) => m.index === index)!
beforeAll(async () => {
  monsters = await loadMonsters()
})

const hold: ConditionClock = makeClock('paralyzed', {
  howLong: { kind: 'rounds', rounds: 10 },
  save: { ability: 'wisdom', dc: 13, secret: false },
  caster: { characterId: 'elowen', spell: 'Hold Person' },
})!

describe('how long a condition lasts', () => {
  it('makes no clock for "until I take it off", and one for anything else', () => {
    expect(makeClock('prone', { howLong: { kind: 'removed' } })).toBeNull()
    expect(makeClock('blinded', { howLong: { kind: 'end-of-turn' } })).toMatchObject({ endOfNextTurn: true })
    expect(makeClock('restrained', { howLong: { kind: 'removed' }, escapeDc: 12 })).toMatchObject({ escapeDc: 12 })
    expect(hold).toMatchObject({ rounds: 10, started: false, owed: false })
  })

  it('says how long is left, and never a secret DC to players', () => {
    expect(clockWords(hold, { casterName: 'Elowen' })).toBe(
      '10 rounds · saves each turn (Wisdom DC 13) · while Elowen concentrates',
    )
    const secret = { ...hold, save: { ability: 'wisdom' as const, dc: 15, secret: true } }
    expect(clockWords(secret, { forPlayers: true })).toBe(
      '10 rounds · saves each turn (Wisdom) · while the caster concentrates',
    )
    expect(clockWords(makeClock('blinded', { howLong: { kind: 'end-of-turn' } })!)).toBe(
      'until the end of its next turn',
    )
  })

  it('counts rounds down as the turn starts, and ends at 0', () => {
    const one = makeClock('frightened', { howLong: { kind: 'rounds', rounds: 1 } })!
    const start = tickStart([hold, one])
    expect(start.kept).toEqual([{ ...hold, rounds: 9, started: true }])
    expect(start.ended.map((c) => c.condition)).toEqual(['frightened'])
  })

  it('ends "until the end of its next turn" only once that turn has started, and asks for saves', () => {
    const blind = makeClock('blinded', { howLong: { kind: 'end-of-turn' } })!
    // Put on during the creature's own turn: it lasts through the next one.
    expect(tickEnd([blind]).ended).toEqual([])
    const started = tickStart([blind, hold]).kept
    const end = tickEnd(started)
    expect(end.ended.map((c) => c.condition)).toEqual(['blinded'])
    expect(end.saves.map((c) => c.condition)).toEqual(['paralyzed'])
  })

  it('lets a minute pass when the fight ends', () => {
    const forever = makeClock('restrained', { howLong: { kind: 'removed' }, escapeDc: 12 })!
    const hour = makeClock('poisoned', { howLong: { kind: 'rounds', rounds: 600 } })!
    const after = afterTheFight([hold, forever, hour])
    expect(after.ended).toEqual([hold])
    expect(after.kept).toEqual([forever, hour])
  })

  it('knows who can break free', () => {
    expect(canBreakFree(makeClock('grappled', { howLong: { kind: 'removed' }, escapeDc: 11 })!)).toBe(true)
    expect(canBreakFree(hold)).toBe(false)
    expect(canBreakFree(undefined)).toBe(false)
  })
})

describe('what causes a condition', () => {
  it('knows the common spells, and fills in the DC and the caster', async () => {
    const spells = await loadSpells()
    for (const index of ['hold-person', 'command', 'entangle', 'hideous-laughter', 'charm-person', 'fear', 'web']) {
      expect(
        spells.some((s) => s.index === index),
        index,
      ).toBe(true)
    }
    const holdPerson = spellCause('hold-person')!
    expect(holdPerson.label).toBe('Apply Paralysed')
    expect(spellCause('hideous-laughter')!.label).toBe('Apply Prone and Incapacitated')
    expect(
      causeClock(holdPerson, 'paralyzed', { dc: 13, caster: { characterId: 'elowen', spell: 'Hold Person' } }),
    ).toEqual({
      howLong: { kind: 'rounds', rounds: 10 },
      save: { ability: 'wisdom', dc: 13, secret: false },
      caster: { characterId: 'elowen', spell: 'Hold Person' },
      escapeDc: null,
    })
    expect(causeClock(spellCause('entangle')!, 'restrained', { dc: 12 }).escapeDc).toBe(12)
    expect(spellCause('fireball')).toBeNull()
  })

  it('reads monster attacks from the free rules', () => {
    expect(monsterAttackCause(monster('wolf'), 'Bite')).toMatchObject({
      conditions: ['prone'],
      resist: { ability: 'strength', dc: 11 },
    })
    expect(monsterAttackCause(monster('giant-frog'), 'Bite')).toMatchObject({
      conditions: ['grappled', 'restrained'],
      escape: true,
      dc: 11,
    })
    expect(monsterAttackCause(monster('giant-crab'), 'Claw')).toMatchObject({ conditions: ['grappled'], dc: 11 })
    expect(monsterAttackCause(monster('ghoul'), 'Claws')).toMatchObject({
      conditions: ['paralyzed'],
      rounds: 10,
      saveEachTurn: 'constitution',
      resist: { ability: 'constitution', dc: 10 },
    })
    expect(monsterAttackCause(monster('giant-spider'), 'Web')).toMatchObject({ conditions: ['restrained'], dc: 12 })
    expect(monsterAttackCause(monster('goblin'), 'Scimitar')).toBeNull()
    expect(monsterAttackCause(monster('ogre'), 'Greatclub')).toBeNull()
    expect(attackCause('Hit: 3 piercing damage.')).toBeNull()
  })

  it('knows Undead Fortitude, and when it can save a zombie', () => {
    expect(monsterTraitKeys(monster('zombie'))).toEqual(['undead-fortitude'])
    expect(monsterTraitKeys(monster('skeleton'))).toEqual([])
    expect(fortitudeDc(8, 'slashing', false)).toBe(13)
    expect(fortitudeDc(8, 'radiant', false)).toBeNull()
    expect(fortitudeDc(8, 'slashing', true)).toBeNull()
  })
})
