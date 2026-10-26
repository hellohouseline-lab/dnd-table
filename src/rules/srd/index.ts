// The SRD 5.1 (2014) rules data, imported by scripts/import-srd.ts. Small sets ship with the page;
// the big ones (spells, feature descriptions) load the first time something needs them.

import type { Ability } from '../abilities.ts'
import type { WeaponStats } from '../maths/attacks.ts'
import basics from './basics.json'

export type SrdSkill = { index: string; name: string; ability: Ability }
export type SrdCondition = { index: string; name: string; desc: string }
export type SrdWeapon = WeaponStats & {
  index: string
  category: 'Simple' | 'Martial'
  normalRange?: number
  longRange?: number
}

export type SrdClassLevel = {
  profBonus: number
  features: string[]
  /** Spell slots for spell levels 1 to 9. */
  slots: number[]
  cantripsKnown?: number
  spellsKnown?: number
  /** The class's own numbers at this level: rage_count, ki_points, sneak_attack, wild_shape_max_cr and so on. */
  extras: Record<string, unknown>
  /** Ability score increases had so far (one at level 4, two at 8, and so on; fighters and rogues get more). */
  abilityScoreIncreases: number
}

/** Part of a starting-gear option: an item and how many, or a pick from a category ("a martial weapon"). */
export type GearPart = { item: string; quantity: number } | { category: string; choose: number; desc: string }
/** A starting-gear choice: pick `choose` of the options, each a list of parts. */
export type GearChoice = { desc: string; choose: number; options: GearPart[][] }

/** Something a feature or trait asks you to pick: features, skills (expertise), spells, or words (favoured enemies). */
export type SrdChoice = { kind: 'feature' | 'skill' | 'spell' | 'trait' | 'text'; choose: number; from: string[] }

export type SrdClass = {
  index: string
  name: string
  hitDie: number
  saves: Ability[]
  spellcastingAbility: Ability | null
  skillChoices: { choose: number; from: string[] } | null
  proficiencies: string[]
  subclasses: { index: string; name: string }[]
  levels: Record<string, SrdClassLevel>
  subclassFeatures: Record<string, Record<string, string[]>>
  startingGear: { item: string; quantity: number }[]
  startingChoices: GearChoice[]
  /** Spells a subclass always has prepared, from a level (a Land druid's by terrain). */
  subclassSpells: Record<string, { spell: string; level: number; terrain: string | null }[]>
}

export type SrdSubrace = {
  index: string
  name: string
  abilityBonuses: Partial<Record<Ability, number>>
  traits: string[]
  /** Extra languages this kind picks (a high elf's one). */
  languageChoices: number
}
export type SrdRace = {
  index: string
  name: string
  speed: number
  size: string
  abilityBonuses: Partial<Record<Ability, number>>
  languages: string[]
  traits: string[]
  subraces: SrdSubrace[]
  /** Half-elves: +1 to two abilities of their choice (not Charisma, which already has +2). */
  abilityBonusChoice?: { choose: number; from: Ability[] }
  /** Extra languages to pick. */
  languageChoices: number
}
export type SrdTrait = {
  name: string
  desc: string
  /** A high elf's cantrip, a dragonborn's ancestry. */
  choice?: SrdChoice
  /** A draconic ancestry's damage type and breath weapon. */
  damageType?: string
  breath?: { area: { size: number; type: string }; save: Ability | null }
}
export type SrdRaces = { races: SrdRace[]; traits: Record<string, SrdTrait> }

export type SrdBackground = {
  index: string
  name: string
  skills: string[]
  feature: { name: string; desc: string } | null
  languageChoices: number
  gear: { item: string; quantity: number }[]
  gearChoices: GearChoice[]
  /** Gold pieces to start with. */
  gold: number
  /** Ideas to pick from, or write your own. */
  personality: string[]
  ideals: string[]
  bonds: string[]
  flaws: string[]
}

export type SrdPrerequisite = { level: number } | { spell: string } | { feature: string }
export type SrdFeature = {
  name: string
  class: string | null
  subclass: string | null
  level: number
  desc: string
  /** What it asks you to pick. Invocations come with choose 0: how many is the class's invocations_known. */
  choice?: SrdChoice
  /** The feature it's one option of (a fighting style's Fighting Style). */
  parent?: string
  prerequisites: SrdPrerequisite[]
}

