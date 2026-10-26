// Armour class, hit points on levelling and what a character can carry (2014 rules).

import { abilityModifier } from '../maths/core.ts'
import type { SrdItem } from '../srd/index.ts'
import type { Scores } from './scores.ts'

export type ArmourClass = {
  ac: number
  /** How it was worked out, in plain words: "Chain mail 16, shield +2". */
  how: string
  /** Heavy armour without the Strength for it: speed is 10 ft lower. */
  slowed: boolean
  stealthDisadvantage: boolean
}

/**
 * AC from what's worn: no armour is 10 + Dexterity (a barbarian adds Constitution, a monk Wisdom,
 * unless the monk has a shield); light armour adds all of Dexterity, medium up to +2, heavy none. A
 * shield adds 2.
 */
export function armourClass(
  scores: Scores,
  worn: { armour: SrdItem | null; shield: boolean },
  classIndex = '',
): ArmourClass {
  const dex = abilityModifier(scores.dexterity)
  const cls = classIndex.toLowerCase()
  const shield = worn.shield ? 2 : 0
  const a = worn.armour?.armour
  if (!worn.armour || !a) {
    let base = 10 + dex
    let how = `No armour: 10 + Dexterity ${sign(dex)}`
    if (cls === 'barbarian') {
      const con = abilityModifier(scores.constitution)
      base += con
      how += `, Unarmoured Defence + Constitution ${sign(con)}`
    } else if (cls === 'monk' && !worn.shield) {
      const wis = abilityModifier(scores.wisdom)
      base += wis
      how += `, Unarmoured Defence + Wisdom ${sign(wis)}`
    }
    return { ac: base + shield, how: how + (shield ? ', shield +2' : ''), slowed: false, stealthDisadvantage: false }
  }
  const fromDex = a.dexBonus ? (a.maxDex === null ? dex : Math.min(a.maxDex, dex)) : 0
  const ac = a.base + fromDex + shield
  const how = `${worn.armour.name} ${a.base}${a.dexBonus ? `, Dexterity ${sign(fromDex)}` : ''}${shield ? ', shield +2' : ''}`
  return {
    ac,
    how,
    slowed: a.strength > 0 && scores.strength < a.strength,
    stealthDisadvantage: a.stealthDisadvantage,
  }
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

/** Hit points at level 1: the whole hit die plus Constitution (at least 1). */
export function firstLevelHp(hitDie: number, constitution: number, extraPerLevel = 0): number {
  return Math.max(1, hitDie + abilityModifier(constitution)) + extraPerLevel
}

/**
 * Hit points a level adds: the average (half the die plus one) or a roll, plus Constitution, at
 * least 1. A hill dwarf's Dwarven Toughness adds 1 more each level.
 */
export function levelHp(hitDie: number, constitution: number, rolled: number | null = null, extraPerLevel = 0): number {
  const die = rolled ?? hitDie / 2 + 1
  return Math.max(1, die + abilityModifier(constitution)) + extraPerLevel
}

/** Carrying capacity in pounds: Strength times 15. */
export function carryingCapacity(strength: number): number {
  return strength * 15
}
