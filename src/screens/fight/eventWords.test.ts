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
})
