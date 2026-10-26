// The character builder's draft: what has been picked so far, step by step, and the character that
// follows from it. Each step adds its own fields; anything not picked yet is null or empty.

import type { Ability } from '../abilities.ts'
import type { SrdRace, SrdRaces, SrdTrait } from '../srd/index.ts'
import type { GearPick } from './gear.ts'
import type { Scores } from './scores.ts'

/** The languages of the SRD: standard first, then exotic. */
export const LANGUAGES = [
  'Common',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Orc',
  'Abyssal',
  'Celestial',
  'Draconic',
  'Deep Speech',
  'Infernal',
  'Primordial',
  'Sylvan',
  'Undercommon',
] as const

export type BuilderDraft = {
  /** Step 1. An SRD race index, or 'other' for one typed in from a book. */
  race: string | null
  subrace: string | null
  /** The name of a race typed in by hand. */
  otherRace: string
  /** A half-elf's two abilities for +1 each. */
  bonusPicks: Ability[]
  /** Extra languages picked (a human's one, a half-elf's one). */
  languagePicks: string[]
  /** Choices a trait asks for, by trait: a dragonborn's ancestry, a high elf's cantrip. */
  traitPicks: Record<string, string>
  /** A half-elf's two skills (Skill Versatility). */
  raceSkillPicks: string[]

  /** Step 2. An SRD class index. */
  className: string | null
  /** Picked here for classes that choose at level 1 (a cleric's domain); later otherwise. */
  subclass: string | null
  classSkillPicks: string[]
  /** What a class feature asks for, by feature: a fighting style, expertise, a favoured enemy. */
  featurePicks: Record<string, string[]>

  /** Step 3. 'acolyte', or 'other' for one typed in. */
  background: string | null
  otherBackground: string
  /** Skills for a typed-in background, or in place of ones you already have from elsewhere. */
  backgroundSkillPicks: string[]
  backgroundLanguagePicks: string[]

  /** Step 4. How the scores were made, and the scores before racial bonuses. */
  scoreMethod: ScoreMethod | null
  baseScores: Scores | null
  /** Six rolls of 4d6 (each die), thrown once. */
  rolled: number[][] | null

  /** Step 6. The option picked for each of the class's gear choices, and the background's. */
  gearPicks: (GearPick | null)[]
  backgroundGearPicks: (GearPick | null)[]
}

export type ScoreMethod = 'standard' | 'pointbuy' | 'roll' | 'random'

export function emptyDraft(): BuilderDraft {
  return {
    race: null,
    subrace: null,
    otherRace: '',
    bonusPicks: [],
    languagePicks: [],
    traitPicks: {},
    raceSkillPicks: [],
    className: null,
    subclass: null,
    classSkillPicks: [],
    featurePicks: {},
    background: null,
    otherBackground: '',
    backgroundSkillPicks: [],
    backgroundLanguagePicks: [],
    scoreMethod: null,
    baseScores: null,
    rolled: null,
    gearPicks: [],
    backgroundGearPicks: [],
  }
}

export type RaceSummary = {
  name: string
  bonuses: Partial<Record<Ability, number>>
  speed: number
  size: string
  languages: string[]
  traits: { index: string; name: string; desc: string }[]
  /** Skills the race gives (an elf's Perception, a half-orc's Intimidation, a half-elf's two picks). */
  skills: string[]
  /** What still needs picking, in plain words. */
  missing: string[]
}

/** Skills a trait gives outright. */
const TRAIT_SKILLS: Record<string, string> = { 'keen-senses': 'perception', menacing: 'intimidation' }
/** Traits that let you pick skills, and how many. */
export const TRAIT_SKILL_PICKS: Record<string, number> = { 'skill-versatility': 2 }

