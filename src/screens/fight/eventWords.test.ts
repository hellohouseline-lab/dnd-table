import { describe, expect, it } from 'vitest'
import type { CombatEvent } from '../../live/combat.ts'
import { eventWords } from './eventWords.ts'

const names: Record<string, string> = { thorin: 'Thorin', goblin: 'Goblin A', unknown: 'Unknown creature 2' }
const nameOf = (id: string | null) => (id ? (names[id] ?? 'Someone') : 'Someone')

function attack(shown: CombatEvent['shown'], actorId = 'thorin', targetId = 'goblin'): CombatEvent {
  return {
    id: 'e1',
    encounterId: 'f',
    round: 1,
    actorId,
    targetId,
    kind: 'attack',
    rollId: 'r1',
    shown,
    undone: false,
    seq: 1,
    createdAt: '2026-10-26T20:00:00Z',
  }
}

describe('the feed in plain words', () => {
  it('says who hit whom, with what and for how much', () => {
    expect(
      eventWords(attack({ label: 'Longsword', hit: true, damage: 8, damageType: 'slashing', total: 17 }), { nameOf }),
    ).toBe('Thorin hits Goblin A with Longsword for 8 slashing (rolled 17).')
  })

  it('says "you" for yourself, as attacker or target', () => {
    expect(eventWords(attack({ label: 'Longsword', hit: false, total: 9 }), { nameOf, youId: 'thorin' })).toBe(
      'You miss Goblin A with Longsword (rolled 9).',
    )
    expect(
      eventWords(
        attack({ label: 'Scimitar', hit: true, damage: 5, damageType: 'slashing', total: null }, 'unknown', 'thorin'),
        {
          nameOf,
          youId: 'thorin',
        },
      ),
    ).toBe('Unknown creature 2 hits you with Scimitar for 5 slashing.')
  })

  it('marks critical hits and anyone who goes down', () => {
    expect(
      eventWords(attack({ label: 'Longsword', hit: true, critical: true, damage: 15, down: true }), { nameOf }),
    ).toBe('Thorin hits Goblin A with Longsword for 15. A critical hit! Goblin A goes down.')
  })

  it('says what defences did to the damage', () => {
    expect(
      eventWords(
        attack({ label: 'Ray of Frost', hit: true, damage: 4, damageType: 'cold', adjust: 'resisted', total: 15 }),
        { nameOf },
      ),
    ).toBe('Thorin hits Goblin A with Ray of Frost for 4 cold (resisted, so halved) (rolled 15).')
    expect(
      eventWords(
        attack({ label: 'Poison dart', hit: true, damage: 0, damageType: 'poison', adjust: 'immune', total: 15 }),
        { nameOf },
      ),
    ).toBe('Thorin hits Goblin A with Poison dart (rolled 15), but Goblin A is immune to poison.')
  })

  it('names the actions people take', () => {
    const dash: CombatEvent = { ...attack({}), kind: 'action', targetId: null, shown: { what: 'dash' } }
    expect(eventWords(dash, { nameOf })).toBe('Thorin dashes.')
    expect(eventWords({ ...dash, shown: { what: 'dodge' } }, { nameOf, youId: 'thorin' })).toBe(
      'You take the Dodge action.',
    )
    expect(eventWords({ ...dash, shown: { what: 'bonus' } }, { nameOf })).toBe('Thorin uses their bonus action.')
  })

  it('says an opportunity attack was made as the target moved away', () => {
    expect(
      eventWords(attack({ label: 'Glaive', hit: true, damage: 7, damageType: 'slashing', total: 15, reaction: true }), {
        nameOf,
      }),
    ).toBe('Thorin hits Goblin A with Glaive as they move away for 7 slashing (rolled 15).')
  })

  it('names a feature used in a fight', () => {
    const used = { ...attack({ what: 'bonus', feature: 'Rage' }), kind: 'action' as const }
    expect(eventWords(used, { nameOf })).toBe('Thorin uses Rage.')
    expect(eventWords(used, { nameOf, youId: 'thorin' })).toBe('You use Rage.')
  })

  it('says how death saves went', () => {
    const save = (shown: CombatEvent['shown']) => ({
      ...attack(shown, 'thorin', 'thorin'),
      kind: 'death_save' as const,
    })
    expect(eventWords(save({ result: 'failure', rolled: 6, successes: 0, failures: 1 }), { nameOf })).toBe(
      'Thorin fails a death save (rolled 6): 0 of 3 successes, 1 of 3 failures.',
    )
    expect(
      eventWords(save({ result: 'success', rolled: 12, successes: 1, failures: 1 }), { nameOf, youId: 'thorin' }),
    ).toBe('You succeed on a death save (rolled 12): 1 of 3 successes, 1 of 3 failures.')
    expect(eventWords(save({ result: 'stable', rolled: 14, successes: 3, failures: 1 }), { nameOf })).toBe(
      'Thorin succeeds on a third death save (rolled 14) and is stable.',
    )
    expect(eventWords(save({ result: 'awake', rolled: 20 }), { nameOf, youId: 'thorin' })).toBe(
      'You roll a 20 on a death save and are back up with 1 hit point!',
    )
    expect(eventWords(save({ result: 'dead', rolled: 1 }), { nameOf })).toBe(
      'Thorin fails a third death save (rolled 1). Thorin dies.',
    )
  })

  it('says what a spell did', () => {
    const spell = (shown: CombatEvent['shown'], targetId: string | null = 'goblin') => ({
      ...attack(shown, 'thorin', 'goblin'),
      targetId,
      kind: 'spell' as const,
    })
    expect(eventWords(spell({ spell: 'Darkness', slot: 2 }, null), { nameOf, youId: 'thorin' })).toBe(
      'You cast Darkness.',
    )
    expect(eventWords(spell({ spell: 'Magic Missile', damage: 11, damageType: 'force' }), { nameOf })).toBe(
      "Thorin's Magic Missile hits Goblin A for 11 force.",
    )
    expect(
      eventWords(spell({ spell: 'Fireball', save: 'failed', damage: 28, damageType: 'fire', down: true }), { nameOf }),
    ).toBe('Goblin A fails the save against Fireball and takes 28 fire. Goblin A goes down.')
    expect(
      eventWords(
        spell({ spell: 'Fireball', save: 'passed', saveTotal: 16, damage: 14, damageType: 'fire' }, 'thorin'),
        {
          nameOf,
          youId: 'thorin',
        },
      ),
    ).toBe('You make the save against Fireball (rolled 16) and take 14 fire.')
    expect(eventWords(spell({ spell: 'Hold Person', save: 'failed' }), { nameOf })).toBe(
      'Goblin A fails the save against Hold Person.',
    )
    expect(eventWords(spell({ spell: 'Cure Wounds', heal: 7 }, 'thorin'), { nameOf, youId: 'thorin' })).toBe(
      'Your Cure Wounds heals you for 7.',
    )
  })

  it('says whether concentration held', () => {
    const held = (kept: boolean) => ({
      ...attack({ spell: 'Darkness', dc: 12, total: kept ? 15 : 8, kept }, 'thorin', 'thorin'),
      kind: 'concentration' as const,
    })
    expect(eventWords(held(true), { nameOf })).toBe('Thorin keeps concentrating on Darkness (rolled 15 against DC 12).')
    expect(eventWords(held(false), { nameOf, youId: 'thorin' })).toBe(
      'You lose concentration, and Darkness ends (rolled 8 against DC 12).',
    )
  })
})

