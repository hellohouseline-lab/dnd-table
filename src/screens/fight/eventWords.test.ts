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
})
