// Turns the builder's draft into the character to save: everything the steps worked out, put in
// the shape the sheet, the hand of cards and the table already use.

import { abilityModifier } from '../maths/core.ts'
import { entryId, type CharacterBuild, type FeatureEntry, type SpellEntry } from '../character.ts'
import { addMissingFeatures, classFeatures, featureBaseName, raceTraits, slotsFor } from '../srd/defaults.ts'
import type { SrdBackground, SrdClass, SrdEquipment, SrdFeature, SrdRaces, SrdSpell } from '../srd/index.ts'
import { raceSummary, type BuilderDraft } from './draft.ts'
import { gearSummary, toInventory } from './gearStep.ts'
import { spellEntries, spellPlan } from './spellsStep.ts'
import { allSkills, backgroundSummary, classSummary, finalScores, startingHp } from './steps.ts'
import type { Scores } from './scores.ts'

export type BuilderData = {
  races: SrdRaces
  classes: SrdClass[]
  features: Record<string, SrdFeature>
  backgrounds: SrdBackground[]
  equipment: SrdEquipment
  spells: SrdSpell[]
}

const feature = (name: string, description: string): FeatureEntry => ({
  id: entryId(),
  name,
  description,
  usesMax: null,
  usesLeft: 0,
  recharge: null,
})

/**
 * Uses for the features the table counts: rages, Second Wind, Bardic Inspiration, Channel
 * Divinity, Wild Shape, ki and sorcery points, Lay on Hands' pool, Arcane Recovery.
 */
export function withFeatureUses(list: FeatureEntry[], cls: SrdClass, level: number, scores: Scores): FeatureEntry[] {
  const extras = cls.levels[level]?.extras ?? {}
  const number = (key: string) => (typeof extras[key] === 'number' ? (extras[key] as number) : 0)
  const set =
    (name: string, usesMax: number, recharge: 'short' | 'long'): ((f: FeatureEntry) => FeatureEntry) =>
    (f) =>
      featureBaseName(f.name).toLowerCase() === name.toLowerCase() && usesMax > 0
        ? { ...f, usesMax, usesLeft: usesMax, recharge }
        : f
  const rules = [
    set('Rage', number('rage_count'), 'long'),
    set('Second Wind', 1, 'short'),
    set('Bardic Inspiration', Math.max(1, abilityModifier(scores.charisma)), level >= 5 ? 'short' : 'long'),
    set('Channel Divinity', number('channel_divinity_charges'), 'short'),
    set('Wild Shape', 2, 'short'),
    set('Lay on Hands', 5 * level, 'long'),
    set('Arcane Recovery', 1, 'long'),
  ]
  let out = list.map((f) => rules.reduce((g, rule) => rule(g), f))
  const ki = number('ki_points')
  if (ki > 0)
    out = addMissingFeatures(out, [
      {
        ...feature(
          'Ki',
          'Ki points fuel Flurry of Blows, Patient Defense and Step of the Wind. They come back after a short or long rest.',
        ),
        usesMax: ki,
        usesLeft: ki,
        recharge: 'short',
      },
    ])
  const sorcery = number('sorcery_points')
  if (sorcery > 0)
    out = addMissingFeatures(out, [
      {
        ...feature(
          'Sorcery Points',
          'Spend them on Metamagic, or turn them into spell slots. They come back after a long rest.',
        ),
        usesMax: sorcery,
        usesLeft: sorcery,
        recharge: 'long',
      },
    ])
  return out
}

