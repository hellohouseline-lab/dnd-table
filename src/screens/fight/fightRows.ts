// The turn order as each screen shows it: real names and hit points for the DM; for players, what
// the party knows (a monster's shown name and how hurt it looks).

import type { Combatant, CombatantSecret } from '../../live/combat.ts'
import type { Character } from '../../rules/character.ts'
import { healthState, turnOrder, upNext, type HealthState } from '../../rules/combat.ts'
import { attacksPerAction } from '../../rules/turn.ts'

export type FightRow = {
  combatant: Combatant
  name: string
  /** For the DM: a monster players still see as "Unknown creature". */
  unrevealed: boolean
  hp: { current: number; max: number } | null
  health: HealthState
  conditions: string[]
  status: 'acting' | 'next' | 'done' | null
  character: Character | null
  secret: CombatantSecret | null
}

type FightLike = {
  encounter: { currentId: string | null; round: number }
  combatants: Combatant[]
  secrets: CombatantSecret[]
}

export function fightRows(fight: FightLike, characters: Character[], viewer: 'dm' | 'player'): FightRow[] {
  const entries = fight.combatants.map((c) => ({ ...c, out: c.kind === 'monster' && c.health === 'down' }))
  const order = turnOrder(entries)
  const { currentId, round } = fight.encounter
  const next = upNext(entries, currentId, round)
  const at = currentId ? order.findIndex((c) => c.id === currentId) : -1

  return order.map((combatant, i) => {
    const character = combatant.characterId ? (characters.find((c) => c.id === combatant.characterId) ?? null) : null
    const secret = viewer === 'dm' ? (fight.secrets.find((s) => s.combatantId === combatant.id) ?? null) : null
    const hp = character
      ? { current: character.currentHp, max: character.maxHp }
      : secret
        ? { current: secret.hp, max: secret.maxHp }
        : null
    return {
      combatant,
      name: character?.name ?? secret?.name ?? combatant.shownName,
      unrevealed: combatant.kind === 'monster' && !combatant.revealed,
      hp,
      health: character ? healthState(character.currentHp, character.maxHp) : combatant.health,
      conditions: character ? character.conditions : combatant.conditions,
      status:
        combatant.id === currentId ? 'acting' : combatant.id === next ? 'next' : at >= 0 && i < at ? 'done' : null,
      character,
      secret,
    }
  })
}

/** The camera column in a fight: tiles in turn order with the DM last for the monsters, and whose turn it is. */
export type CameraTurn = { order: string[]; acting: string | null; next: string | null }

export function cameraTurn(rows: FightRow[], dmId: string): CameraTurn {
  const whose = (row: FightRow | undefined) => (row ? (row.character?.ownerId ?? dmId) : null)
  const order = [...new Set(rows.flatMap((row) => (row.character ? [row.character.ownerId] : [])))]
  return {
    order: [...order.filter((id) => id !== dmId), dmId],
    acting: whose(rows.find((row) => row.status === 'acting')),
    next: whose(rows.find((row) => row.status === 'next')),
  }
}

/** Attacks one Attack action gives this combatant, and its speed: from the sheet for characters. */
export function turnLimits(row: FightRow): { perAction: number; speed: number } {
  return row.character
    ? { perAction: attacksPerAction(row.character.className, row.character.level), speed: row.character.speed }
    : { perAction: 1, speed: row.combatant.speed }
}
