// The builder's steps 2 to 4: what a class gives and asks for at level 1, a background's skills
// (with a swap for any you'd get twice, as the 2014 rules allow), and the ability scores from each
// way of making them. Everything is worked out from the draft, so the summary is always current.

import { ABILITIES, type Ability } from '../abilities.ts'
import { abilityModifier } from '../maths/core.ts'
import type { SrdBackground, SrdClass, SrdFeature } from '../srd/index.ts'
import type { BuilderDraft, RaceSummary } from './draft.ts'
import { firstLevelHp } from './body.ts'
import { subclassLevel } from './levelUp.ts'
import { pointBuyCost, POINT_BUY_BUDGET, STANDARD_ARRAY, suggestScores, withBonuses, type Scores } from './scores.ts'
import { fourDropLowest } from './scores.ts'

const titleCase = (index: string) => index.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** A level 1 feature choice: what it asks, and the picks so far. */
export type FeatureAsk = {
  feature: string
  name: string
  kind: 'feature' | 'skill' | 'text' | 'spell' | 'trait'
  choose: number
  options: { index: string; name: string; desc: string }[]
  picked: string[]
}

export type ClassSummary = {
  name: string
  hitDie: number
  saves: Ability[]
  proficiencies: string[]
  features: { index: string; name: string; desc: string }[]
  /** The subclass, picked for you when the free rules have just one and it comes at level 1. */
  subclass: { index: string; name: string } | null
  skillChoices: { choose: number; from: string[] }
  asks: FeatureAsk[]
  missing: string[]
}

/** Features a class (and its level 1 subclass) has at level 1. */
function levelOneFeatures(cls: SrdClass, subclass: string | null): string[] {
  return [...(cls.levels[1]?.features ?? []), ...(subclass ? (cls.subclassFeatures[subclass]?.[1] ?? []) : [])]
}

/** The subclass a class picks at level 1, if it does: the only one the free rules have. */
export function levelOneSubclass(cls: SrdClass): string | null {
  return subclassLevel(cls) === 1 ? (cls.subclasses[0]?.index ?? null) : null
}

/** The class as picked: what it gives, what it asks you to choose, and what's still to pick. */
export function classSummary(
  draft: BuilderDraft,
  cls: SrdClass,
  features: Record<string, SrdFeature>,
  race: RaceSummary | null,
): ClassSummary {
  const subclass = draft.subclass ?? levelOneSubclass(cls)
  const indexes = levelOneFeatures(cls, subclass)
  const asks: FeatureAsk[] = []
  for (const index of indexes) {
    const feature = features[index]
    const choice = feature?.choice
    if (!choice || choice.choose === 0) continue
    // Expertise is for skills you're proficient in: the ones picked for this class, or thieves' tools.
    const from =
      choice.kind === 'skill'
        ? choice.from.filter(
            (s) => draft.classSkillPicks.includes(s) || race?.skills.includes(s) || s === 'thieves-tools',
          )
        : choice.from
    asks.push({
      feature: index,
      name: feature.name,
      kind: choice.kind,
      choose: choice.choose,
      options: from.map((o) => {
        const f = features[o]
        return {
          index: o,
          name: f ? f.name.replace(/^[^:]+:\s*/, '') : titleCase(o),
          desc: f?.desc ?? '',
        }
      }),
      picked: (draft.featurePicks[index] ?? []).filter((p) => from.includes(p)).slice(0, choice.choose),
    })
  }

  const skillChoices = cls.skillChoices ?? { choose: 0, from: [] }
  const missing: string[] = []
  const taken = race?.skills ?? []
  const picks = draft.classSkillPicks.filter((s) => skillChoices.from.includes(s) && !taken.includes(s))
  if (picks.length < skillChoices.choose) missing.push(`Pick ${skillChoices.choose} skills`)
  for (const ask of asks) {
    if (ask.picked.length < ask.choose) {
      missing.push(ask.choose === 1 ? `Pick your ${ask.name.toLowerCase()}` : `Pick ${ask.choose} for ${ask.name}`)
    }
  }

  return {
    name: cls.name,
    hitDie: cls.hitDie,
    saves: cls.saves,
    proficiencies: cls.proficiencies,
    features: indexes
      .filter((i) => features[i])
      .map((index) => ({ index, name: features[index].name, desc: features[index].desc })),
    subclass: subclass ? (cls.subclasses.find((s) => s.index === subclass) ?? null) : null,
    skillChoices,
    asks,
    missing,
  }
}

/** Picking a different class clears what belonged to the old one. */
export function withClassPicked(draft: BuilderDraft, className: string): BuilderDraft {
  if (draft.className === className) return draft
  return { ...draft, className, subclass: null, classSkillPicks: [], featurePicks: {}, gearPicks: [] }
}

