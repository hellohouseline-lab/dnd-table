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
}

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
}

export type SrdSubrace = {
  index: string
  name: string
  abilityBonuses: Partial<Record<Ability, number>>
  traits: string[]
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
}
export type SrdRaces = { races: SrdRace[]; traits: Record<string, { name: string; desc: string }> }

export type SrdBackground = {
  index: string
  name: string
  skills: string[]
  feature: { name: string; desc: string } | null
}

export type SrdFeature = { name: string; class: string | null; subclass: string | null; level: number; desc: string }

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
export const loadSpells = once(async () => (await import('./spells.json')).default.spells as unknown as SrdSpell[])
/** Monsters are only loaded on the DM's screens. */
export const loadMonsters = once(
  async () => (await import('./monsters.json')).default.monsters as unknown as SrdMonster[],
)
