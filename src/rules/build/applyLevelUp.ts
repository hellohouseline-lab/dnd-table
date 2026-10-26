// Taking a level (2014 rules): what the player picked on the level-up screen, applied to their
// sheet. Hit points go up by the average or a roll plus Constitution (and a Constitution increase
// counts for every level, as the rules say); new features arrive with their uses; choices become
// sheet entries (a fighting style, invocations) or expertise; spell slots grow and new spells join.

import type { Ability } from '../abilities.ts'
import { entryId, type Character, type CharacterBuild, type FeatureEntry } from '../character.ts'
import { abilityModifier } from '../maths/core.ts'
import { addMissingFeatures, classFeatures, slotsFor } from '../srd/defaults.ts'
import type { SrdClass, SrdFeature, SrdSpell } from '../srd/index.ts'
import { withFeatureUses } from './assemble.ts'
import { levelHp } from './body.ts'
import { preparedCount, type LevelPlan } from './levelUp.ts'
import { applyIncrease } from './scores.ts'
import { spellPlan } from './spellsStep.ts'

export type LevelUpPicks = {
  /** A rolled hit die, or null for the average. */
  rolled: number | null
  /** The subclass, at the level the class picks one. */
  subclass: string | null
  /** An ability score increase: +2 to one, or +1 to two. */
  increase: Partial<Record<Ability, number>>
  /** What each feature asks for, by feature: a fighting style, invocations, expertise. */
  choices: Record<string, string[]>
  cantrips: string[]
  spells: string[]
  /** A spell known swapped for another (bards, sorcerers, rangers and warlocks may, each level). */
  swapOut: string | null
  swapIn: string | null
  /** More spells prepared, when the number they can prepare goes up. */
  prepare: string[]
}

export const NO_PICKS: LevelUpPicks = {
  rolled: null,
  subclass: null,
  increase: {},
  choices: {},
  cantrips: [],
  spells: [],
  swapOut: null,
  swapIn: null,
  prepare: [],
}

/** The character's sheet as a build, to change and save. */
export function toBuild(c: Character): CharacterBuild {
  return {
    name: c.name,
    race: c.race,
    subrace: c.subrace,
    className: c.className,
    subclass: c.subclass,
    background: c.background,
    level: c.level,
    scores: c.scores,
    maxHp: c.maxHp,
    armourClass: c.armourClass,
    speed: c.speed,
    hitDie: c.hitDie,
    saveProficiencies: c.saveProficiencies,
    skillProficiencies: c.skillProficiencies,
    skillExpertise: c.skillExpertise,
    otherProficiencies: c.otherProficiencies,
    languages: c.languages,
    attacks: c.attacks,
    features: c.features,
    spellcasting: c.spellcasting,
    inventory: c.inventory,
    wallet: c.wallet,
    story: c.story,
  }
}

/** The subclass index from the sheet's name ("Champion"), or the one just picked. */
export function subclassIndex(
  cls: SrdClass,
  character: Pick<Character, 'subclass'>,
  picked: string | null,
): string | null {
  if (picked) return picked
  const name = character.subclass.trim().toLowerCase()
  return cls.subclasses.find((s) => s.name.toLowerCase() === name || s.index === name)?.index ?? null
}

/** New spells to choose from at the new level: the class list, less what they know already. */
export function levelUpSpells(cls: SrdClass, character: Character, level: number, spells: SrdSpell[]) {
  const plan = spellPlan(cls, level, subclassIndex(cls, character, null), character.scores, spells)
  const known = new Set(character.spellcasting.spells.map((s) => s.index))
  return {
    cantrips: plan.cantripList.filter((s) => !known.has(s.index)),
    spells: plan.spellList.filter((s) => !known.has(s.index)),
  }
}

const SWAPPERS = ['bard', 'sorcerer', 'ranger', 'warlock']

/** The class's own spells the character knows, less their subclass's always-ready ones. */
function classSpellsKnown(cls: SrdClass, character: Character) {
  const sub = subclassIndex(cls, character, null)
  const always = new Set((sub ? (cls.subclassSpells[sub] ?? []) : []).map((s) => s.spell))
  return character.spellcasting.spells.filter((s) => s.level > 0 && !(s.index && always.has(s.index)))
}

/**
 * Swapping a spell on levelling up (2014 rules): a bard, sorcerer, ranger or warlock may replace
 * one spell they know with another from their list, of a level they have slots for. Null for
 * classes that can't, or with nothing to swap.
 */
export function swapChoices(
  cls: SrdClass,
  character: Character,
  level: number,
  spells: SrdSpell[],
  picks: LevelUpPicks,
) {
  if (!SWAPPERS.includes(cls.index)) return null
  const known = classSpellsKnown(cls, character)
  if (known.length === 0) return null
  const options = levelUpSpells(cls, character, level, spells).spells.filter((s) => !picks.spells.includes(s.index))
  return { out: known, in: options }
}

/**
 * Preparing more (2014 rules): a cleric, druid, paladin or wizard prepares their level plus a
 * modifier, so a level (or a better score) lets them prepare more. How many more they have room
 * for, and what they can prepare: a preparing class's list, or a wizard's unprepared book spells
 * (with the ones just added). Null when there's no room.
 */
export function prepareChoices(
  cls: SrdClass,
  character: Character,
  level: number,
  spells: SrdSpell[],
  picks: LevelUpPicks,
) {
  const scores = applyIncrease(character.scores, picks.increase) ?? character.scores
  const count = preparedCount(cls.index, level, scores)
  if (count === null) return null
  const known = classSpellsKnown(cls, character)
  const room = count - known.filter((s) => s.prepared).length
  if (room <= 0) return null
  const options =
    cls.index === 'wizard'
      ? [
          ...known.filter((s) => !s.prepared).flatMap((s) => spells.filter((x) => x.index === s.index)),
          ...spells.filter((s) => picks.spells.includes(s.index)),
        ]
      : levelUpSpells(cls, character, level, spells).spells
  return { room, options }
}