/** The character the draft describes, at level 1. */
export function assembleBuild(draft: BuilderDraft, data: BuilderData): CharacterBuild | null {
  const cls = data.classes.find((c) => c.index === draft.className)
  const race = raceSummary(draft, data.races)
  if (!cls || !race) return null
  const scores = finalScores(draft, race)
  if (!scores) return null
  const klass = classSummary(draft, cls, data.features, race)
  const already = [...race.skills, ...draft.classSkillPicks]
  const background = backgroundSummary(draft, data.backgrounds, already)
  const backgroundData = data.backgrounds.find((b) => b.index === draft.background) ?? null
  const gear = gearSummary(draft, cls, backgroundData, data.equipment, scores)
  const subclass = klass.subclass

  // Race traits (a chosen ancestry by its own name), class features with their uses, the choices
  // made (a fighting style by name), and the background's feature.
  const srdRace = data.races.races.find((r) => r.index === draft.race)
  const traits = srdRace
    ? raceTraits(data.races, srdRace, draft.subrace ?? undefined).map((t) => {
        const index = Object.keys(data.races.traits).find((k) => data.races.traits[k].name === t.name)
        const picked = index ? draft.traitPicks[index] : undefined
        const chosen = picked ? data.races.traits[picked] : undefined
        return chosen ? { ...t, name: chosen.name, description: chosen.desc } : t
      })
    : []
  const chosenFeatures = klass.asks
    .filter((ask) => ask.kind === 'feature')
    .flatMap((ask) =>
      ask.options.filter((o) => ask.picked.includes(o.index)).map((o) => feature(`${ask.name}: ${o.name}`, o.desc)),
    )
  const chosenText = klass.asks
    .filter((ask) => ask.kind === 'text')
    .map((ask) => feature(`${ask.name}: ${ask.picked.join(', ')}`, ''))
  const features = withFeatureUses(
    addMissingFeatures(
      [...traits, ...classFeatures(cls, subclass?.index ?? null, 1, data.features)],
      [
        ...chosenFeatures,
        ...chosenText,
        ...(background?.feature ? [feature(background.feature.name, background.feature.desc)] : []),
      ],
    ),
    cls,
    1,
    scores,
  )

  const expertise = klass.asks.filter((ask) => ask.kind === 'skill').flatMap((ask) => ask.picked)
  const skills = allSkills(draft, race, background).filter((s) => s !== 'thieves-tools')

  // Spells, with a high elf's cantrip (Intelligence) noted by name.
  const plan = data.spells ? spellPlan(cls, 1, subclass?.index ?? null, scores, data.spells) : null
  const spells: SpellEntry[] = plan ? spellEntries(draft, plan, data.spells) : []
  const elfCantrip = draft.traitPicks['high-elf-cantrip']
  const elfSpell = elfCantrip ? data.spells.find((s) => s.index === elfCantrip) : undefined
  if (elfSpell && !spells.some((s) => s.index === elfSpell.index)) {
    spells.push({ id: entryId(), index: elfSpell.index, name: elfSpell.name, level: 0, prepared: true })
  }

  const slowed = gear.ac?.slowed ?? false
  return {
    name: draft.name.trim(),
    race: draft.race === 'other' ? race.name : (srdRace?.name ?? race.name),
    subrace: draft.race !== 'other' && draft.subrace ? race.name : '',
    className: cls.name,
    subclass: subclass?.name ?? '',
    background: background?.name ?? '',
    level: 1,
    scores,
    maxHp: startingHp(cls, scores, race),
    armourClass: gear.ac?.ac ?? 10 + abilityModifier(scores.dexterity),
    speed: race.speed - (slowed ? 10 : 0),
    hitDie: cls.hitDie,
    saveProficiencies: cls.saves,
    skillProficiencies: skills,
    skillExpertise: expertise.filter((s) => skills.includes(s)),
    otherProficiencies: [
      ...cls.proficiencies,
      ...(expertise.includes('thieves-tools') ? ['Thieves’ tools (expertise)'] : []),
    ].join(', '),
    languages: [...race.languages, ...draft.backgroundLanguagePicks].join(', '),
    attacks: gear.attacks,
    features,
    spellcasting: {
      ability: cls.spellcastingAbility,
      slotsMax: slotsFor(cls, 1),
      slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      spells,
    },
    inventory: toInventory(gear.owned, gear.worn, data.equipment),
    wallet: gear.wallet,
    story: draft.story,
  }
}
