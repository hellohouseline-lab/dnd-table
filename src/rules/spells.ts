// Spells in a fight (2014 rules): what casting one costs, which slots it can use, its save DC and
// attack bonus, and the dice for what it does at the slot (or, for cantrips, the character level)
// it's cast with. The server settles the cast (public.cast_spell); these feed its cards.

import { ABILITY_SHORT, type Ability } from './abilities.ts'
import type { Character, Spellcasting } from './character.ts'
import { diceText, parseDamage, type DiceGroup } from './dice.ts'
import { abilityModifier, proficiencyBonus } from './maths/core.ts'
import type { SrdSpell } from './srd/index.ts'

/** What casting it takes from your turn; 'longer' is a minute or more, outside a fight. */
export type SpellCost = 'action' | 'bonus' | 'reaction' | 'longer'

export function castingCost(castingTime: string): SpellCost {
  const time = castingTime.trim().toLowerCase()
  if (time === '1 action') return 'action'
  if (time === '1 bonus action') return 'bonus'
  if (time.startsWith('1 reaction')) return 'reaction'
  return 'longer'
}

/** What the spell does, which decides how it's settled. */
export type SpellKind = 'attack' | 'save' | 'damage' | 'heal' | 'other'

export function spellKind(spell: Pick<SrdSpell, 'attackType' | 'save' | 'heal' | 'damage'>): SpellKind {
  if (spell.attackType) return 'attack'
  if (spell.save) return 'save'
  if (spell.heal) return 'heal'
  if (spell.damage) return 'damage'
  return 'other'
}

/** Slots still free at one level (1 to 9). */
export function slotsLeft(spellcasting: Pick<Spellcasting, 'slotsMax' | 'slotsUsed'>, slot: number): number {
  return Math.max(0, (spellcasting.slotsMax[slot - 1] ?? 0) - (spellcasting.slotsUsed[slot - 1] ?? 0))
}

/** The slot levels a spell could be cast with now: its own level or higher, with a slot free. Cantrips: [0]. */
export function slotChoices(spellcasting: Pick<Spellcasting, 'slotsMax' | 'slotsUsed'>, level: number): number[] {
  if (level <= 0) return [0]
  return Array.from({ length: 10 - level }, (_, i) => level + i).filter((slot) => slotsLeft(spellcasting, slot) > 0)
}

/** The spellcasting ability's modifier, the number behind the save DC, the attack bonus and MOD. */
export function spellModifier(character: Pick<Character, 'scores' | 'spellcasting'>): number {
  const ability = character.spellcasting.ability
  return ability ? abilityModifier(character.scores[ability]) : 0
}

/** 8 + proficiency + the spellcasting modifier. Same as private.spell_dc on the server. */
export function spellSaveDc(character: Pick<Character, 'level' | 'scores' | 'spellcasting'>): number {
  return 8 + proficiencyBonus(character.level) + spellModifier(character)
}

/** Proficiency + the spellcasting modifier. */
export function spellAttackBonus(character: Pick<Character, 'level' | 'scores' | 'spellcasting'>): number {
  return proficiencyBonus(character.level) + spellModifier(character)
}

/** The Constitution save to keep concentrating after taking damage: 10, or half the damage if that's more. */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2))
}

export type SpellEffect = { dice: DiceGroup[]; modifier: number; type: string | null }

/**
 * The dice for what the spell does: damage at the slot it's cast with ("8d6" for Fireball at 3rd,
 * "9d6" at 4th), a cantrip's by character level ("2d10" for Fire Bolt from 5th), or healing with
 * MOD as the spellcasting modifier. Null when it does neither.
 */
export function spellEffect(
  spell: Pick<SrdSpell, 'level' | 'damage' | 'heal'>,
  slot: number,
  characterLevel: number,
  modifier: number,
): SpellEffect | null {
  const pick = (table: Record<string, string> | undefined, at: number) => {
    if (!table) return undefined
    const keys = Object.keys(table)
      .map(Number)
      .filter((key) => key <= at)
      .sort((a, b) => b - a)
    return keys.length > 0 ? table[String(keys[0])] : undefined
  }
  const text = spell.heal
    ? pick(spell.heal, Math.max(slot, spell.level))
    : spell.damage?.slots
      ? pick(spell.damage.slots, Math.max(slot, spell.level))
      : pick(spell.damage?.levels, characterLevel)
  if (!text) return null
  const withMod = /mod/i.test(text)
  const parsed = parseDamage(text.replace(/\bmod\b/gi, ''))
  return {
    dice: parsed.dice,
    modifier: parsed.bonus + (withMod ? modifier : 0),
    type: spell.heal ? null : (spell.damage?.type ?? null),
  }
}

/** How far it reaches, in feet: 'Self' is 0, 'Touch' 5; null for sight, unlimited or special. */
export function spellRange(range: string): number | null {
  const text = range.trim().toLowerCase()
  if (text.startsWith('self')) return 0
  if (text === 'touch') return 5
  const feet = /^(\d+) feet/.exec(text)
  if (feet) return Number(feet[1])
  const miles = /^(\d+) miles?/.exec(text)
  if (miles) return Number(miles[1]) * 5280
  return null
}

/** Does it leave an area on the map for a while (Darkness, Silence), rather than going off at once (Fireball)? */
export function lastingArea(spell: Pick<SrdSpell, 'area' | 'duration'>): boolean {
  return Boolean(spell.area) && !/^instantaneous/i.test(spell.duration.trim())
}

/** One line for a spell's card: "8d6 fire · DC 14 DEX save", "+7 to hit · 2d10 fire", "1d8+3 healing". */
export function spellSummary(
  spell: SrdSpell,
  character: Pick<Character, 'level' | 'scores' | 'spellcasting'>,
  slot = spell.level,
): string {
  const effect = spellEffect(spell, slot, character.level, spellModifier(character))
  const dice = effect
    ? `${diceText(effect.dice)}${effect.modifier > 0 ? `+${effect.modifier}` : effect.modifier < 0 ? effect.modifier : ''}`
    : ''
  const parts: string[] = []
  if (spell.attackType) parts.push(`+${spellAttackBonus(character)} to hit`)
  if (effect) parts.push(effect.type ? `${dice} ${effect.type}` : `${dice} healing`)
  if (spell.save) parts.push(`DC ${spellSaveDc(character)} ${ABILITY_SHORT[spell.save as Ability]} save`)
  return parts.join(' · ')
}
