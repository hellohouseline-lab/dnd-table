import { beforeAll, describe, expect, it } from 'vitest'
import type { CombatEvent, Combatant, CombatantSecret } from '../../live/combat.ts'
import { loadMonsters, type SrdMonster } from '../../rules/srd/index.ts'
import { conditionOffer } from './conditionOffers.ts'

let monsters: SrdMonster[]
beforeAll(async () => {
  monsters = await loadMonsters()
})

const fighter = (id: string, kind: Combatant['kind'], characterId: string | null = null): Combatant =>
  ({ id, kind, characterId, conditions: [], clocks: [] }) as unknown as Combatant
const fight = {
  combatants: [fighter('elowen', 'character', 'elowen-char'), fighter('goblin', 'monster'), fighter('wolf', 'monster')],
  secrets: [{ combatantId: 'wolf', monster: 'wolf' } as CombatantSecret],
}
const event = (kind: CombatEvent['kind'], actorId: string, targetId: string, shown: CombatEvent['shown']) =>
  ({ id: 'e', kind, actorId, targetId, shown, undone: false }) as CombatEvent
const none = () => []

describe('one click from spells and monster attacks', () => {
  it('offers Paralysed after a failed save against Hold Person, tied to the caster', () => {
    const offer = conditionOffer(
      event('spell', 'elowen', 'goblin', { spell: 'Hold Person', save: 'failed', dc: 13 }),
      fight,
      monsters,
      none,
    )
    expect(offer?.label).toBe('Apply Paralysed')
    expect(offer?.conditions).toEqual([
      {
        condition: 'paralyzed',
        choice: {
          howLong: { kind: 'rounds', rounds: 10 },
          save: { ability: 'wisdom', dc: 13, secret: false },
          caster: { characterId: 'elowen-char', spell: 'Hold Person' },
          escapeDc: null,
        },
      },
    ])
  })

  it('offers Prone after a wolf bites, with the Strength save first', () => {
    const offer = conditionOffer(event('attack', 'wolf', 'elowen', { hit: true, label: 'Bite' }), fight, monsters, none)
    expect(offer).toMatchObject({ label: 'Apply Prone (save first)', resist: { ability: 'strength', dc: 11 } })
  })

  it('offers nothing for a miss, a passed save, or what they already have', () => {
    expect(
      conditionOffer(event('attack', 'wolf', 'elowen', { hit: false, label: 'Bite' }), fight, monsters, none),
    ).toBe(null)
    expect(
      conditionOffer(
        event('spell', 'elowen', 'goblin', { spell: 'Hold Person', save: 'passed' }),
        fight,
        monsters,
        none,
      ),
    ).toBe(null)
    expect(
      conditionOffer(event('attack', 'wolf', 'elowen', { hit: true, label: 'Bite' }), fight, monsters, () => ['prone']),
    ).toBe(null)
    expect(
      conditionOffer(event('spell', 'elowen', 'goblin', { spell: 'Fireball', save: 'failed' }), fight, monsters, none),
    ).toBe(null)
  })
})
