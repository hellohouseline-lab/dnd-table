// Works out every number on the sheet from what was typed in. Pure, so the same maths runs on
// the player's screen, the DM's screen and in tests.

import { ABILITIES, type Ability } from './abilities.ts'
import type { AttackEntry, Character } from './character.ts'
import { customAttack, spellAttackBonus, spellSaveDc, weaponAttack, type AttackResult } from './maths/attacks.ts'
import { initiativeBonus, passiveScore, saveBonus, skillBonus, type SkillRank } from './maths/checks.ts'
import { abilityModifier, clampLevel, proficiencyBonus } from './maths/core.ts'
import { findWeapon, SKILLS } from './srd/index.ts'

export type DerivedSave = { ability: Ability; proficient: boolean; bonus: number }
export type DerivedSkill = { index: string; name: string; ability: Ability; rank: SkillRank; bonus: number }
export type DerivedAttack = { entry: AttackEntry; result: AttackResult }

export type DerivedSheet = {
  proficiencyBonus: number
  modifiers: Record<Ability, number>
  saves: DerivedSave[]
  skills: DerivedSkill[]
  passivePerception: number
  passiveInsight: number
  passiveInvestigation: number
  initiative: number
  attacks: DerivedAttack[]
  spell: { ability: Ability; saveDc: number; attackBonus: number } | null
  hitDice: { die: number; total: number; left: number }
}

type SheetInput = Pick<
  Character,
  | 'level'
  | 'scores'
  | 'saveProficiencies'
  | 'skillProficiencies'
  | 'skillExpertise'
  | 'attacks'
  | 'spellcasting'
  | 'hitDie'
  | 'hitDiceUsed'
>

export function skillRank(
  character: Pick<Character, 'skillProficiencies' | 'skillExpertise'>,
  skill: string,
): SkillRank {
  if (character.skillExpertise.includes(skill)) return 'expertise'
  return character.skillProficiencies.includes(skill) ? 'proficient' : 'none'
}

export function deriveSheet(character: SheetInput): DerivedSheet {
  const { level, scores } = character
  const skills = SKILLS.map((skill) => {
    const rank = skillRank(character, skill.index)
    return { ...skill, rank, bonus: skillBonus(scores[skill.ability], rank, level) }
  })
  const passive = (index: string) => passiveScore(skills.find((skill) => skill.index === index)?.bonus ?? 0)
  const spellAbility = character.spellcasting.ability
  const totalHitDice = clampLevel(level)

  return {
    proficiencyBonus: proficiencyBonus(level),
    modifiers: Object.fromEntries(ABILITIES.map((a) => [a, abilityModifier(scores[a])])) as Record<Ability, number>,
    saves: ABILITIES.map((ability) => {
      const proficient = character.saveProficiencies.includes(ability)
      return { ability, proficient, bonus: saveBonus(scores[ability], proficient, level) }
    }),
    skills,
    passivePerception: passive('perception'),
    passiveInsight: passive('insight'),
    passiveInvestigation: passive('investigation'),
    initiative: initiativeBonus(scores.dexterity),
    attacks: character.attacks.map((entry) => {
      const weapon = findWeapon(entry.weapon)
      const result = weapon
        ? weaponAttack(weapon, scores, level, entry.proficient, entry.magicBonus)
        : customAttack(entry, scores, level, entry.proficient, entry.magicBonus)
      return { entry, result }
    }),
    spell: spellAbility
      ? {
          ability: spellAbility,
          saveDc: spellSaveDc(scores[spellAbility], level),
          attackBonus: spellAttackBonus(scores[spellAbility], level),
        }
      : null,
    hitDice: { die: character.hitDie, total: totalHitDice, left: Math.max(0, totalHitDice - character.hitDiceUsed) },
  }
}