/** An item of equipment. Costs are in copper pieces (1 gp = 100). */
export type SrdItem = {
  index: string
  name: string
  /** 'weapon', 'armor', 'adventuring-gear', 'tools' or 'mounts-and-vehicles'. */
  kind: string
  /** Light, Medium, Heavy or Shield; Simple or Martial; Equipment Packs, Standard Gear… */
  sub: string | null
  weight: number
  cost: number
  /** A pack's contents. */
  contents?: { item: string; quantity: number }[]
  armour?: { base: number; dexBonus: boolean; maxDex: number | null; strength: number; stealthDisadvantage: boolean }
}
export type SrdEquipment = { items: SrdItem[]; categories: Record<string, string[]> }

export type SrdSpell = {
  index: string
  name: string
  level: number
  school: string
  castingTime: string
  range: string
  components: string
  duration: string
  concentration: boolean
  ritual: boolean
  classes: string[]
  desc: string
  higherLevel?: string
  attackType?: string
  save?: Ability
  /** On a successful save: half the damage, or none. */
  dcSuccess?: 'half' | 'none'
  /** Damage by slot level ({ 3: '8d6' }), or for cantrips by character level ({ 1: '1d10', 5: '2d10' }). */
  damage?: { type: string; slots?: Record<string, string>; levels?: Record<string, string> }
  /** Healing by slot level: { 1: '1d8 + MOD' }, MOD being the spellcasting modifier. */
  heal?: Record<string, string>
  /** The shape it covers: a 20 ft sphere, a 15 ft cone. */
  area?: { type: 'sphere' | 'cube' | 'cone' | 'line' | 'cylinder'; size: number }
}

export type SrdMonsterAction = {
  name: string
  desc: string
  attackBonus?: number
  damage: { dice: string; type: string }[]
  dc?: { ability: Ability; value: number; success: string }
}

export type SrdMonster = {
  index: string
  name: string
  size: string
  type: string
  ac: number
  hp: number
  hitDice: string
  /** Walking speed in feet. */
  speed: number
  speedText: string
  scores: Record<Ability, number>
  cr: number
  xp: number
  passivePerception: number
  traits: { name: string; desc: string }[]
  actions: SrdMonsterAction[]
  reactions: SrdMonsterAction[]
  legendary: SrdMonsterAction[]
  /** Damage types it resists, is vulnerable to or immune to ('cold', or 'slashing:nonmagical'). */
  resistances: string[]
  vulnerabilities: string[]
  immunities: string[]
  conditionImmunities: string[]
  /** Skills it's proficient in, as the whole bonus: { stealth: 6 }. Others use the ability modifier. */
  skills: Record<string, number>
  /** Saving throws it's proficient in, as the whole bonus: { dexterity: 5 }. Others use the ability modifier. */
  saves: Partial<Record<Ability, number>>
}

export const SKILLS = basics.skills as SrdSkill[]
export const CONDITIONS = basics.conditions as SrdCondition[]
export const WEAPONS = basics.weapons as SrdWeapon[]

export function findWeapon(index: string | null | undefined): SrdWeapon | undefined {
  return index ? WEAPONS.find((weapon) => weapon.index === index) : undefined
}

export function findCondition(index: string): SrdCondition | undefined {
  return CONDITIONS.find((condition) => condition.index === index)
}

/** Finds an SRD entry by its name as typed, ignoring case and spaces at either end. */
export function byName<T extends { name: string }>(list: T[], name: string): T | undefined {
  const wanted = name.trim().toLowerCase()
  return wanted ? list.find((item) => item.name.toLowerCase() === wanted) : undefined
}

// Each big set is fetched once and then shared.
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined
  return () => (promise ??= load())
}

export const loadClasses = once(async () => (await import('./classes.json')).default.classes as unknown as SrdClass[])
export const loadRaces = once(async () => (await import('./races.json')).default as unknown as SrdRaces)
export const loadBackgrounds = once(
  async () => (await import('./backgrounds.json')).default.backgrounds as unknown as SrdBackground[],
)
export const loadFeatures = once(
  async () => (await import('./features.json')).default.features as unknown as Record<string, SrdFeature>,
)
export const loadEquipment = once(async () => (await import('./equipment.json')).default as unknown as SrdEquipment)
export const loadSpells = once(async () => (await import('./spells.json')).default.spells as unknown as SrdSpell[])
/** Monsters are only loaded on the DM's screens. */
export const loadMonsters = once(
  async () => (await import('./monsters.json')).default.monsters as unknown as SrdMonster[],
)
