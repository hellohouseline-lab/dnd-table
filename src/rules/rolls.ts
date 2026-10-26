// Ready-made rolls for a character: ability checks, saving throws, skills, initiative and attacks.
// Every bonus comes from the sheet maths, broken into parts for the log, and conditions add
// advantage or disadvantage by the 2014 rules.

import { ABILITY_NAME, type Ability } from './abilities.ts'
import type { AskKind } from './askable.ts'
import type { AttackEntry, Character } from './character.ts'
import {
  combineModes,
  diceText,
  parseDice,
  type DiceGroup,
  type RollKind,
  type RollMode,
  type RollPart,
  type RollRequest,
} from './dice.ts'
import { flatDamage, weaponAbility } from './maths/attacks.ts'
import { abilityModifier, proficiencyBonus } from './maths/core.ts'
import { skillRank } from './sheet.ts'
import { findWeapon, SKILLS } from './srd/index.ts'

export type RollCharacter = Pick<
  Character,
  | 'id'
  | 'level'
  | 'scores'
  | 'saveProficiencies'
  | 'skillProficiencies'
  | 'skillExpertise'
  | 'conditions'
  | 'exhaustion'
  | 'attacks'
>

/** What the person rolling chose: advantage or disadvantage, and whether only the DM sees it. */
export type RollChoices = { mode?: RollMode; secret?: boolean }

export type ConditionEffect = { mode: Exclude<RollMode, 'normal'>; reason: string }

/**
 * Advantage and disadvantage from conditions and exhaustion (2014 rules). Frightened is left out
 * because it depends on whether the source of fear is in sight, which only the table knows.
 */
export function conditionEffects(
  character: Pick<Character, 'conditions' | 'exhaustion'>,
  kind: RollKind,
  ability: Ability | null,
): ConditionEffect[] {
  const has = (condition: string) => character.conditions.includes(condition)
  const effects: ConditionEffect[] = []
  const add = (mode: ConditionEffect['mode'], reason: string) => effects.push({ mode, reason })

  if (kind === 'check' || kind === 'initiative') {
    if (has('poisoned')) add('disadvantage', 'Poisoned')
    if (character.exhaustion >= 1) add('disadvantage', 'Exhaustion')
  }
  if (kind === 'attack') {
    if (has('poisoned')) add('disadvantage', 'Poisoned')
    if (has('blinded')) add('disadvantage', 'Blinded')
    if (has('prone')) add('disadvantage', 'Prone')
    if (has('restrained')) add('disadvantage', 'Restrained')
    if (character.exhaustion >= 3) add('disadvantage', 'Exhaustion')
    if (has('invisible')) add('advantage', 'Invisible')
  }
  if (kind === 'save') {
    if (character.exhaustion >= 3) add('disadvantage', 'Exhaustion')
    if (has('restrained') && ability === 'dexterity') add('disadvantage', 'Restrained')
  }
  return effects
}

const D20: DiceGroup[] = [{ sides: 20, count: 1 }]

function d20Roll(
  character: RollCharacter,
  roll: { label: string; kind: RollKind; ability: Ability | null; parts: RollPart[] },
  choices: RollChoices,
): RollRequest {
  const effects = conditionEffects(character, roll.kind, roll.ability)
  const parts = roll.parts.filter((part) => part.value !== 0 || part.label === roll.parts[0]?.label)
  return {
    label: roll.label,
    kind: roll.kind,
    characterId: character.id,
    dice: D20,
    modifier: roll.parts.reduce((sum, part) => sum + part.value, 0),
    // Conditions that change the roll go in the log too, worth nothing on their own.
    parts: [...parts, ...effects.map((effect) => ({ label: `${effect.reason}: ${effect.mode}`, value: 0 }))],
    mode: combineModes([choices.mode ?? 'normal', ...effects.map((effect) => effect.mode)]),
    damage: null,
    secret: choices.secret ?? false,
    requestId: null,
  }
}

function abilityPart(character: RollCharacter, ability: Ability): RollPart {
  return { label: ABILITY_NAME[ability], value: abilityModifier(character.scores[ability]) }
}

export function abilityCheck(character: RollCharacter, ability: Ability, choices: RollChoices = {}): RollRequest {
  return d20Roll(
    character,
    { label: `${ABILITY_NAME[ability]} check`, kind: 'check', ability, parts: [abilityPart(character, ability)] },
    choices,
  )
}

