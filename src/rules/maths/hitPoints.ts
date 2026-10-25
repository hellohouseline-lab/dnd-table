import { abilityModifier, clampLevel } from './core.ts'

export type HitPoints = { current: number; max: number; temp: number }

/** Damage comes off temporary hit points first, then real ones, and never goes below 0. */
export function takeDamage(hp: HitPoints, amount: number): HitPoints {
  const damage = Math.max(0, Math.trunc(amount))
  const fromTemp = Math.min(hp.temp, damage)
  return { ...hp, temp: hp.temp - fromTemp, current: Math.max(0, hp.current - (damage - fromTemp)) }
}

/** Healing restores real hit points up to the maximum. It never adds temporary ones. */
export function heal(hp: HitPoints, amount: number): HitPoints {
  const healing = Math.max(0, Math.trunc(amount))
  return { ...hp, current: Math.min(hp.max, hp.current + healing) }
}

/** Temporary hit points don't stack: you keep whichever is higher, the old or the new. */
export function gainTempHp(hp: HitPoints, amount: number): HitPoints {
  return { ...hp, temp: Math.max(hp.temp, Math.max(0, Math.trunc(amount))) }
}

/**
 * The usual maximum hit points: the full hit die at level 1, then the fixed average
 * (half the die plus one) for each level after, with the Constitution modifier every level.
 * Each level adds at least 1.
 */
export function suggestedMaxHp(hitDie: number, constitution: number, level: number): number {
  const con = abilityModifier(constitution)
  const first = Math.max(1, hitDie + con)
  const perLevel = Math.max(1, hitDie / 2 + 1 + con)
  return first + (clampLevel(level) - 1) * perLevel
}
