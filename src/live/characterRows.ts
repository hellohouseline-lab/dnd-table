// Converts between database rows and the app's Character. The JSON columns (attacks, features,
// spellcasting) are read defensively: anything missing or malformed becomes a safe default.

import { ABILITIES, isAbility, type Ability } from '../rules/abilities.ts'
import {
  NO_SPELLCASTING,
  type AttackEntry,
  type Character,
  type CharacterBuild,
  type FeatureEntry,
  type SpellEntry,
  type Spellcasting,
} from '../rules/character.ts'
import type { Json, Tables, TablesUpdate } from './database.types.ts'

export type CharacterRow = Tables<'characters'>
export type CharacterRowPatch = TablesUpdate<'characters'>

type JsonObject = { [key: string]: Json | undefined }

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const bool = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback)
const nineNumbers = (value: unknown): number[] =>
  Array.from({ length: 9 }, (_, i) => (Array.isArray(value) ? Math.max(0, num(value[i])) : 0))

export function parseAttacks(value: Json): AttackEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).map((a) => ({
    id: str(a.id, crypto.randomUUID().slice(0, 8)),
    name: str(a.name),
    weapon: typeof a.weapon === 'string' ? a.weapon : null,
    proficient: bool(a.proficient, true),
    magicBonus: num(a.magicBonus),
    ability: isAbility(a.ability) ? a.ability : 'strength',
    damageDice: str(a.damageDice),
    damageType: str(a.damageType),
  }))
}

export function parseFeatures(value: Json): FeatureEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).map((f) => {
    const usesMax = typeof f.usesMax === 'number' && f.usesMax > 0 ? f.usesMax : null
    return {
      id: str(f.id, crypto.randomUUID().slice(0, 8)),
      name: str(f.name),
      description: str(f.description),
      usesMax,
      usesLeft: usesMax === null ? 0 : Math.min(usesMax, Math.max(0, num(f.usesLeft, usesMax))),
      recharge: f.recharge === 'short' || f.recharge === 'long' ? f.recharge : null,
    }
  })
}

export function parseSpellcasting(value: Json): Spellcasting {
  if (!isObject(value)) return NO_SPELLCASTING
  const spells: SpellEntry[] = Array.isArray(value.spells)
    ? value.spells.filter(isObject).map((s) => ({
        id: str(s.id, crypto.randomUUID().slice(0, 8)),
        index: typeof s.index === 'string' ? s.index : null,
        name: str(s.name),
        level: Math.min(9, Math.max(0, num(s.level))),
        prepared: bool(s.prepared, true),
      }))
    : []
  const slotsMax = nineNumbers(value.slotsMax)
  return {
    ability: isAbility(value.ability) ? value.ability : null,
    slotsMax,
    slotsUsed: nineNumbers(value.slotsUsed).map((used, i) => Math.min(used, slotsMax[i])),
    spells,
  }
}

export function rowToCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ownerId: row.owner_id,
    name: row.name,
    race: row.race,
    subrace: row.subrace,
    className: row.class,
    subclass: row.subclass,
    background: row.background,
    level: row.level,
    scores: {
      strength: row.strength,
      dexterity: row.dexterity,
      constitution: row.constitution,
      intelligence: row.intelligence,
      wisdom: row.wisdom,
      charisma: row.charisma,
    },
    maxHp: row.max_hp,
    currentHp: row.current_hp,
    tempHp: row.temp_hp,
    armourClass: row.armour_class,
    speed: row.speed,
    hitDie: row.hit_die,
    hitDiceUsed: row.hit_dice_used,
    saveProficiencies: row.save_proficiencies.filter(isAbility),
    skillProficiencies: row.skill_proficiencies,
    skillExpertise: row.skill_expertise,
    otherProficiencies: row.other_proficiencies,
    languages: row.languages,
    attacks: parseAttacks(row.attacks),
    features: parseFeatures(row.features),
    spellcasting: parseSpellcasting(row.spellcasting),
    deathSaveSuccesses: row.death_save_successes,
    deathSaveFailures: row.death_save_failures,
    conditions: row.conditions,
    resistances: row.resistances,
    vulnerabilities: row.vulnerabilities,
    immunities: row.immunities,
    exhaustion: row.exhaustion,
    inspiration: row.inspiration,
    concentration: row.concentration,
    portraitPath: row.portrait_path,
    updatedAt: row.updated_at,
  }
}