export type BackgroundSummary = {
  name: string
  /** The background's own skills. */
  skills: string[]
  /** Its skills you'd already have from your race or class: pick another for each. */
  doubled: string[]
  /** How many skills to pick (a typed-in background picks two; a doubled skill is swapped). */
  skillPicks: number
  languages: number
  feature: { name: string; desc: string } | null
  missing: string[]
}

export function backgroundSummary(
  draft: BuilderDraft,
  backgrounds: SrdBackground[],
  already: string[],
): BackgroundSummary | null {
  if (draft.background === 'other') {
    const missing: string[] = []
    if (!draft.otherBackground.trim()) missing.push('Name your background')
    if (draft.backgroundSkillPicks.length < 2) missing.push('Pick 2 skills')
    if (draft.backgroundLanguagePicks.length < 2) missing.push('Pick 2 languages')
    return {
      name: draft.otherBackground.trim() || 'Your own background',
      skills: [],
      doubled: [],
      skillPicks: 2,
      languages: 2,
      feature: null,
      missing,
    }
  }
  const background = backgrounds.find((b) => b.index === draft.background)
  if (!background) return null
  const doubled = background.skills.filter((s) => already.includes(s))
  const missing: string[] = []
  if (draft.backgroundSkillPicks.length < doubled.length) {
    missing.push(doubled.length === 1 ? 'Pick a skill in place of the one you have' : `Pick ${doubled.length} skills`)
  }
  if (draft.backgroundLanguagePicks.length < background.languageChoices) {
    missing.push(`Pick ${background.languageChoices} languages`)
  }
  return {
    name: background.name,
    skills: background.skills,
    doubled,
    skillPicks: doubled.length,
    languages: background.languageChoices,
    feature: background.feature,
    missing,
  }
}

/** Every skill the character has so far: race, class picks, background (with any swaps). */
export function allSkills(
  draft: BuilderDraft,
  race: RaceSummary | null,
  background: BackgroundSummary | null,
): string[] {
  const skills = new Set<string>([...(race?.skills ?? []), ...draft.classSkillPicks])
  for (const s of background?.skills ?? []) skills.add(s)
  for (const s of draft.backgroundSkillPicks.slice(0, background?.skillPicks ?? 0)) skills.add(s)
  return [...skills]
}

/** The values a method deals: the standard array, or the six rolled totals. */
export function methodValues(draft: BuilderDraft): number[] | null {
  if (draft.scoreMethod === 'standard' || draft.scoreMethod === 'random') return [...STANDARD_ARRAY]
  if (draft.scoreMethod === 'roll' && draft.rolled) {
    return draft.rolled.map((dice) => fourDropLowest(dice as [number, number, number, number]))
  }
  return null
}

/** Whether the scores placed use each value once (standard array or rolls) or fit 27 points. */
export function scoresValid(draft: BuilderDraft): boolean {
  const scores = draft.baseScores
  if (!scores) return false
  if (draft.scoreMethod === 'pointbuy') {
    const cost = pointBuyCost(scores)
    return cost !== null && cost <= POINT_BUY_BUDGET
  }
  const values = methodValues(draft)
  if (!values) return false
  const placed = ABILITIES.map((a) => scores[a]).sort((a, b) => a - b)
  return JSON.stringify(placed) === JSON.stringify([...values].sort((a, b) => a - b))
}

/** "Random but balanced": the standard array, best to the class's main abilities, the rest shuffled. */
export function randomBalanced(classIndex: string, random: () => number = Math.random): Scores {
  const suggested = suggestScores(STANDARD_ARRAY, classIndex)
  const order = [...ABILITIES].sort((a, b) => suggested[b] - suggested[a])
  const top = order.slice(0, 2)
  const rest = order.slice(2)
  const values = rest.map((a) => suggested[a])
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return Object.fromEntries([...top.map((a) => [a, suggested[a]]), ...rest.map((a, i) => [a, values[i]])]) as Scores
}

/** The scores with racial bonuses on top, or null until placed. */
export function finalScores(draft: BuilderDraft, race: RaceSummary | null): Scores | null {
  if (!draft.baseScores) return null
  return withBonuses(draft.baseScores, race?.bonuses ?? {})
}

/** Hit points at level 1: the class's hit die plus Constitution, plus 1 for a hill dwarf. */
export function startingHp(cls: SrdClass, scores: Scores, race: RaceSummary | null): number {
  const toughness = race?.traits.some((t) => t.index === 'dwarven-toughness') ? 1 : 0
  return firstLevelHp(cls.hitDie, scores.constitution, toughness)
}

export const modifierText = (score: number) => {
  const mod = abilityModifier(score)
  return mod >= 0 ? `+${mod}` : `${mod}`
}
