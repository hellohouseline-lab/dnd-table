// Ability scores for a new character (2014 rules): the standard array, point buy, 4d6 drop the
// lowest, and a suggestion for where each score goes for a class. Racial bonuses go on top.

import { ABILITIES, type Ability } from '../abilities.ts'

export type Scores = Record<Ability, number>

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

/** Point buy: 27 points, scores 8 to 15 before racial bonuses, with these costs. */
export const POINT_BUY_BUDGET = 27
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

/** What a set of scores costs in points; null if any score is outside 8 to 15. */
export function pointBuyCost(scores: Scores): number | null {
  let total = 0
  for (const ability of ABILITIES) {
    const cost = POINT_COST[scores[ability]]
    if (cost === undefined) return null
    total += cost
  }
  return total
}

/** Points left to spend, and whether one score can go up or down from here. */
export function pointBuyRoom(scores: Scores, ability: Ability): { left: number; up: boolean; down: boolean } {
  const left = POINT_BUY_BUDGET - (pointBuyCost(scores) ?? POINT_BUY_BUDGET)
  const score = scores[ability]
  const step = score < 15 ? POINT_COST[score + 1] - POINT_COST[score] : Infinity
  return { left, up: score < 15 && step <= left, down: score > 8 }
}

/** 4d6, the lowest dropped. */
export function fourDropLowest(dice: [number, number, number, number]): number {
  const sorted = [...dice].sort((a, b) => a - b)
  return sorted[1] + sorted[2] + sorted[3]
}

/** The abilities that matter most for each class, best first; Constitution comes next for everyone. */
const PRIORITY: Record<string, Ability[]> = {
  barbarian: ['strength', 'constitution', 'dexterity'],
  bard: ['charisma', 'dexterity'],
  cleric: ['wisdom', 'strength', 'constitution'],
  druid: ['wisdom', 'constitution', 'dexterity'],
  fighter: ['strength', 'constitution', 'dexterity'],
  monk: ['dexterity', 'wisdom', 'constitution'],
  paladin: ['strength', 'charisma', 'constitution'],
  ranger: ['dexterity', 'wisdom', 'constitution'],
  rogue: ['dexterity', 'constitution', 'intelligence'],
  sorcerer: ['charisma', 'constitution', 'dexterity'],
  warlock: ['charisma', 'constitution', 'dexterity'],
  wizard: ['intelligence', 'constitution', 'dexterity'],
}

/** The order to hand out scores for a class: its main abilities, Constitution, then the rest. */
export function abilityOrder(classIndex: string): Ability[] {
  const first = PRIORITY[classIndex.toLowerCase()] ?? ['constitution']
  const withCon = first.includes('constitution') ? first : [...first, 'constitution']
  return [...withCon, ...ABILITIES.filter((a) => !withCon.includes(a))] as Ability[]
}

/** Six values dealt onto the abilities, best to the class's main ones ("Suggest for a Wizard"). */
export function suggestScores(values: readonly number[], classIndex: string): Scores {
  const sorted = [...values].sort((a, b) => b - a)
  const order = abilityOrder(classIndex)
  return Object.fromEntries(order.map((ability, i) => [ability, sorted[i] ?? 8])) as Scores
}

/** Racial bonuses on top, never above 20. */
export function withBonuses(scores: Scores, ...bonuses: Partial<Record<Ability, number>>[]): Scores {
  const out = { ...scores }
  for (const set of bonuses) {
    for (const [ability, bonus] of Object.entries(set) as [Ability, number][]) {
      out[ability] = Math.min(20, out[ability] + bonus)
    }
  }
  return out
}

/**
 * An ability score increase at a level: +2 to one score, or +1 to two. Null if the choice breaks
 * the rules (more than 2 points, or a score past 20).
 */
export function applyIncrease(scores: Scores, increase: Partial<Record<Ability, number>>): Scores | null {
  const entries = Object.entries(increase).filter(([, n]) => n) as [Ability, number][]
  const total = entries.reduce((sum, [, n]) => sum + n, 0)
  if (total !== 2 || entries.some(([, n]) => n < 0 || n > 2)) return null
  const out = { ...scores }
  for (const [ability, n] of entries) {
    if (out[ability] + n > 20) return null
    out[ability] += n
  }
  return out
}
