import { abilityModifier, proficiencyBonus } from './core.ts'

/** How good a character is at a skill: not trained, proficient, or expertise (double proficiency). */
export type SkillRank = 'none' | 'proficient' | 'expertise'

/** A saving throw: the ability modifier, plus proficiency if the class grants that save. */
export function saveBonus(score: number, proficient: boolean, level: number): number {
  return abilityModifier(score) + (proficient ? proficiencyBonus(level) : 0)
}

/** A skill check: the ability modifier, plus proficiency once, or twice with expertise. */
export function skillBonus(score: number, rank: SkillRank, level: number): number {
  const times = rank === 'expertise' ? 2 : rank === 'proficient' ? 1 : 0
  return abilityModifier(score) + times * proficiencyBonus(level)
}

/** A passive score, such as passive Perception: 10 plus the check bonus. */
export function passiveScore(checkBonus: number): number {
  return 10 + checkBonus
}

/** Initiative is a Dexterity check. */
export function initiativeBonus(dexterity: number): number {
  return abilityModifier(dexterity)
}
