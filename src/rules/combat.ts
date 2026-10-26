// Fights by the 2014 rules: turn order, how hurt a monster looks, moving on the grid, and the rolls
// a monster makes. Pure, so the DM's screen, the players' screens and the tests agree.

import { ABILITY_NAME } from './abilities.ts'
import { parseDamage, type RollRequest } from './dice.ts'
import { abilityModifier, formatBonus } from './maths/core.ts'
import type { SrdMonster, SrdMonsterAction } from './srd/index.ts'

export type HealthState = 'healthy' | 'bloodied' | 'near-death' | 'down'

export const HEALTH_WORDS: Record<HealthState, string> = {
  healthy: 'Healthy',
  bloodied: 'Bloodied',
  'near-death': 'Near death',
  down: 'Down',
}

/** How hurt something looks, which is all players learn about a monster: half or less is bloodied. */
export function healthState(hp: number, maxHp: number): HealthState {
  if (hp <= 0) return 'down'
  if (hp * 4 <= maxHp) return 'near-death'
  if (hp * 2 <= maxHp) return 'bloodied'
  return 'healthy'
}

export type TurnEntry = {
  id: string
  initiative: number | null
  /** Breaks ties: the higher Dexterity goes first. */
  tiebreak: number
  createdAt: string
  /** Down monsters are passed over. */
  out?: boolean
}

/** Highest initiative first; ties by Dexterity, then by who joined first. Not yet rolled go last. */
export function turnOrder<T extends TurnEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.initiative === null || b.initiative === null) {
      if (a.initiative !== b.initiative) return a.initiative === null ? 1 : -1
    } else if (a.initiative !== b.initiative) {
      return b.initiative - a.initiative
    }
    if (a.tiebreak !== b.tiebreak) return b.tiebreak - a.tiebreak
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt)
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** Whose turn comes next, and the round: after the last in the order, round + 1 starts at the top. */
export function nextTurn(
  entries: TurnEntry[],
  currentId: string | null,
  round: number,
): { currentId: string | null; round: number } {
  const order = turnOrder(entries).filter((e) => !e.out && e.initiative !== null)
  if (order.length === 0) return { currentId: null, round }
  const all = turnOrder(entries)
  const at = currentId ? all.findIndex((e) => e.id === currentId) : -1
  if (at < 0) return { currentId: order[0].id, round }
  const after = all.slice(at + 1).find((e) => !e.out && e.initiative !== null)
  return after ? { currentId: after.id, round } : { currentId: order[0].id, round: round + 1 }
}

/** The next one after `currentId` in the order, for the "Next" label. */
export function upNext(entries: TurnEntry[], currentId: string | null, round: number): string | null {
  if (!currentId) return null
  const next = nextTurn(entries, currentId, round).currentId
  return next === currentId ? null : next
}

export type Square = { x: number; y: number }

/**
 * Squares between two places on the grid, counting a diagonal step as one square (the Player's
 * Handbook rule): 5 feet each.
 */
export function squaresBetween(a: Square, b: Square): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function feetBetween(a: Square, b: Square): number {
  return 5 * squaresBetween(a, b)
}

/**
 * Where miniatures start a fight: free squares filling columns of six from `firstColumn`, so the
 * party lines up down one side and the monsters a few squares away. The DM can drag them anywhere.
 */
export function startingSquares(taken: Square[], count: number, firstColumn: number): Square[] {
  const squares: Square[] = []
  for (let x = firstColumn; squares.length < count && x < firstColumn + 20; x++) {
    for (let y = 1; squares.length < count && y <= 6; y++) {
      if (!taken.some((t) => t.x === x && t.y === y)) squares.push({ x, y })
    }
  }
  return squares
}

/** "DF" for Dwarf Fighter, "E" for Elowen; "?2" for an unknown creature number 2. */
export function initials(name: string): string {
  const unknown = /^Unknown creature (\d+)$/.exec(name)
  if (unknown) return `?${unknown[1]}`
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
}

/** Names for new monsters of one kind: "Goblin A", "Goblin B", carrying on from any already there. */
export function letteredNames(base: string, taken: string[], count: number): string[] {
  const names: string[] = []
  for (let i = 0; names.length < count && i < 26 * 4; i++) {
    const letter = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26) + 1) : '')
    const name = `${base} ${letter}`
    if (!taken.includes(name)) names.push(name)
  }
  return names
}

/** What players see for new monsters until the DM reveals them: "Unknown creature 3", and so on. */
export function unknownNames(shown: string[], count: number): string[] {
  const used = shown.map((name) => Number(/^Unknown creature (\d+)$/.exec(name)?.[1] ?? 0))
  const start = Math.max(0, ...used) + 1
  return Array.from({ length: count }, (_, i) => `Unknown creature ${start + i}`)
}

/** A monster's six saving throw bonuses: its stat block's where it lists one, otherwise the ability modifier. */
export function monsterSaves(monster: Pick<SrdMonster, 'scores' | 'saves'>): Record<string, number> {
  return Object.fromEntries(
    (Object.keys(ABILITY_NAME) as (keyof typeof ABILITY_NAME)[]).map((ability) => [
      ability,
      monster.saves?.[ability] ?? abilityModifier(monster.scores[ability]),
    ]),
  )
}

/** A monster's initiative: a d20 plus its Dexterity modifier, behind the screen. */
export function monsterInitiative(monster: Pick<SrdMonster, 'scores'>): RollRequest {
  const dex = abilityModifier(monster.scores.dexterity)
  return {
    label: 'Initiative',
    kind: 'initiative',
    characterId: null,
    dice: [{ sides: 20, count: 1 }],
    modifier: dex,
    parts: [{ label: ABILITY_NAME.dexterity, value: dex }],
    mode: 'normal',
    damage: null,
    secret: true,
    requestId: null,
  }
}

/** Whether an action can be rolled as an attack (it has a to-hit bonus). */
export function isAttack(action: SrdMonsterAction): boolean {
  return typeof action.attackBonus === 'number'
}

/** A monster's attack, thrown behind the screen: to hit and damage together, as for a character. */
export function monsterAttack(name: string, action: SrdMonsterAction, secret = true): RollRequest {
  const bonus = action.attackBonus ?? 0
  const damage = parseDamage(action.damage.map((d) => d.dice).join('+'))
  return {
    label: `${name}: ${action.name}`,
    kind: 'attack',
    characterId: null,
    dice: [{ sides: 20, count: 1 }],
    modifier: bonus,
    parts: [{ label: 'Attack bonus', value: bonus }],
    mode: 'normal',
    damage:
      action.damage.length > 0 ? { dice: damage.dice, modifier: damage.bonus, type: action.damage[0].type } : null,
    secret,
    requestId: null,
  }
}

/** "+4 to hit · 1d6+2 slashing", or the start of its description when it isn't an attack. */
export function actionSummary(action: SrdMonsterAction): string {
  if (isAttack(action)) {
    const damage = action.damage.map((d) => `${d.dice} ${d.type}`).join(' + ')
    return `${formatBonus(action.attackBonus ?? 0)} to hit${damage ? ` · ${damage}` : ''}`
  }
  if (action.dc) return `DC ${action.dc.value} ${ABILITY_NAME[action.dc.ability]} save`
  const first = action.desc.split(/(?<=\.)\s/)[0] ?? ''
  return first.length > 90 ? `${first.slice(0, 87)}…` : first
}

/** "1/4", "2": a challenge rating as the books write it. */
export function crText(cr: number): string {
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}
