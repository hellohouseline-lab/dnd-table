// A character as the app works with it. Everything here is typed in by the player (Phase 1 has no
// creation wizard); every bonus is worked out from it by deriveSheet in sheet.ts.

import type { Effect } from './features.ts'
import type { Ability, AbilityScores } from './abilities.ts'

/** A weapon from the SRD list (`weapon` set), or one typed in by hand (`weapon` null). */
export type AttackEntry = {
  id: string
  name: string
  weapon: string | null
  proficient: boolean
  magicBonus: number
  /** Only for typed-in attacks: */
  ability: Ability
  damageDice: string
  damageType: string
}

export type Recharge = 'short' | 'long'

/** A class feature, racial trait or anything else worth having on the sheet, with optional uses. */
export type FeatureEntry = {
  id: string
  name: string
  description: string
  /** Null for features that can be used any number of times. */
  usesMax: number | null
  usesLeft: number
  recharge: Recharge | null
}

export type SpellEntry = {
  id: string
  /** The SRD spell, when it came from the list. */
  index: string | null
  name: string
  level: number
  prepared: boolean
}

export type Spellcasting = {
  ability: Ability | null
  /** Slots for spell levels 1 to 9. */
  slotsMax: number[]
  slotsUsed: number[]
  spells: SpellEntry[]
}

export type Character = {
  id: string
  campaignId: string
  ownerId: string
  name: string
  race: string
  subrace: string
  className: string
  subclass: string
  background: string
  level: number
  scores: AbilityScores
  maxHp: number
  currentHp: number
  tempHp: number
  armourClass: number
  speed: number
  hitDie: number
  hitDiceUsed: number
  saveProficiencies: Ability[]
  skillProficiencies: string[]
  skillExpertise: string[]
  otherProficiencies: string
  languages: string
  attacks: AttackEntry[]
  features: FeatureEntry[]
  spellcasting: Spellcasting
  deathSaveSuccesses: number
  deathSaveFailures: number
  /** At 0 hit points but no longer rolling death saves (three successes, or the DM stabilised them). */
  stable: boolean
  /** Three death save failures. The DM can undo it. */
  dead: boolean
  conditions: string[]
  /** Damage types this character resists, is vulnerable to or immune to. */
  resistances: string[]
  vulnerabilities: string[]
  immunities: string[]
  exhaustion: number
  inspiration: boolean
  concentration: string | null
  /** The Constitution save owed after taking damage while concentrating (set by the server). */
  concentrationDc: number | null
  /** Things running on the character, such as Raging. */
  effects: Effect[]
  portraitPath: string | null
  updatedAt: string
}

/** Everything the player types in when creating or editing a character. */
export type CharacterBuild = Omit<
  Character,
  | 'id'
  | 'campaignId'
  | 'ownerId'
  | 'currentHp'
  | 'tempHp'
  | 'hitDiceUsed'
  | 'deathSaveSuccesses'
  | 'deathSaveFailures'
  | 'stable'
  | 'dead'
  | 'conditions'
  | 'resistances'
  | 'vulnerabilities'
  | 'immunities'
  | 'exhaustion'
  | 'inspiration'
  | 'concentration'
  | 'concentrationDc'
  | 'effects'
  | 'portraitPath'
  | 'updatedAt'
>

export const NO_SPELLCASTING: Spellcasting = {
  ability: null,
  slotsMax: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  spells: [],
}

export function newBuild(): CharacterBuild {
  return {
    name: '',
    race: '',
    subrace: '',
    className: '',
    subclass: '',
    background: '',
    level: 1,
    scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    maxHp: 8,
    armourClass: 10,
    speed: 30,
    hitDie: 8,
    saveProficiencies: [],
    skillProficiencies: [],
    skillExpertise: [],
    otherProficiencies: '',
    languages: '',
    attacks: [],
    features: [],
    spellcasting: NO_SPELLCASTING,
  }
}

/** A short random id for list entries (attacks, features, spells) inside a character. */
export function entryId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** "Level 2 · Hill Dwarf · Fighter", leaving out anything not filled in. */
export function describeCharacter(character: Pick<Character, 'level' | 'race' | 'subrace' | 'className'>): string {
  return [`Level ${character.level}`, character.subrace || character.race, character.className]
    .filter(Boolean)
    .join(' · ')
}
