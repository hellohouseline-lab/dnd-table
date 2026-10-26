import { describe, expect, it } from 'vitest'
import type { Combatant, Token } from '../live/combat.ts'
import { FRESH_TURN } from '../rules/turn.ts'
import { sampleFighter, sampleWizard } from '../screens/dev/sampleData.ts'
import { freeSquares, mapTokens } from './mapTokens.ts'

const goblin: Combatant = {
  id: 'g1',
  encounterId: 'e',
  campaignId: 'c',
  kind: 'monster',
  characterId: null,
  shownName: 'Unknown creature 1',
  revealed: false,
  initiative: 12,
  tiebreak: 14,
  health: 'healthy',
  conditions: [],
  speed: 30,
  turn: FRESH_TURN,
  createdAt: '2026-10-26T20:00:00Z',
}
const token = (id: string, patch: Partial<Token>): Token => ({
  id,
  campaignId: 'c',
  mapId: 'm',
  characterId: null,
  combatantId: null,
  x: 1,
  y: 1,
  hidden: false,
  ...patch,
})
const tokens = [
  token('t1', { characterId: sampleFighter.id }),
  token('t2', { characterId: sampleWizard.id }),
  token('t3', { combatantId: 'g1', hidden: true }),
]
const people = {
  characters: [sampleFighter, sampleWizard],
  combatants: [goblin],
  secrets: [{ combatantId: 'g1', name: 'Goblin A', monster: 'goblin', hp: 7, maxHp: 7, ac: 15 }],
  currentId: 'g1',
}

describe('tokens on the map', () => {
  it('shows a player their own token as theirs, and lets them move only that one', () => {
    const view = mapTokens(
      tokens,
      { ...people, secrets: [] },
      { userId: sampleFighter.ownerId, isDm: false, playersMove: true },
    )
    expect(view.map((t) => [t.label, t.tone, t.canMove])).toEqual([
      ['TI', 'you', true],
      ['EL', 'party', false],
      ['?1', 'monster', false],
    ])
  })

  it('stops players moving when the DM says so', () => {
    const view = mapTokens(tokens, people, { userId: sampleFighter.ownerId, isDm: false, playersMove: false })
    expect(view[0].canMove).toBe(false)
  })

  it('shows the DM real names and lets them move everything', () => {
    const view = mapTokens(tokens, people, { userId: 'dm', isDm: true, playersMove: true })
    expect(view[2]).toMatchObject({ name: 'Goblin A', label: 'GA', hidden: true, acting: true, canMove: true })
  })

  it('finds free squares for new tokens', () => {
    expect(freeSquares([{ x: 1, y: 1 }], 2)).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
  })
})