/** The race as picked so far: its bonuses, speed, languages, traits, and what's left to choose. */
export function raceSummary(draft: BuilderDraft, races: SrdRaces): RaceSummary | null {
  if (draft.race === 'other') {
    return {
      name: draft.otherRace.trim() || 'Another race',
      bonuses: {},
      speed: 30,
      size: 'Medium',
      languages: ['Common'],
      traits: [],
      skills: [],
      missing: draft.otherRace.trim() ? [] : ["Type your race's name"],
    }
  }
  const race = races.races.find((r) => r.index === draft.race)
  if (!race) return null
  const subrace = race.subraces.find((s) => s.index === draft.subrace) ?? null

  const bonuses: Partial<Record<Ability, number>> = {}
  const add = (set: Partial<Record<Ability, number>>) => {
    for (const [ability, n] of Object.entries(set) as [Ability, number][])
      bonuses[ability] = (bonuses[ability] ?? 0) + n
  }
  add(race.abilityBonuses)
  if (subrace) add(subrace.abilityBonuses)
  const picks = race.abilityBonusChoice ? draft.bonusPicks.slice(0, race.abilityBonusChoice.choose) : []
  for (const ability of picks) add({ [ability]: 1 })

  const traitIndexes = [...race.traits, ...(subrace?.traits ?? [])]
  const traits = traitIndexes.flatMap((index) => {
    const trait = races.traits[index]
    if (!trait) return []
    const picked = draft.traitPicks[index]
    const chosen = trait.choice?.kind === 'trait' && picked ? races.traits[picked] : undefined
    if (trait.choice?.kind === 'spell' && picked) {
      const spell = picked.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      return [{ index, name: `${trait.name}: ${spell}`, desc: trait.desc }]
    }
    // A chosen option stands in for the trait that asked (Draconic Ancestry becomes "Draconic Ancestry (Red)").
    return chosen && picked
      ? [{ index: picked, name: chosen.name, desc: chosen.desc }]
      : [{ index, name: trait.name, desc: trait.desc }]
  })

  const missing: string[] = []
  if (race.subraces.length > 0 && !subrace) missing.push(`Pick a kind of ${race.name.toLowerCase()}`)
  if (race.abilityBonusChoice && picks.length < race.abilityBonusChoice.choose) {
    missing.push(`Pick ${race.abilityBonusChoice.choose} abilities for your +1s`)
  }
  const languageCount = languageChoices(race, subrace?.index ?? null)
  const languagePicks = draft.languagePicks.slice(0, languageCount)
  if (languagePicks.length < languageCount) {
    missing.push(languageCount === 1 ? 'Pick an extra language' : `Pick ${languageCount} extra languages`)
  }
  for (const index of traitIndexes) {
    const trait = races.traits[index]
    if (trait?.choice && !draft.traitPicks[index]) missing.push(choiceWords(trait))
  }
  const skillPickCount = traitIndexes.reduce((n, t) => n + (TRAIT_SKILL_PICKS[t] ?? 0), 0)
  const skillPicks = draft.raceSkillPicks.slice(0, skillPickCount)
  if (skillPicks.length < skillPickCount) missing.push(`Pick ${skillPickCount} skills`)
  const skills = [...traitIndexes.flatMap((t) => (TRAIT_SKILLS[t] ? [TRAIT_SKILLS[t]] : [])), ...skillPicks]

  return {
    name: subrace ? subrace.name : race.name,
    bonuses,
    speed: race.speed,
    size: race.size,
    languages: [...race.languages, ...languagePicks],
    traits,
    skills,
    missing,
  }
}

function choiceWords(trait: SrdTrait): string {
  if (trait.choice?.kind === 'spell') return 'Pick your cantrip'
  if (trait.choice?.kind === 'trait') return `Pick your ${trait.name.toLowerCase()}`
  return `Choose for ${trait.name}`
}

/** Extra languages to pick: the race's and its kind's (a human's one, a high elf's one). */
export function languageChoices(race: SrdRace, subrace: string | null): number {
  const kind = race.subraces.find((s) => s.index === subrace)
  // A high elf's Extra Language trait carries no choice in the data, so it's counted by name.
  const extra = [...race.traits, ...(kind?.traits ?? [])].filter((t) => t === 'extra-language').length
  return race.languageChoices + (kind?.languageChoices ?? 0) + extra
}

/** Toggles a pick in a list that holds at most `max` (oldest dropped). */
export function togglePick<T>(list: T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((v) => v !== value)
  return [...list, value].slice(-max)
}

/** Picking a different race clears what belonged to the old one. */
export function withRacePicked(draft: BuilderDraft, race: string): BuilderDraft {
  if (draft.race === race) return draft
  return { ...draft, race, subrace: null, bonusPicks: [], languagePicks: [], traitPicks: {}, raceSkillPicks: [] }
}

/** The race's bonus abilities a half-elf may pick (not the one the race already raises). */
export function bonusChoices(race: SrdRace): Ability[] {
  return race.abilityBonusChoice ? race.abilityBonusChoice.from : []
}
