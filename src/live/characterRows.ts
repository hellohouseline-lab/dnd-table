// Converts between database rows and the app's Character. The JSON columns (attacks, features,
// spellcasting) are read defensively: anything missing or malformed becomes a safe default.

import type { Effect } from '../rules/features.ts'
import { ABILITIES, isAbility, type Ability } from '../rules/abilities.ts'
import {
  EMPTY_STORY,
  EMPTY_WALLET,
  NO_SPELLCASTING,
  type AttackEntry,
  type Character,
  type CharacterBuild,
  type FeatureEntry,
  type InventoryItem,
  type SpellEntry,
  type Spellcasting,
  type Story,
  type Wallet,
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

/** Effects running on a character; anything malformed is dropped. */
export function parseEffects(value: Json): Effect[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).flatMap((e) =>
    typeof e.key === 'string' && typeof e.name === 'string'
      ? [
          {
            key: e.key,
            name: e.name,
            resistances: Array.isArray(e.resistances) ? e.resistances.filter((r) => typeof r === 'string') : undefined,
            endsWhenDown: e.endsWhenDown === true,
            // Kept, or saving the effects again would reset a timer the server is counting down.
            ...(typeof e.roundsLeft === 'number' && Number.isFinite(e.roundsLeft) ? { roundsLeft: e.roundsLeft } : {}),
            ...(typeof e.spell === 'string' ? { spell: e.spell } : {}),
          },
        ]
      : [],
  )
}

/** What a character carries; anything malformed is dropped. */
export function parseInventory(value: Json): InventoryItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).flatMap((i) => {
    const name = str(i.name).trim()
    if (!name) return []
    return [
      {
        id: str(i.id, crypto.randomUUID().slice(0, 8)),
        item: typeof i.item === 'string' ? i.item : null,
        name,
        quantity: Math.max(0, Math.round(num(i.quantity, 1))),
        weight: Math.max(0, num(i.weight)),
        worn: bool(i.worn),
        uses: typeof i.uses === 'number' && i.uses >= 0 ? Math.round(i.uses) : null,
        ...(typeof i.magic === 'string' ? { magic: i.magic } : {}),
        ...(typeof i.bonus === 'number' && i.bonus > 0 ? { bonus: Math.min(3, Math.round(i.bonus)) } : {}),
        ...(bool(i.attune) ? { attune: true, attuned: bool(i.attuned) } : {}),
        ...(typeof i.note === 'string' && i.note.trim() ? { note: i.note.slice(0, 1000) } : {}),
      },
    ]
  })
}

/** Coins, never below 0. */
export function parseWallet(value: Json): Wallet {
  if (!isObject(value)) return EMPTY_WALLET
  const coin = (key: keyof Wallet) => Math.max(0, Math.round(num(value[key])))
  return { cp: coin('cp'), sp: coin('sp'), ep: coin('ep'), gp: coin('gp'), pp: coin('pp') }
}

/** Who they are: each part as text, up to 2000 characters. */
export function parseStory(value: Json): Story {
  if (!isObject(value)) return EMPTY_STORY
  return Object.fromEntries(
    (Object.keys(EMPTY_STORY) as (keyof Story)[]).map((key) => [key, str(value[key]).slice(0, 2000)]),
  ) as Story
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
    inventory: parseInventory(row.inventory),
    wallet: parseWallet(row.wallet),
    story: parseStory(row.story),
    deathSaveSuccesses: row.death_save_successes,
    deathSaveFailures: row.death_save_failures,
    stable: row.stable,
    dead: row.dead,
    conditions: row.conditions,
    resistances: row.resistances,
    vulnerabilities: row.vulnerabilities,
    immunities: row.immunities,
    exhaustion: row.exhaustion,
    inspiration: row.inspiration,
    concentration: row.concentration,
    concentrationDc: row.concentration_dc,
    effects: parseEffects(row.effects),
    levelUpTo: row.level_up_to,
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
    inventory: build.inventory as unknown as Json,
    wallet: build.wallet as unknown as Json,
    story: build.story as unknown as Json,
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
    | 'stable'
    | 'dead'
    | 'conditions'
    | 'resistances'
    | 'vulnerabilities'
    | 'immunities'
    | 'exhaustion'
    | 'inspiration'
    | 'concentration'
    | 'effects'
    | 'features'
    | 'spellcasting'
    | 'portraitPath'
    | 'inventory'
    | 'wallet'
    | 'story'
    | 'armourClass'
  >
>

export function trackersToRow(patch: TrackerPatch): CharacterRowPatch {
  const row: CharacterRowPatch = {}
  if (patch.currentHp !== undefined) row.current_hp = patch.currentHp
  if (patch.tempHp !== undefined) row.temp_hp = patch.tempHp
  if (patch.hitDiceUsed !== undefined) row.hit_dice_used = patch.hitDiceUsed
  if (patch.deathSaveSuccesses !== undefined) row.death_save_successes = patch.deathSaveSuccesses
  if (patch.deathSaveFailures !== undefined) row.death_save_failures = patch.deathSaveFailures
  if (patch.stable !== undefined) row.stable = patch.stable
  if (patch.dead !== undefined) row.dead = patch.dead
  if (patch.conditions !== undefined) row.conditions = patch.conditions
  if (patch.resistances !== undefined) row.resistances = patch.resistances
  if (patch.vulnerabilities !== undefined) row.vulnerabilities = patch.vulnerabilities
  if (patch.immunities !== undefined) row.immunities = patch.immunities
  if (patch.exhaustion !== undefined) row.exhaustion = patch.exhaustion
  if (patch.inspiration !== undefined) row.inspiration = patch.inspiration
  if (patch.concentration !== undefined) row.concentration = patch.concentration
  if (patch.effects !== undefined) row.effects = patch.effects as unknown as Json
  if (patch.features !== undefined) row.features = patch.features as unknown as Json
  if (patch.spellcasting !== undefined) row.spellcasting = patch.spellcasting as unknown as Json
  if (patch.portraitPath !== undefined) row.portrait_path = patch.portraitPath
  if (patch.inventory !== undefined) row.inventory = patch.inventory as unknown as Json
  if (patch.wallet !== undefined) row.wallet = patch.wallet as unknown as Json
  if (patch.story !== undefined) row.story = patch.story as unknown as Json
  if (patch.armourClass !== undefined) row.armour_class = patch.armourClass
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
