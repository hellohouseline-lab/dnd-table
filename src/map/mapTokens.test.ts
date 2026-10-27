import { describe, expect, it } from 'vitest'
import type { Combatant, Token } from '../live/combat.ts'
import { NO_DEFENCES } from '../rules/damage.ts'
import { FRESH_TURN } from '../rules/turn.ts'
import { sampleFighter, sampleWizard } from '../screens/dev/sampleData.ts'
import { freeSquares, mapTokens, blockedMove } from './mapTokens.ts'

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
  clocks: [],
  stance: 'fighting',
  speed: 30,
  reachFt: 5,
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
  secrets: [{ combatantId: 'g1', name: 'Goblin A', monster: 'goblin', hp: 7, maxHp: 7, ac: 15, ...NO_DEFENCES }],
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

describe('moving through squares', () => {
  const at = (id: string, x: number, y: number, hidden = false) => ({ id, x, y, hidden })
  const tokens = [at('thorin', 0, 0), at('mira', 2, 0), at('goblin', 0, 2), at('ghost', 4, 4, true)]
  const enemy = (t: { id: string }) => (t.id === 'goblin' ? 'Goblin A' : null)
  it('stops a move onto anyone, or through an enemy, but not through a friend or a hidden creature', () => {
    expect(blockedMove(tokens, tokens[0], { x: 0, y: 2 }, enemy)).toBe('Someone is already in that square')
    expect(blockedMove(tokens, tokens[0], { x: 2, y: 0 }, enemy)).toBe('Someone is already in that square')
    expect(blockedMove(tokens, tokens[0], { x: 0, y: 4 }, enemy)).toBe("You can't move through Goblin A's square")
    expect(blockedMove(tokens, tokens[0], { x: 4, y: 0 }, enemy)).toBeNull()
    expect(blockedMove(tokens, tokens[0], { x: 4, y: 4 }, enemy)).toBeNull()
  })
})
