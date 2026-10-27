// Turns tokens into what the battle map draws, for whoever is looking: real monster names for the
// DM, "Unknown creature" for players; your own token marked; only the tokens you may move draggable.

import type { Combatant, CombatantSecret, Token } from '../live/combat.ts'
import type { Character } from '../rules/character.ts'
import { initials } from '../rules/combat.ts'
import type { MapToken } from './BattleMap.tsx'
import { isOut } from '../rules/talk.ts'

type Viewer = {
  userId: string
  isDm: boolean
  playersMove: boolean
  /** In a fight, players move only on their own turn. */
  moveNow?: boolean
}

type People = {
  characters: Character[]
  combatants: Combatant[]
  secrets: CombatantSecret[]
  currentId: string | null
}

export function mapTokens(tokens: Token[], people: People, viewer: Viewer): MapToken[] {
  return tokens.flatMap((token): MapToken[] => {
    if (token.characterId) {
      const character = people.characters.find((c) => c.id === token.characterId)
      if (!character) return []
      const mine = character.ownerId === viewer.userId
      const combatant = people.combatants.find((c) => c.characterId === character.id)
      return [
        {
          id: token.id,
          x: token.x,
          y: token.y,
          label: initials(character.name),
          name: character.name,
          portrait: character.portraitPath,
          tone: mine ? 'you' : 'party',
          hidden: token.hidden,
          acting: Boolean(combatant && combatant.id === people.currentId),
          canMove: viewer.isDm || (mine && viewer.playersMove && (viewer.moveNow ?? true)),
          down: character.currentHp === 0,
        },
      ]
    }
    const combatant = people.combatants.find((c) => c.id === token.combatantId)
    if (!combatant) return []
    const secret = viewer.isDm ? people.secrets.find((s) => s.combatantId === combatant.id) : undefined
    const name = secret?.name ?? combatant.shownName
    return [
      {
        id: token.id,
        x: token.x,
        y: token.y,
        label: initials(name),
        name,
        tone: 'monster',
        hidden: token.hidden,
        acting: combatant.id === people.currentId,
        canMove: viewer.isDm,
        down: isOut(combatant),
      },
    ]
  })
}

/** Free squares along the top rows for new tokens, so they don't land on top of each other. */
export function freeSquares(taken: { x: number; y: number }[], count: number, startY = 1): { x: number; y: number }[] {
  const squares: { x: number; y: number }[] = []
  for (let y = startY; squares.length < count && y < startY + 20; y++) {
    for (let x = 1; squares.length < count && x < 16; x++) {
      if (!taken.some((t) => t.x === x && t.y === y) && !squares.some((s) => s.x === x && s.y === y))
        squares.push({ x, y })
    }
  }
  return squares
}

type Placed = { id: string; x: number; y: number; hidden: boolean }

/**
 * Why a miniature can't make this move (2014 rules), or null if it can: nobody ends a move in a
 * square that's taken, and nobody moves through an enemy's square on the way (a friend's is fine).
 * Hidden miniatures don't count, so they aren't given away. Same as move_token on the server.
 */
export function blockedMove(
  tokens: Placed[],
  moving: Placed,
  to: { x: number; y: number },
  enemy: (token: Placed) => string | null,
): string | null {
  const others = tokens.filter((t) => t.id !== moving.id && !t.hidden)
  if (others.some((t) => t.x === to.x && t.y === to.y)) return 'Someone is already in that square'
  const steps = Math.max(Math.abs(to.x - moving.x), Math.abs(to.y - moving.y))
  for (let i = 1; i < steps; i++) {
    const x = Math.round(moving.x + ((to.x - moving.x) * i) / steps)
    const y = Math.round(moving.y + ((to.y - moving.y) * i) / steps)
    for (const t of others.filter((o) => o.x === x && o.y === y)) {
      const name = enemy(t)
      if (name) return `You can't move through ${name}'s square`
    }
  }
  return null
}