describe('conditions in the feed', () => {
  const names = { nameOf: (id: string | null) => (id === 'g' ? 'Goblin A' : 'Thorin'), youId: 't' }
  const line = (shown: CombatEvent['shown'], actorId = 'g') =>
    eventWords(
      {
        id: 'e',
        encounterId: 'f',
        round: 1,
        actorId,
        targetId: actorId,
        kind: 'condition',
        rollId: null,
        shown,
        undone: false,
        seq: 1,
        createdAt: '',
      },
      names,
    )

  it('says what was put on, and for how long', () => {
    expect(line({ condition: 'paralyzed', on: true, rounds: 10, saveEachTurn: 'wisdom', spell: 'Hold Person' })).toBe(
      'Goblin A is now paralysed for 10 rounds, with a Wisdom save each turn, while Hold Person lasts.',
    )
    expect(line({ condition: 'blinded', on: true, endOfNextTurn: true }, 't')).toBe(
      'You are now blinded until the end of your next turn.',
    )
    expect(line({ condition: 'prone', on: true, resisted: false, saveAbility: 'strength', total: 7 }, 't')).toBe(
      'You fail the Strength save (rolled 7) and are now prone.',
    )
    expect(line({ condition: 'prone', on: true, resisted: true, saveAbility: 'strength' })).toBe(
      'Goblin A makes the Strength save and is not prone.',
    )
  })

  it('says how it ended', () => {
    expect(line({ condition: 'frightened', ended: 'time' })).toBe('Goblin A is no longer frightened.')
    expect(line({ condition: 'paralyzed', ended: 'saved' })).toBe('Goblin A shakes off being paralysed.')
    expect(line({ condition: 'paralyzed', still: true })).toBe('Goblin A is still paralysed.')
    expect(line({ condition: 'paralyzed', ended: 'concentration', spell: 'Hold Person' })).toBe(
      'Goblin A is no longer paralysed: Hold Person has ended.',
    )
    expect(line({ condition: 'poisoned', saved: true, total: 15 }, 't')).toBe(
      'You shake off being poisoned (rolled 15).',
    )
    expect(line({ condition: 'prone', stood: true, feet: 15 }, 't')).toBe('You stand up (15 feet of movement).')
    expect(line({ condition: 'grappled', brokeFree: false, total: 6 }, 't')).toBe(
      "You struggle but can't break free (rolled 6).",
    )
  })
})
