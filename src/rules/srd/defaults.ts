// What the SRD says a character starts with, used to fill in the form when a race, class or
// background is picked. The player can always change anything afterwards.

import { ABILITY_SHORT, type Ability } from '../abilities.ts'
import { entryId, type CharacterBuild, type FeatureEntry } from '../character.ts'
import { clampLevel } from '../maths/core.ts'
import type { SrdBackground, SrdClass, SrdFeature, SrdRace, SrdRaces } from './index.ts'

/** Hit die, saving throws, spellcasting ability and slots for a class at a level. */
export function classDefaults(srdClass: SrdClass, level: number) {
  return {
    hitDie: srdClass.hitDie,
    saveProficiencies: srdClass.saves,
    spellcastingAbility: srdClass.spellcastingAbility,
    slotsMax: slotsFor(srdClass, level),
    otherProficiencies: srdClass.proficiencies.join(', '),
  }
}

/** Spell slots for levels 1 to 9 at a class level (Warlock pact slots sit at their slot level). */
export function slotsFor(srdClass: SrdClass, level: number): number[] {
  return srdClass.levels[String(clampLevel(level))]?.slots ?? [0, 0, 0, 0, 0, 0, 0, 0, 0]
}

/** Speed and languages from a race, and its ability bonuses in words: "+2 CON, +1 WIS". */
export function raceDefaults(race: SrdRace, subraceIndex?: string) {
  const subrace = race.subraces.find((s) => s.index === subraceIndex)
  return {
    speed: race.speed,
    languages: race.languages.join(', '),
    bonusesText: describeBonuses(sumBonuses(race.abilityBonuses, subrace?.abilityBonuses)),
  }
}

function sumBonuses(
  base: Partial<Record<Ability, number>>,
  extra: Partial<Record<Ability, number>> = {},
): Partial<Record<Ability, number>> {
  const total = { ...base }
  for (const [ability, bonus] of Object.entries(extra) as [Ability, number][]) {
    total[ability] = (total[ability] ?? 0) + bonus
  }
  return total
}

export function describeBonuses(bonuses: Partial<Record<Ability, number>>): string {
  return (Object.entries(bonuses) as [Ability, number][])
    .filter(([, bonus]) => bonus)
    .map(([ability, bonus]) => `+${bonus} ${ABILITY_SHORT[ability]}`)
    .join(', ')
}

/** Skills a background gives. */
export function backgroundSkills(background: SrdBackground): string[] {
  return background.skills
}

/**
 * The class (and subclass) features a character has at their level, as sheet entries. Where the
 * SRD name carries a count, like "Action Surge (1 use)" or "Channel Divinity (2/rest)", the uses
 * are filled in from it; otherwise the player adds them. A feature that improves with level, like
 * "Extra Attack (2)", appears once, at its highest version.
 */
export function classFeatures(
  srdClass: SrdClass,
  subclassIndex: string | null,
  level: number,
  features: Record<string, SrdFeature>,
): FeatureEntry[] {
  const indexes: string[] = []
  for (let l = 1; l <= clampLevel(level); l++) {
    indexes.push(...(srdClass.levels[String(l)]?.features ?? []))
    if (subclassIndex) indexes.push(...(srdClass.subclassFeatures[subclassIndex]?.[String(l)] ?? []))
  }
  const byBase = new Map<string, FeatureEntry>()
  for (const index of unique(indexes)) {
    const feature = features[index]
    if (feature) byBase.set(featureBaseName(feature.name).toLowerCase(), srdFeatureEntry(feature.name, feature.desc))
  }
  return [...byBase.values()]
}

/** "Action Surge (1 use)" gives "Action Surge"; names without brackets stay as they are. */
export function featureBaseName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function srdFeatureEntry(name: string, description: string): FeatureEntry {
  const uses = /^(.+?) \((\d+) uses?\)$/.exec(name)
  if (uses) return { ...featureEntry(uses[1], description), usesMax: Number(uses[2]), usesLeft: Number(uses[2]) }
  const perRest = /^(.+?) \((\d+)\/rest\)$/.exec(name)
  if (perRest) {
    const count = Number(perRest[2])
    return { ...featureEntry(perRest[1], description), usesMax: count, usesLeft: count, recharge: 'short' }
  }
  return featureEntry(name, description)
}

/** A race's traits (and its subrace's), as sheet entries. */
export function raceTraits(races: SrdRaces, race: SrdRace, subraceIndex?: string): FeatureEntry[] {
  const subrace = race.subraces.find((s) => s.index === subraceIndex)
  return unique([...race.traits, ...(subrace?.traits ?? [])]).flatMap((index) => {
    const trait = races.traits[index]
    return trait ? [featureEntry(trait.name, trait.desc)] : []
  })
}

// ---------------------------------------------------------------------------------------------
// Filling in the character form
// ---------------------------------------------------------------------------------------------

/** Picking a class sets its hit die, saves and spellcasting, and its proficiencies if none are typed yet. */
export function withClass(build: CharacterBuild, srdClass: SrdClass): CharacterBuild {
  const defaults = classDefaults(srdClass, build.level)
  return {
    ...build,
    className: srdClass.name,
    hitDie: defaults.hitDie,
    saveProficiencies: defaults.saveProficiencies,
    otherProficiencies: build.otherProficiencies || defaults.otherProficiencies,
    spellcasting: {
      ...build.spellcasting,
      ability: defaults.spellcastingAbility,
      slotsMax: defaults.slotsMax,
      slotsUsed: build.spellcasting.slotsUsed.map((used, i) => Math.min(used, defaults.slotsMax[i])),
    },
  }
}

/** Picking a race sets its speed, and its languages if none are typed yet. */
export function withRace(build: CharacterBuild, race: SrdRace): CharacterBuild {
  const defaults = raceDefaults(race)
  return { ...build, race: race.name, speed: defaults.speed, languages: build.languages || defaults.languages }
}

/** Picking a background adds its skill proficiencies. */
export function withBackground(build: CharacterBuild, background: SrdBackground): CharacterBuild {
  return {
    ...build,
    background: background.name,
    skillProficiencies: [...new Set([...build.skillProficiencies, ...background.skills])],
  }
}

/** Changing level updates the spell slots when the class is from the SRD. */
export function withLevel(build: CharacterBuild, level: number, srdClass?: SrdClass): CharacterBuild {
  const next = { ...build, level: clampLevel(level) }
  if (!srdClass?.spellcastingAbility) return next
  const slotsMax = slotsFor(srdClass, next.level)
  return {
    ...next,
    spellcasting: {
      ...next.spellcasting,
      slotsMax,
      slotsUsed: next.spellcasting.slotsUsed.map((used, i) => Math.min(used, slotsMax[i])),
    },
  }
}

/** Adds entries not already on the list, ignoring counts in brackets ("Extra Attack (2)" matches "Extra Attack"). */
export function addMissingFeatures(current: FeatureEntry[], extra: FeatureEntry[]): FeatureEntry[] {
  const names = new Set(current.map((f) => featureBaseName(f.name).toLowerCase()))
  return [...current, ...extra.filter((f) => !names.has(featureBaseName(f.name).toLowerCase()))]
}

function featureEntry(name: string, description: string): FeatureEntry {
  return { id: entryId(), name, description, usesMax: null, usesLeft: 0, recharge: null }
}

function unique(list: string[]): string[] {
  return [...new Set(list)]
}
