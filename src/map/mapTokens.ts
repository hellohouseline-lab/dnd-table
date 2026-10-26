// Turns tokens into what the battle map draws, for whoever is looking: real monster names for the
// DM, "Unknown creature" for players; your own token marked; only the tokens you may move draggable.

import type { Combatant, CombatantSecret, Token } from '../live/combat.ts'
import type { Character } from '../rules/character.ts'
import { initials } from '../rules/combat.ts'
import type { MapToken } from './BattleMap.tsx'

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
          tone: mine ? 'you' : 'party',
          hidden: token.hidden,
          acting: Boolean(combatant && combatant.id === people.currentId),
          canMove: viewer.isDm || (mine && viewer.playersMove && (viewer.moveNow ?? true)),
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
