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
import type { LevelPlan } from './levelUp.ts'
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
}

export const NO_PICKS: LevelUpPicks = {
  rolled: null,
  subclass: null,
  increase: {},
  choices: {},
  cantrips: [],
  spells: [],
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
  if (picks.cantrips.length < plan.cantrips) missing.push(`Pick ${plan.cantrips - picks.cantrips.length} cantrips`)
  if (picks.spells.length < plan.spells) missing.push(`Pick ${plan.spells - picks.spells.length} spells`)
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
        spells: [
          ...character.spellcasting.spells,
          ...[...picks.cantrips, ...picks.spells].flatMap((index) => {
            const spell = data.spells.find((s) => s.index === index)
            return spell
              ? [
                  {
                    id: entryId(),
                    index: spell.index,
                    name: spell.name,
                    level: spell.level,
                    prepared: cls.index !== 'wizard' || spell.level === 0,
                  },
                ]
              : []
          }),
        ],
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
