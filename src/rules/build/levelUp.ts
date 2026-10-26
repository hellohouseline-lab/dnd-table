// What a level brings (2014 rules, SRD classes): new features in plain order, the choices it asks
// for (a subclass, an ability score increase, a fighting style, expertise, metamagic, invocations
// whose prerequisites you meet), how the class's own numbers grow, and how many new spells to
// learn. The builder uses the same plan for every level after the first, so building at level 3
// and levelling up later are the same thing.

import { abilityModifier } from '../maths/core.ts'
import type { SrdChoice, SrdClass, SrdFeature, SrdPrerequisite } from '../srd/index.ts'

export type PlanFeature = { index: string; name: string; desc: string; fromSubclass: boolean }

export type ChoiceOption = { index: string; name: string; desc: string; allowed: boolean; why: string | null }

export type PlanChoice = {
  /** The feature asking: "fighter-fighting-style", "eldritch-invocations". */
  feature: string
  name: string
  kind: SrdChoice['kind']
  choose: number
  options: ChoiceOption[]
}

export type PlanNumber = { key: string; label: string; before: string; after: string }

export type LevelPlan = {
  level: number
  profBonus: number
  /** The proficiency bonus went up this level (levels 5, 9, 13, 17). */
  profUp: boolean
  hitDie: number
  features: PlanFeature[]
  /** An ability score increase (or a feat) this level. */
  abilityIncrease: boolean
  /** The level the class picks its subclass, and none is picked yet. */
  chooseSubclass: boolean
  choices: PlanChoice[]
  numbers: PlanNumber[]
  /** New cantrips to learn. */
  cantrips: number
  /** New spells to learn (classes that know spells) or add to a spellbook (wizards: 2 a level). */
  spells: number
  /** The highest spell level reached for the first time, if any. */
  newSpellLevel: number | null
}

/** What the character has already, for prerequisites. */
export type Have = { features: string[]; spells: string[] }

/** The level a class picks its subclass: 1 for clerics, sorcerers and warlocks, 2 for druids and wizards, else 3. */
export function subclassLevel(cls: SrdClass): number {
  const levels = Object.values(cls.subclassFeatures).flatMap((byLevel) => Object.keys(byLevel).map(Number))
  return levels.length > 0 ? Math.min(...levels) : 3
}

const NUMBER_LABELS: Record<string, string> = {
  rage_count: 'Rages',
  rage_damage_bonus: 'Rage damage',
  brutal_critical_dice: 'Brutal Critical dice',
  bardic_inspiration_die: 'Bardic Inspiration die',
  song_of_rest_die: 'Song of Rest die',
  channel_divinity_charges: 'Channel Divinity uses',
  destroy_undead_cr: 'Destroy Undead (challenge rating)',
  wild_shape_max_cr: 'Wild Shape (challenge rating)',
  wild_shape_swim: 'Wild Shape into swimmers',
  wild_shape_fly: 'Wild Shape into fliers',
  action_surges: 'Action Surges',
  indomitable_uses: 'Indomitable uses',
  extra_attacks: 'Extra attacks',
  martial_arts: 'Martial Arts die',
  ki_points: 'Ki points',
  unarmored_movement: 'Unarmoured Movement (ft)',
  aura_range: 'Aura range (ft)',
  favored_enemies: 'Favoured enemies',
  favored_terrain: 'Favoured terrains',
  sneak_attack: 'Sneak Attack',
  sorcery_points: 'Sorcery points',
  metamagic_known: 'Metamagic options',
  invocations_known: 'Eldritch invocations',
  arcane_recovery_levels: 'Arcane Recovery (spell levels)',
}

function numberText(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'number') {
    if (value > 0 && value < 1) return value === 0.25 ? '1/4' : value === 0.5 ? '1/2' : String(value)
    return String(value)
  }
  if (value && typeof value === 'object' && 'dice_count' in value && 'dice_value' in value) {
    const dice = value as { dice_count: number; dice_value: number }
    return `${dice.dice_count}d${dice.dice_value}`
  }
  return ''
}

/** Whether a prerequisite is met, and why not if not. */
function check(pre: SrdPrerequisite, level: number, have: Have, features: Record<string, SrdFeature>): string | null {
  if ('level' in pre) return level >= pre.level ? null : `from level ${pre.level}`
  if ('spell' in pre) return have.spells.includes(pre.spell) ? null : `needs the ${titleCase(pre.spell)} cantrip`
  return have.features.includes(pre.feature) ? null : `needs ${features[pre.feature]?.name ?? titleCase(pre.feature)}`
}

const titleCase = (index: string) => index.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function options(choice: SrdChoice, level: number, have: Have, features: Record<string, SrdFeature>): ChoiceOption[] {
  return choice.from.map((index) => {
    const feature = features[index]
    const why =
      (feature?.prerequisites ?? []).map((p) => check(p, level, have, features)).find((w) => w !== null) ?? null
    const taken = have.features.includes(index) ? 'you have it already' : null
    return {
      index,
      name: feature ? feature.name.replace(/^[^:]+:\s*/, '') : titleCase(index),
      desc: feature?.desc ?? '',
      allowed: why === null && taken === null,
      why: taken ?? why,
    }
  })
}

