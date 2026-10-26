// A creature's turn, as every screen reads it: what's used and what's left (2014 rules). The server
// keeps the record (supabase/migrations/20261026050000_turn_loop.sql); these mirror its sums so the
// screens can show them, and grey out what can't be done, before the server is asked.

import type { RollMode } from './dice.ts'
import { combineModes } from './dice.ts'

export type TurnRecord = {
  actionUsed: boolean
  /** Attacks made with this turn's Attack action. */
  attacksMade: number
  bonusUsed: boolean
  reactionUsed: boolean
  feetMoved: number
  /** Extra movement this turn, from Dash. */
  extraFeet: number
  disengaged: boolean
  dodging: boolean
}

export const FRESH_TURN: TurnRecord = {
  actionUsed: false,
  attacksMade: 0,
  bonusUsed: false,
  reactionUsed: false,
  feetMoved: 0,
  extraFeet: 0,
  disengaged: false,
  dodging: false,
}

/** How many attacks one Attack action gives: Extra Attack, by class and level. */
export function attacksPerAction(className: string, level: number): number {
  const name = className.trim().toLowerCase()
  if (name === 'fighter') return level >= 20 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1
  if (['barbarian', 'monk', 'paladin', 'ranger'].includes(name) && level >= 5) return 2
  return 1
}

/** Feet of movement left this turn: speed, plus Dash, less what's been walked. */
export function movementLeft(turn: Pick<TurnRecord, 'feetMoved' | 'extraFeet'>, speed: number): number {
  return Math.max(0, speed + turn.extraFeet - turn.feetMoved)
}

/** Attacks left from this turn's action: all of them before acting, none once the action went on something else. */
export function attacksLeft(turn: Pick<TurnRecord, 'actionUsed' | 'attacksMade'>, perAction: number): number {
  if (turn.attacksMade === 0) return turn.actionUsed ? 0 : perAction
  return Math.max(0, perAction - turn.attacksMade)
}

/** Can the action still be spent on something other than attacking (Dash, Dodge, a spell)? */
export function actionFree(turn: Pick<TurnRecord, 'actionUsed' | 'attacksMade'>): boolean {
  return !turn.actionUsed && turn.attacksMade === 0
}

/**
 * Hit or miss, as the server decides it: a natural 20 always hits, a natural 1 always misses,
 * otherwise the total against the armour class.
 */
export function attackHits(natural: number, total: number, armourClass: number): boolean {
  if (natural === 20) return true
  if (natural === 1) return false
  return total >= armourClass
}

export type TargetState = { conditions: string[]; dodging: boolean }

/**
 * Advantage or disadvantage that comes from the target (2014 conditions): Dodging, invisible,
 * prone (advantage from 5 feet, disadvantage from further), and helpless targets.
 * `feet` is the distance to the target, or null with no map.
 */
export function targetEffects(target: TargetState, feet: number | null): { mode: RollMode; reason: string }[] {
  const has = (condition: string) => target.conditions.includes(condition)
  const effects: { mode: RollMode; reason: string }[] = []
  if (target.dodging) effects.push({ mode: 'disadvantage', reason: 'Dodging' })
  if (has('invisible')) effects.push({ mode: 'disadvantage', reason: 'Invisible' })
  if (has('prone')) {
    effects.push(
      feet !== null && feet <= 5
        ? { mode: 'advantage', reason: 'Prone, within 5 feet' }
        : { mode: 'disadvantage', reason: 'Prone, from further away' },
    )
  }
  for (const [condition, reason] of [
    ['blinded', 'Blinded'],
    ['paralyzed', 'Paralysed'],
    ['petrified', 'Petrified'],
    ['restrained', 'Restrained'],
    ['stunned', 'Stunned'],
    ['unconscious', 'Unconscious'],
  ] as const) {
    if (has(condition)) effects.push({ mode: 'advantage', reason })
  }
  return effects
}

/** The attack's mode once the target's state is added to the attacker's own (they cancel out, as always). */
export function attackMode(attacker: RollMode, target: TargetState, feet: number | null): RollMode {
  return combineModes([attacker, ...targetEffects(target, feet).map((e) => e.mode)])
}