/** The columns for everything typed into the character form. */
export function buildToRow(build: CharacterBuild): CharacterRowPatch {
  const expertise = build.skillExpertise.filter((skill) => build.skillProficiencies.includes(skill))
  return {
    name: build.name.trim(),
    race: build.race.trim(),
    subrace: build.subrace.trim(),
    class: build.className.trim(),
    subclass: build.subclass.trim(),
    background: build.background.trim(),
    level: build.level,
    ...Object.fromEntries(ABILITIES.map((ability: Ability) => [ability, build.scores[ability]])),
    max_hp: build.maxHp,
    armour_class: build.armourClass,
    speed: build.speed,
    hit_die: build.hitDie,
    save_proficiencies: build.saveProficiencies,
    skill_proficiencies: build.skillProficiencies,
    skill_expertise: expertise,
    other_proficiencies: build.otherProficiencies,
    languages: build.languages,
    attacks: build.attacks as unknown as Json,
    features: build.features as unknown as Json,
    spellcasting: build.spellcasting as unknown as Json,
  }
}

/** Things that change during play, which either the player or the DM may update on their own. */
export type TrackerPatch = Partial<
  Pick<
    Character,
    | 'currentHp'
    | 'tempHp'
    | 'hitDiceUsed'
    | 'deathSaveSuccesses'
    | 'deathSaveFailures'
    | 'conditions'
    | 'resistances'
    | 'vulnerabilities'
    | 'immunities'
    | 'exhaustion'
    | 'inspiration'
    | 'concentration'
    | 'features'
    | 'spellcasting'
    | 'portraitPath'
  >
>

export function trackersToRow(patch: TrackerPatch): CharacterRowPatch {
  const row: CharacterRowPatch = {}
  if (patch.currentHp !== undefined) row.current_hp = patch.currentHp
  if (patch.tempHp !== undefined) row.temp_hp = patch.tempHp
  if (patch.hitDiceUsed !== undefined) row.hit_dice_used = patch.hitDiceUsed
  if (patch.deathSaveSuccesses !== undefined) row.death_save_successes = patch.deathSaveSuccesses
  if (patch.deathSaveFailures !== undefined) row.death_save_failures = patch.deathSaveFailures
  if (patch.conditions !== undefined) row.conditions = patch.conditions
  if (patch.resistances !== undefined) row.resistances = patch.resistances
  if (patch.vulnerabilities !== undefined) row.vulnerabilities = patch.vulnerabilities
  if (patch.immunities !== undefined) row.immunities = patch.immunities
  if (patch.exhaustion !== undefined) row.exhaustion = patch.exhaustion
  if (patch.inspiration !== undefined) row.inspiration = patch.inspiration
  if (patch.concentration !== undefined) row.concentration = patch.concentration
  if (patch.features !== undefined) row.features = patch.features as unknown as Json
  if (patch.spellcasting !== undefined) row.spellcasting = patch.spellcasting as unknown as Json
  if (patch.portraitPath !== undefined) row.portrait_path = patch.portraitPath
  return row
}

/** Applies a live change from another screen to a list of characters. */
export type CharacterChange = { type: 'upsert'; row: CharacterRow } | { type: 'delete'; id: string }

export function applyCharacterChange(list: Character[], change: CharacterChange): Character[] {
  if (change.type === 'delete') return list.filter((character) => character.id !== change.id)
  const updated = rowToCharacter(change.row)
  const exists = list.some((character) => character.id === updated.id)
  return exists ? list.map((character) => (character.id === updated.id ? updated : character)) : [...list, updated]
}