export function savingThrow(character: RollCharacter, ability: Ability, choices: RollChoices = {}): RollRequest {
  const parts = [abilityPart(character, ability)]
  if (character.saveProficiencies.includes(ability))
    parts.push({ label: 'Proficiency', value: proficiencyBonus(character.level) })
  return d20Roll(character, { label: `${ABILITY_NAME[ability]} save`, kind: 'save', ability, parts }, choices)
}

export function skillCheck(character: RollCharacter, skillIndex: string, choices: RollChoices = {}): RollRequest {
  const skill = SKILLS.find((s) => s.index === skillIndex)
  if (!skill) throw new Error(`Unknown skill: ${skillIndex}`)
  const rank = skillRank(character, skill.index)
  const parts = [abilityPart(character, skill.ability)]
  if (rank !== 'none') parts.push({ label: 'Proficiency', value: proficiencyBonus(character.level) })
  if (rank === 'expertise') parts.push({ label: 'Expertise', value: proficiencyBonus(character.level) })
  return d20Roll(character, { label: `${skill.name} check`, kind: 'check', ability: skill.ability, parts }, choices)
}

/** Initiative is a Dexterity check. */
export function initiativeRoll(character: RollCharacter, choices: RollChoices = {}): RollRequest {
  return d20Roll(
    character,
    { label: 'Initiative', kind: 'initiative', ability: 'dexterity', parts: [abilityPart(character, 'dexterity')] },
    choices,
  )
}

/** An attack: the d20 to hit and the damage, thrown together. Same maths as the sheet's attack table. */
export function attackRoll(character: RollCharacter, attack: AttackEntry, choices: RollChoices = {}): RollRequest {
  const weapon = findWeapon(attack.weapon)
  const ability = weapon ? weaponAbility(weapon, character.scores) : attack.ability
  const abilityBonus = abilityModifier(character.scores[ability])
  const parts = [abilityPart(character, ability)]
  if (attack.proficient) parts.push({ label: 'Proficiency', value: proficiencyBonus(character.level) })
  if (attack.magicBonus) parts.push({ label: 'Magic', value: attack.magicBonus })

  const dice = parseDice(weapon ? weapon.damageDice : attack.damageDice)
  const damageBonus = abilityBonus + attack.magicBonus
  const request = d20Roll(
    character,
    { label: attack.name || weapon?.name || 'Attack', kind: 'attack', ability, parts },
    choices,
  )
  return {
    ...request,
    magical: attack.magicBonus > 0,
    damage: {
      dice,
      // With no dice the damage is flat: 1 + the bonus, as for an unarmed strike.
      modifier: dice.length > 0 ? damageBonus : flatDamage(damageBonus),
      type: (weapon?.damageType ?? attack.damageType).toLowerCase(),
    },
  }
}

/** A spell attack: a d20 plus the spellcasting modifier and proficiency, with the spell's damage. */
export function spellAttackRoll(
  character: RollCharacter,
  spell: { name: string },
  ability: Ability,
  damage: { dice: DiceGroup[]; modifier: number; type: string } | null,
  choices: RollChoices = {},
): RollRequest {
  const parts = [abilityPart(character, ability), { label: 'Proficiency', value: proficiencyBonus(character.level) }]
  return {
    ...d20Roll(character, { label: spell.name, kind: 'attack', ability, parts }, choices),
    magical: true,
    damage,
  }
}

/**
 * A character's answer to the DM's request for a roll: the right check or save, with their bonus,
 * their conditions and anything they chose, under the request's name.
 */
export function answerRoll(
  character: RollCharacter,
  request: { id: string; kind: AskKind; ability: Ability; skill: string | null; label: string },
  choices: RollChoices = {},
): RollRequest {
  const roll =
    request.kind === 'skill' && request.skill
      ? skillCheck(character, request.skill, choices)
      : request.kind === 'save'
        ? savingThrow(character, request.ability, choices)
        : abilityCheck(character, request.ability, choices)
  return { ...roll, label: request.label, requestId: request.id, secret: false }
}

/** Dice picked by hand, with no bonus worked out. */
export function freeRoll(
  dice: DiceGroup[],
  choices: RollChoices & { characterId?: string | null; modifier?: number } = {},
): RollRequest {
  return {
    label: diceText(dice),
    kind: 'free',
    characterId: choices.characterId ?? null,
    dice,
    modifier: choices.modifier ?? 0,
    parts: [],
    mode: choices.mode && dice.length === 1 && dice[0].sides === 20 && dice[0].count === 1 ? choices.mode : 'normal',
    damage: null,
    secret: choices.secret ?? false,
    requestId: null,
  }
}
