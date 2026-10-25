import type { Ability, AbilityScores } from '../abilities.ts'
import { abilityModifier, proficiencyBonus } from './core.ts'

/** What the attack maths needs to know about a weapon (from the SRD weapon list). */
export type WeaponStats = {
  name: string
  range: 'Melee' | 'Ranged'
  damageDice: string
  damageType: string
  /** SRD property indexes: 'finesse', 'thrown', 'versatile', 'light', 'heavy' and so on. */
  properties: string[]
  versatileDice?: string
}

export type AttackResult = {
  ability: Ability
  toHit: number
  damage: string
  /** Two-handed damage for a versatile weapon. */
  versatileDamage?: string
  damageType: string
}

/**
 * Which ability a weapon attack uses. Melee weapons use Strength and ranged weapons Dexterity;
 * a finesse weapon uses whichever is better. Thrown melee weapons still use their melee ability.
 */
export function weaponAbility(weapon: Pick<WeaponStats, 'range' | 'properties'>, scores: AbilityScores): Ability {
  if (weapon.properties.includes('finesse')) {
    return scores.dexterity > scores.strength ? 'dexterity' : 'strength'
  }
  return weapon.range === 'Ranged' ? 'dexterity' : 'strength'
}

/** The attack bonus and damage for a weapon, as written on a character sheet. */
export function weaponAttack(
  weapon: WeaponStats,
  scores: AbilityScores,
  level: number,
  proficient: boolean,
  magicBonus = 0,
): AttackResult {
  const ability = weaponAbility(weapon, scores)
  const modifier = abilityModifier(scores[ability])
  return {
    ability,
    toHit: modifier + (proficient ? proficiencyBonus(level) : 0) + magicBonus,
    damage: damageText(weapon.damageDice, modifier + magicBonus),
    versatileDamage: weapon.versatileDice ? damageText(weapon.versatileDice, modifier + magicBonus) : undefined,
    damageType: weapon.damageType,
  }
}

/** An attack typed in by hand (an unarmed strike, a natural weapon): the player picks the ability. */
export function customAttack(
  attack: { ability: Ability; damageDice: string; damageType: string },
  scores: AbilityScores,
  level: number,
  proficient: boolean,
  magicBonus = 0,
): AttackResult {
  const modifier = abilityModifier(scores[attack.ability])
  return {
    ability: attack.ability,
    toHit: modifier + (proficient ? proficiencyBonus(level) : 0) + magicBonus,
    damage: damageText(attack.damageDice, modifier + magicBonus),
    damageType: attack.damageType,
  }
}

/**
 * '1d8' and +3 give '1d8+3'; a bonus of 0 gives just '1d8'; −1 gives '1d8−1'. With no dice the
 * damage is flat, as for an unarmed strike: 1 + the bonus.
 */
export function damageText(dice: string, bonus: number): string {
  if (!dice) return String(flatDamage(bonus))
  if (bonus === 0) return dice
  return bonus > 0 ? `${dice}+${bonus}` : `${dice}−${Math.abs(bonus)}`
}

/** Damage with no dice, such as an unarmed strike: 1 + the bonus, never below 0. */
export function flatDamage(bonus: number): number {
  return Math.max(0, 1 + bonus)
}

/** Spell save DC: 8 + proficiency + the spellcasting ability's modifier. */
export function spellSaveDc(score: number, level: number): number {
  return 8 + proficiencyBonus(level) + abilityModifier(score)
}

/** Spell attack bonus: proficiency + the spellcasting ability's modifier. */
export function spellAttackBonus(score: number, level: number): number {
  return proficiencyBonus(level) + abilityModifier(score)
}
