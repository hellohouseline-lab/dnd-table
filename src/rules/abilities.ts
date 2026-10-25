// The six ability scores. Full names match the database columns; the short forms match the sheet.

export const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const

export type Ability = (typeof ABILITIES)[number]

export type AbilityScores = Record<Ability, number>

export const ABILITY_SHORT: Record<Ability, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
}

export const ABILITY_NAME: Record<Ability, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
}

/** The SRD data names abilities 'str', 'dex' and so on. */
export function abilityFromSrd(index: string): Ability | null {
  return ABILITIES.find((ability) => ability.startsWith(index)) ?? null
}

export function isAbility(value: unknown): value is Ability {
  return typeof value === 'string' && (ABILITIES as readonly string[]).includes(value)
}
