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

/**
 * How far an attack reaches, in feet: in melee (5, or 10 with the reach property), and when thrown
 * or shot (normal and long range). Null where it can't be used that way.
 */
export type Reach = { melee: number | null; normal: number | null; long: number | null }

type WeaponLike = { range: 'Melee' | 'Ranged'; properties: string[]; normalRange?: number; longRange?: number }

/** A weapon's reach from its SRD entry; an attack typed in by hand counts as a melee attack. */
export function weaponReach(weapon: WeaponLike | undefined): Reach {
  if (!weapon) return { melee: 5, normal: null, long: null }
  const melee = weapon.range === 'Melee' ? (weapon.properties.includes('reach') ? 10 : 5) : null
  const shot = weapon.range === 'Ranged' || weapon.properties.includes('thrown')
  return {
    melee,
    normal: shot ? (weapon.normalRange ?? null) : null,
    long: shot ? (weapon.longRange ?? weapon.normalRange ?? null) : null,
  }
}

/** A monster's reach from its action's text: "reach 5 ft." and "range 80/320 ft.". */
export function actionReach(desc: string): Reach {
  const reach = /reach (\d+) ?ft/i.exec(desc)
  const range = /range (\d+)(?:\/(\d+))? ?ft/i.exec(desc)
  if (!reach && !range) return { melee: 5, normal: null, long: null }
  return {
    melee: reach ? Number(reach[1]) : null,
    normal: range ? Number(range[1]) : null,
    long: range ? Number(range[2] ?? range[1]) : null,
  }
}

/**
 * How far a monster threatens for opportunity attacks: its longest melee reach ("reach 10 ft."),
 * 5 feet if none of its actions says. Same as the server's reach_ft, between 5 and 30.
 */
export function threatReach(actions: { desc: string }[]): number {
  const reaches = actions.filter((a) => /melee/i.test(a.desc)).map((a) => actionReach(a.desc).melee ?? 5)
  return Math.min(30, Math.max(5, ...reaches))
}

/**
 * Can the attack reach a target this far away? Within melee reach, or normal range, it can; beyond
 * normal range but within long range, at disadvantage; any further, not at all.
 */
export function inReach(reach: Reach, feet: number): { allowed: boolean; disadvantage: boolean; why: string | null } {
  if (reach.melee !== null && feet <= reach.melee) return { allowed: true, disadvantage: false, why: null }
  if (reach.normal !== null && feet <= reach.normal) return { allowed: true, disadvantage: false, why: null }
  if (reach.long !== null && feet <= reach.long) {
    return { allowed: true, disadvantage: true, why: `Beyond normal range (${reach.normal} ft)` }
  }
  const limit = Math.max(reach.melee ?? 0, reach.long ?? 0)
  return { allowed: false, disadvantage: false, why: `That's ${feet} ft away, and it only reaches ${limit} ft` }
}
