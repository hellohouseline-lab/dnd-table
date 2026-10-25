// What the SRD says a character starts with, used to fill in the form when a race, class or
// background is picked. The player can always change anything afterwards.

import { ABILITY_SHORT, type Ability } from '../abilities.ts'
import { entryId, type FeatureEntry } from '../character.ts'
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
 * The class (and subclass) features a character has at their level, as sheet entries with no
 * uses filled in: the SRD doesn't say how often each can be used, so the player adds that.
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
  return unique(indexes).flatMap((index) => {
    const feature = features[index]
    return feature ? [featureEntry(feature.name, feature.desc)] : []
  })
}

/** A race's traits (and its subrace's), as sheet entries. */
export function raceTraits(races: SrdRaces, race: SrdRace, subraceIndex?: string): FeatureEntry[] {
  const subrace = race.subraces.find((s) => s.index === subraceIndex)
  return unique([...race.traits, ...(subrace?.traits ?? [])]).flatMap((index) => {
    const trait = races.traits[index]
    return trait ? [featureEntry(trait.name, trait.desc)] : []
  })
}

function featureEntry(name: string, description: string): FeatureEntry {
  return { id: entryId(), name, description, usesMax: null, usesLeft: 0, recharge: null }
}

function unique(list: string[]): string[] {
  return [...new Set(list)]
}