/** What's still to pick, in plain words. */
export function levelUpMissing(plan: LevelPlan, picks: LevelUpPicks): string[] {
  const missing: string[] = []
  if (plan.chooseSubclass && !picks.subclass) missing.push('Pick your path')
  if (plan.abilityIncrease) {
    const points = Object.values(picks.increase).reduce((n, v) => n + (v ?? 0), 0)
    if (points !== 2) missing.push('Spend your 2 ability points')
  }
  for (const choice of plan.choices) {
    const picked = picks.choices[choice.feature]?.length ?? 0
    if (picked < choice.choose) missing.push(`Pick ${choice.choose - picked} for ${choice.name}`)
  }
  const count = (n: number, word: string) => `Pick ${n} ${word}${n === 1 ? '' : 's'}`
  if (picks.cantrips.length < plan.cantrips) missing.push(count(plan.cantrips - picks.cantrips.length, 'cantrip'))
  if (picks.spells.length < plan.spells) missing.push(count(plan.spells - picks.spells.length, 'spell'))
  if (picks.swapOut && !picks.swapIn) missing.push('Pick the spell to learn in its place')
  return missing
}

/** The hit points the new level adds, counting a Constitution increase for every level. */
export function hpGain(character: Character, cls: SrdClass, picks: LevelUpPicks): number {
  const scores = applyIncrease(character.scores, picks.increase) ?? character.scores
  const toughness = character.features.some((f) => f.name === 'Dwarven Toughness') ? 1 : 0
  const back = (abilityModifier(scores.constitution) - abilityModifier(character.scores.constitution)) * character.level
  return levelHp(cls.hitDie, scores.constitution, picks.rolled, toughness) + back
}

const entry = (name: string, description: string): FeatureEntry => ({
  id: entryId(),
  name,
  description,
  usesMax: null,
  usesLeft: 0,
  recharge: null,
})

/** The spell list after the level: new picks, a swap, more prepared, and a subclass's new always-ready spells. */
function levelUpSpellList(
  character: Character,
  cls: SrdClass,
  level: number,
  subclass: string | null,
  picks: LevelUpPicks,
  spells: SrdSpell[],
) {
  const wizard = cls.index === 'wizard'
  const always = (subclass ? (cls.subclassSpells[subclass] ?? []) : [])
    .filter((s) => s.level <= level && !s.terrain)
    .map((s) => s.spell)
  const kept = character.spellcasting.spells
    .filter((s) => !picks.swapIn || s.index !== picks.swapOut)
    .map((s) => (wizard && s.index && picks.prepare.includes(s.index) ? { ...s, prepared: true } : s))
  const known = new Set(kept.map((s) => s.index))
  const adding = [
    ...picks.cantrips,
    ...picks.spells,
    ...(picks.swapOut && picks.swapIn ? [picks.swapIn] : []),
    ...(wizard ? [] : picks.prepare),
    ...always,
  ].filter((index, i, all) => !known.has(index) && all.indexOf(index) === i)
  return [
    ...kept,
    ...adding.flatMap((index) => {
      const spell = spells.find((s) => s.index === index)
      return spell
        ? [
            {
              id: entryId(),
              index: spell.index,
              name: spell.name,
              level: spell.level,
              prepared: !wizard || spell.level === 0 || picks.prepare.includes(index),
            },
          ]
        : []
    }),
  ]
}

/** The sheet after taking the level. */
export function applyLevelUp(
  character: Character,
  cls: SrdClass,
  plan: LevelPlan,
  picks: LevelUpPicks,
  data: { features: Record<string, SrdFeature>; spells: SrdSpell[] },
): CharacterBuild {
  const level = plan.level
  const subclass = subclassIndex(cls, character, picks.subclass)
  const scores = applyIncrease(character.scores, picks.increase) ?? character.scores

  const chosen: FeatureEntry[] = []
  const expertise: string[] = []
  for (const choice of plan.choices) {
    const picked = picks.choices[choice.feature] ?? []
    for (const index of picked) {
      const option = choice.options.find((o) => o.index === index)
      if (choice.kind === 'skill') expertise.push(index)
      else if (option) chosen.push(entry(`${choice.name}: ${option.name}`, option.desc))
    }
  }
  const features = withFeatureUses(
    addMissingFeatures(character.features, [...classFeatures(cls, subclass, level, data.features), ...chosen]),
    cls,
    level,
    scores,
  )

  const spellcasting = cls.spellcastingAbility
    ? {
        ...character.spellcasting,
        ability: character.spellcasting.ability ?? cls.spellcastingAbility,
        slotsMax: slotsFor(cls, level),
        spells: levelUpSpellList(character, cls, level, subclass, picks, data.spells),
      }
    : character.spellcasting

  const build = toBuild(character)
  return {
    ...build,
    level,
    subclass: subclass ? (cls.subclasses.find((s) => s.index === subclass)?.name ?? build.subclass) : build.subclass,
    scores,
    maxHp: character.maxHp + hpGain(character, cls, picks),
    skillExpertise: [...new Set([...character.skillExpertise, ...expertise.filter((s) => s !== 'thieves-tools')])],
    otherProficiencies: expertise.includes('thieves-tools')
      ? `${character.otherProficiencies}, Thieves’ tools (expertise)`
      : character.otherProficiencies,
    features,
    spellcasting,
  }
}
