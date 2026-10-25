// Plain words for a roll, used by the result card and the log.

import type { Member } from '../live/campaigns.ts'
import type { Roll } from '../live/rolls.ts'
import type { Character } from '../rules/character.ts'
import { keptSum, type RollPart } from '../rules/dice.ts'
import { formatBonus } from '../rules/maths/core.ts'

/** The character's name for a character's roll, otherwise the person's, with "(DM)" for the DM. */
export function whoRolled(
  roll: Pick<Roll, 'rollerId' | 'characterId'>,
  members: Member[],
  characters: Character[],
): string {
  const character = roll.characterId ? characters.find((c) => c.id === roll.characterId) : undefined
  if (character) return character.name
  const member = members.find((m) => m.user_id === roll.rollerId)
  if (!member) return 'Someone'
  return member.role === 'dm' ? `${member.display_name} (DM)` : member.display_name
}

/** "14 + 3", "14 − 1", or just "14" with no bonus: the dice that count, then the bonus. */
export function sumText(roll: Pick<Roll, 'dice' | 'modifier'>): string {
  const dice = keptSum(roll.dice)
  if (roll.modifier === 0) return String(dice)
  return `${dice} ${roll.modifier > 0 ? '+' : '−'} ${Math.abs(roll.modifier)}`
}

/** "Wisdom +1, Proficiency +2, Poisoned: disadvantage". */
export function partsText(parts: RollPart[]): string {
  return parts
    .map((part) =>
      part.value === 0 && part.label.includes(':') ? part.label : `${part.label} ${formatBonus(part.value)}`,
    )
    .join(', ')
}

/** "with advantage", "with disadvantage" or nothing. */
export function modeText(roll: Pick<Roll, 'mode'>): string {
  return roll.mode === 'normal' ? '' : `with ${roll.mode}`
}

/** "9 slashing damage", or "Misses" for an attack's natural 1. */
export function damageLine(roll: Pick<Roll, 'kind' | 'natural' | 'damage'>): string | null {
  if (roll.kind === 'attack' && roll.natural === 1) return 'Misses, whatever the target'
  if (!roll.damage) return null
  return `${roll.damage.total} ${roll.damage.type ? `${roll.damage.type} ` : ''}damage`
}

/** The moment to make a fuss about: a natural 20 or 1 on a single d20. */
export function naturalMoment(roll: Pick<Roll, 'natural'>): 'nat20' | 'nat1' | null {
  if (roll.natural === 20) return 'nat20'
  if (roll.natural === 1) return 'nat1'
  return null
}

/** The name of the moment: "Critical hit" for an attack's natural 20, otherwise "Natural 20" or "Natural 1". */
export function naturalTitle(roll: Pick<Roll, 'kind' | 'natural'>): string | null {
  const moment = naturalMoment(roll)
  if (!moment) return null
  if (roll.kind === 'attack' && moment === 'nat20') return 'Critical hit'
  return moment === 'nat20' ? 'Natural 20' : 'Natural 1'
}

/** What a natural means for this kind of roll (2014 rules: only attacks hit or miss automatically). */
export function naturalNote(roll: Pick<Roll, 'kind' | 'natural'>): string | null {
  const moment = naturalMoment(roll)
  if (!moment) return null
  if (roll.kind === 'attack')
    return moment === 'nat20' ? 'A natural 20: the damage dice are doubled.' : 'A natural 1 always misses.'
  if (roll.kind === 'check' || roll.kind === 'save' || roll.kind === 'initiative') {
    return 'On checks and saves the total still decides.'
  }
  return null
}

/** "21:04" in the viewer's own time. */
export function timeText(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