/** Cantrips and spells to learn at a level for the class's table. */
function spellGains(cls: SrdClass, level: number): { cantrips: number; spells: number } {
  const now = cls.levels[level]
  const before = cls.levels[level - 1]
  const cantrips = (now?.cantripsKnown ?? 0) - (before?.cantripsKnown ?? 0)
  if (cls.index === 'wizard') return { cantrips, spells: level === 1 ? 6 : 2 }
  const spells = (now?.spellsKnown ?? 0) - (before?.spellsKnown ?? 0)
  return { cantrips: Math.max(0, cantrips), spells: Math.max(0, spells) }
}

/**
 * How many spells a preparing class prepares each day: a cleric or druid their level plus Wisdom
 * modifier, a wizard their level plus Intelligence, a paladin half their level plus Charisma (at
 * least 1). Null for classes that know their spells instead.
 */
export function preparedCount(classIndex: string, level: number, scores: Record<string, number>): number | null {
  const mod = (ability: string) => abilityModifier(scores[ability] ?? 10)
  if (classIndex === 'cleric' || classIndex === 'druid') return Math.max(1, level + mod('wisdom'))
  if (classIndex === 'wizard') return Math.max(1, level + mod('intelligence'))
  if (classIndex === 'paladin') return level < 2 ? 0 : Math.max(1, Math.floor(level / 2) + mod('charisma'))
  return null
}

/** The plan for reaching `level` (2 to 20) in a class, given the subclass if one is picked. */
export function levelPlan(
  cls: SrdClass,
  level: number,
  subclass: string | null,
  have: Have,
  features: Record<string, SrdFeature>,
): LevelPlan {
  const now = cls.levels[level]
  const before = cls.levels[level - 1]
  const classFeatures = (now?.features ?? []).map((index) => ({ index, fromSubclass: false }))
  const subFeatures = subclass
    ? (cls.subclassFeatures[subclass]?.[level] ?? []).map((index) => ({ index, fromSubclass: true }))
    : []
  const all = [...classFeatures, ...subFeatures]

  const choices: PlanChoice[] = []
  for (const { index } of all) {
    const feature = features[index]
    if (!feature?.choice || feature.choice.choose === 0) continue
    choices.push({
      feature: index,
      name: feature.name,
      kind: feature.choice.kind,
      choose: feature.choice.choose,
      options: options(feature.choice, level, have, features),
    })
  }
  // Eldritch invocations: as many new ones as the table adds.
  const newInvocations = Number(now?.extras.invocations_known ?? 0) - Number(before?.extras.invocations_known ?? 0)
  const invocations = features['eldritch-invocations']?.choice
  if (newInvocations > 0 && invocations) {
    choices.push({
      feature: 'eldritch-invocations',
      name: 'Eldritch Invocations',
      kind: 'feature',
      choose: newInvocations,
      options: options(invocations, level, have, features),
    })
  }

  const numbers: PlanNumber[] = []
  for (const [key, value] of Object.entries(now?.extras ?? {})) {
    const label = NUMBER_LABELS[key]
    const was = before?.extras[key]
    if (!label || JSON.stringify(value) === JSON.stringify(was)) continue
    const after = numberText(value)
    if (!after || after === '0') continue
    numbers.push({ key, label, before: was === undefined ? '' : numberText(was), after })
  }

  const highest = (slots: number[] | undefined) => (slots ?? []).reduce((top, n, i) => (n > 0 ? i + 1 : top), 0)
  const reached = highest(now?.slots)
  const { cantrips, spells } = spellGains(cls, level)

  return {
    level,
    profBonus: now?.profBonus ?? 2,
    profUp: (now?.profBonus ?? 0) > (before?.profBonus ?? 0),
    hitDie: cls.hitDie,
    features: all
      .filter(({ index }) => features[index])
      .map(({ index, fromSubclass }) => ({
        index,
        name: features[index].name,
        desc: features[index].desc,
        fromSubclass,
      })),
    abilityIncrease: (now?.abilityScoreIncreases ?? 0) > (before?.abilityScoreIncreases ?? 0),
    chooseSubclass: level === subclassLevel(cls) && !subclass,
    choices,
    numbers,
    cantrips,
    spells,
    newSpellLevel: reached > highest(before?.slots) ? reached : null,
  }
}

/** Every level from the next to 20, for Your path. */
export function pathAhead(
  cls: SrdClass,
  fromLevel: number,
  subclass: string | null,
  have: Have,
  features: Record<string, SrdFeature>,
): LevelPlan[] {
  const plans: LevelPlan[] = []
  for (let level = fromLevel + 1; level <= 20; level++) plans.push(levelPlan(cls, level, subclass, have, features))
  return plans
}
