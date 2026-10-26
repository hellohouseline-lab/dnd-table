// Quick starts for the builder: twelve ready-made level 1 characters (one for each class, built
// from the free rules with sensible picks), and Surprise me, a random but sensible one. Both fill
// in every step of the draft, so the player can still change anything before saving.

import { EMPTY_STORY, type Story } from '../character.ts'
import type { SrdClass } from '../srd/index.ts'
import type { BuilderData } from './assemble.ts'
import { emptyDraft, languageChoices, LANGUAGES, raceSummary, TRAIT_SKILL_PICKS, type BuilderDraft } from './draft.ts'
import { heightText, TYPICAL_SIZE, weightText } from './measures.ts'
import { abilityOrder, STANDARD_ARRAY, suggestScores } from './scores.ts'
import { spellPlan } from './spellsStep.ts'
import { backgroundSummary, classSummary, finalScores, randomBalanced, withClassPicked } from './steps.ts'

export type Preset = {
  key: string
  name: string
  race: string
  subrace?: string
  className: string
  /** Skills in order of preference. */
  skills?: string[]
  /** What each level 1 feature asks for, in order of preference. */
  features?: Record<string, string[]>
  cantrips?: string[]
  spells?: string[]
  story: Partial<Story>
}

/** The twelve ready-made characters, one for each class. */
export const PRESETS: Preset[] = [
  {
    key: 'barbarian',
    name: 'Ruk Ironjaw',
    race: 'half-orc',
    className: 'barbarian',
    skills: ['athletics', 'perception', 'survival'],
    story: {
      alignment: 'Chaotic good',
      age: '24',
      eyes: 'Amber',
      skin: 'Grey-green',
      hair: 'Black, shaved at the sides',
      personality: 'Loud, loyal and first through the door.',
    },
  },
  {
    key: 'bard',
    name: 'Lyra Quickstring',
    race: 'half-elf',
    className: 'bard',
    cantrips: ['vicious-mockery', 'light'],
    spells: ['healing-word', 'charm-person', 'thunderwave', 'faerie-fire'],
    story: {
      alignment: 'Chaotic good',
      age: '31',
      eyes: 'Green',
      skin: 'Fair',
      hair: 'Auburn curls',
      personality: 'Never met a crowd she couldn’t win over.',
    },
  },
  {
    key: 'cleric',
    name: 'Bruenna Stonehelm',
    race: 'dwarf',
    subrace: 'hill-dwarf',
    className: 'cleric',
    skills: ['medicine', 'insight', 'persuasion'],
    cantrips: ['sacred-flame', 'guidance', 'spare-the-dying'],
    spells: ['healing-word', 'guiding-bolt', 'shield-of-faith', 'sanctuary'],
    story: {
      alignment: 'Lawful good',
      age: '72',
      eyes: 'Brown',
      skin: 'Ruddy',
      hair: 'Copper braids',
      personality: 'Calm in a crisis, fierce when friends are hurt.',
    },
  },
  {
    key: 'druid',
    name: 'Rowan Ashby',
    race: 'human',
    className: 'druid',
    skills: ['nature', 'animal-handling', 'perception'],
    cantrips: ['produce-flame', 'shillelagh'],
    spells: ['healing-word', 'entangle', 'faerie-fire', 'thunderwave'],
    story: {
      alignment: 'True neutral',
      age: '28',
      eyes: 'Hazel',
      skin: 'Tanned',
      hair: 'Long and tangled, with leaves in it',
      personality: 'Talks to animals more than people.',
    },
  },
  {
    key: 'fighter',
    name: 'Aldric Vane',
    race: 'human',
    className: 'fighter',
    skills: ['athletics', 'perception', 'intimidation'],
    features: { 'fighter-fighting-style': ['fighter-fighting-style-defense'] },
    story: {
      alignment: 'Lawful good',
      age: '35',
      eyes: 'Blue',
      skin: 'Weathered',
      hair: 'Short and greying',
      personality: 'Steady, dependable, and always on watch.',
    },
  },
  {
    key: 'monk',
    name: 'Pip Underbough',
    race: 'halfling',
    subrace: 'lightfoot-halfling',
    className: 'monk',
    skills: ['acrobatics', 'stealth', 'insight'],
    story: {
      alignment: 'Lawful neutral',
      age: '30',
      eyes: 'Dark brown',
      skin: 'Olive',
      hair: 'Shaved',
      personality: 'Quiet, patient, and startlingly quick.',
    },
  },
  {
    key: 'paladin',
    name: 'Arjhan Goldscale',
    race: 'dragonborn',
    className: 'paladin',
    skills: ['athletics', 'persuasion', 'insight'],
    story: {
      alignment: 'Lawful good',
      age: '22',
      eyes: 'Gold',
      skin: 'Bronze scales',
      hair: 'None',
      personality: 'Speaks plainly and keeps every promise.',
    },
  },
  {
    key: 'ranger',
    name: 'Thalia Greenleaf',
    race: 'elf',
    subrace: 'high-elf',
    className: 'ranger',
    skills: ['survival', 'stealth', 'nature', 'animal-handling'],
    features: { 'favored-enemy-1-type': ['beasts'], 'natural-explorer-1-terrain-type': ['forest'] },
    story: {
      alignment: 'Neutral good',
      age: '110',
      eyes: 'Silver',
      skin: 'Pale',
      hair: 'Long, dark and braided',
      personality: 'Watchful, and happier outdoors than in.',
    },
  },
  {
    key: 'rogue',
    name: 'Milo Tealeaf',
    race: 'halfling',
    subrace: 'lightfoot-halfling',
    className: 'rogue',
    skills: ['stealth', 'sleight-of-hand', 'acrobatics', 'perception'],
    features: { 'rogue-expertise-1': ['stealth', 'thieves-tools'] },
    story: {
      alignment: 'Chaotic good',
      age: '26',
      eyes: 'Brown',
      skin: 'Rosy',
      hair: 'Curly and sandy',
      personality: 'Cheerful, curious, and quick with his fingers.',
    },
  },
  {
    key: 'sorcerer',
    name: 'Elias Marrow',
    race: 'human',
    className: 'sorcerer',
    skills: ['arcana', 'persuasion'],
    features: { 'dragon-ancestor': ['dragon-ancestor-red---fire-damage'] },
    cantrips: ['fire-bolt', 'light', 'mage-hand', 'prestidigitation'],
    spells: ['magic-missile', 'shield'],
    story: {
      alignment: 'Chaotic neutral',
      age: '20',
      eyes: 'Red-flecked brown',
      skin: 'Warm brown',
      hair: 'Black, singed at the ends',
      personality: 'Restless, proud, and a little reckless.',
    },
  },
  {
    key: 'warlock',
    name: 'Nyx Ashborne',
    race: 'tiefling',
    className: 'warlock',
    skills: ['deception', 'arcana'],
    cantrips: ['eldritch-blast', 'mage-hand'],
    spells: ['hex', 'hellish-rebuke'],
    story: {
      alignment: 'Chaotic neutral',
      age: '25',
      eyes: 'Solid gold',
      skin: 'Lavender',
      hair: 'Black, around curling horns',
      personality: 'Dry humour, and secrets she won’t share.',
    },
  },
  {
    key: 'wizard',
    name: 'Tinka Gearwhistle',
    race: 'gnome',
    subrace: 'rock-gnome',
    className: 'wizard',
    skills: ['arcana', 'investigation'],
    cantrips: ['fire-bolt', 'mage-hand', 'light'],
    spells: ['magic-missile', 'shield', 'sleep', 'mage-armor', 'burning-hands', 'detect-magic'],
    story: {
      alignment: 'Neutral good',
      age: '64',
      eyes: 'Bright blue',
      skin: 'Tan',
      hair: 'White and wild',
      personality: 'Endlessly curious about how things work.',
    },
  },
]

/** Good first spells, used when a class's preset or a random pick needs more. */
const GOOD_SPELLS = [
  'fire-bolt',
  'eldritch-blast',
  'sacred-flame',
  'vicious-mockery',
  'produce-flame',
  'ray-of-frost',
  'guidance',
  'light',
  'mage-hand',
  'shillelagh',
  'magic-missile',
  'shield',
  'healing-word',
  'cure-wounds',
  'bless',
  'sleep',
  'burning-hands',
  'hex',
  'hunters-mark',
  'faerie-fire',
  'thunderwave',
  'guiding-bolt',
  'charm-person',
  'entangle',
  'mage-armor',
  'detect-magic',
  'shield-of-faith',
  'sanctuary',
  'hellish-rebuke',
  'witch-bolt',
]
/** Sensible weapon and kit picks when a choice says "a martial weapon" or "a holy symbol". */
const GOOD_ITEMS = [
  'longsword',
  'rapier',
  'warhammer',
  'shortsword',
  'mace',
  'quarterstaff',
  'spear',
  'dagger',
  'handaxe',
  'lute',
  'amulet',
  'crystal',
  'sprig-of-mistletoe',
]

const NAMES: Record<string, string[]> = {
  dwarf: ['Dorna Flintbeard', 'Baern Coppervein', 'Eldeth Hammersong'],
  elf: ['Aelar Moonwhisper', 'Naivara Starbloom', 'Theren Galanodel'],
  halfling: ['Rosie Goodbarrel', 'Wellby Thorngage', 'Merric Brushgather'],
  human: ['Mara Holloway', 'Gareth Crane', 'Isolde Fenwick'],
  dragonborn: ['Medrash Flamebrow', 'Sora Embermaw', 'Kriv Stormcrest'],
  gnome: ['Nim Twistwick', 'Bimpnottin Fizzlebang', 'Orla Cogsworth'],
  'half-elf': ['Ellywick Fairbrook', 'Corin Ashdown', 'Liriel Vance'],
  'half-orc': ['Dench Stonefist', 'Shautha Grimtusk', 'Thokk Ironhide'],
  tiefling: ['Akta Cinder', 'Mordai Vex', 'Kallista Ember'],
}

const pickWith =
  (random: () => number) =>
  <T>(list: readonly T[]): T =>
    list[Math.floor(random() * list.length)]

function prefer<T extends string>(options: readonly T[], liked: readonly string[] = [], random?: () => number): T[] {
  const first = liked.filter((l) => options.includes(l as T)) as T[]
  const rest = options.filter((o) => !first.includes(o))
  if (random) {
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
  }
  return [...first, ...rest]
}

/**
 * A draft with every step filled in, from a preset or random picks. Whatever the preset doesn't
 * say is chosen sensibly (or at random, for Surprise me).
 */
export function autoDraft(preset: Preset, data: BuilderData, random?: () => number): BuilderDraft {
  const cls = data.classes.find((c) => c.index === preset.className) as SrdClass
  const race = data.races.races.find((r) => r.index === preset.race)
  let draft: BuilderDraft = withClassPicked(
    { ...emptyDraft(), race: preset.race, subrace: preset.subrace ?? race?.subraces[0]?.index ?? null },
    preset.className,
  )
  const order = abilityOrder(cls.index)

  // Race: a half-elf's +1s go where the class wants them; languages, ancestry and cantrip.
  if (race?.abilityBonusChoice) {
    draft.bonusPicks = order
      .filter((a) => race.abilityBonusChoice?.from.includes(a))
      .slice(0, race.abilityBonusChoice.choose)
  }
  const known = new Set(race?.languages ?? [])
  draft.languagePicks = prefer(
    LANGUAGES.filter((l) => !known.has(l)),
    ['Draconic', 'Elvish', 'Dwarvish'],
    random,
  ).slice(0, race ? languageChoices(race, draft.subrace) : 0)
  const traits = race ? [...race.traits, ...(race.subraces.find((s) => s.index === draft.subrace)?.traits ?? [])] : []
  for (const index of traits) {
    const choice = data.races.traits[index]?.choice
    if (!choice) continue
    const liked = choice.kind === 'spell' ? ['fire-bolt'] : ['draconic-ancestry-red', 'draconic-ancestry-gold']
    draft.traitPicks = { ...draft.traitPicks, [index]: prefer(choice.from, liked, random)[0] }
  }
  const raceSkillCount = traits.reduce((n, t) => n + (TRAIT_SKILL_PICKS[t] ?? 0), 0)
  const raceAuto = raceSummary(draft, data.races)?.skills ?? []

  // Class: skills, and anything a feature asks (fighting style, expertise, favoured enemy).
  const skillFrom = cls.skillChoices?.from ?? []
  draft.classSkillPicks = prefer(skillFrom, preset.skills, random)
    .filter((s) => !raceAuto.includes(s))
    .slice(0, cls.skillChoices?.choose ?? 0)
  draft.raceSkillPicks = prefer(
    ['perception', 'persuasion', 'stealth', 'insight', 'athletics', 'acrobatics'].filter(
      (s) => !draft.classSkillPicks.includes(s),
    ),
    preset.skills,
    random,
  ).slice(0, raceSkillCount)
  const race1 = raceSummary(draft, data.races)
  for (const ask of classSummary(draft, cls, data.features, race1).asks) {
    const liked = preset.features?.[ask.feature] ?? []
    draft.featurePicks = {
      ...draft.featurePicks,
      [ask.feature]: prefer(
        ask.options.map((o) => o.index),
        liked,
        random,
      ).slice(0, ask.choose),
    }
  }

  // Background: the Acolyte, with a swap for any skill had twice, and two languages.
  draft.background = 'acolyte'
  const background = backgroundSummary(draft, data.backgrounds, [...(race1?.skills ?? []), ...draft.classSkillPicks])
  const had = new Set([...(race1?.skills ?? []), ...draft.classSkillPicks, ...(background?.skills ?? [])])
  draft.backgroundSkillPicks = prefer(
    skillFrom.length ? skillFrom.filter((s) => !had.has(s)) : [],
    ['history', 'arcana', 'medicine'],
    random,
  ).slice(0, background?.skillPicks ?? 0)
  const knownNow = new Set([...(race1?.languages ?? [])])
  draft.backgroundLanguagePicks = prefer(
    LANGUAGES.filter((l) => !knownNow.has(l)),
    ['Celestial', 'Elvish', 'Dwarvish'],
    random,
  ).slice(0, background?.languages ?? 0)

  // Scores: the standard set, best where the class needs it (or random but balanced).
  draft = random
    ? { ...draft, scoreMethod: 'random', baseScores: randomBalanced(cls.index, random) }
    : { ...draft, scoreMethod: 'standard', baseScores: suggestScores(STANDARD_ARRAY, cls.index) }

  // Gear: the first option of each choice, with sensible picks for "a martial weapon" and the like.
  const gearPicks = (choices: SrdClass['startingChoices']) =>
    choices.map((choice) => {
      const option = random ? Math.floor(random() * choice.options.length) : 0
      const picks = choice.options[option].flatMap((part) =>
        'category' in part
          ? [prefer(data.equipment.categories[part.category] ?? [], GOOD_ITEMS).slice(0, part.choose)]
          : [],
      )
      return { option, picks }
    })
  draft.gearPicks = gearPicks(cls.startingChoices)
  const backgroundData = data.backgrounds.find((b) => b.index === 'acolyte')
  draft.backgroundGearPicks = backgroundData ? gearPicks(backgroundData.gearChoices) : []

  // Spells: the preset's, then good first spells from the class list.
  const scores = finalScores(draft, raceSummary(draft, data.races))
  const subclass = classSummary(draft, cls, data.features, raceSummary(draft, data.races)).subclass?.index ?? null
  const plan = spellPlan(cls, 1, subclass, scores, data.spells)
  const elfCantrip = draft.traitPicks['high-elf-cantrip']
  draft.cantripPicks = prefer(
    plan.cantripList.map((s) => s.index).filter((s) => s !== elfCantrip),
    [...(preset.cantrips ?? []), ...GOOD_SPELLS],
    random,
  ).slice(0, plan.cantrips)
  draft.spellPicks = prefer(
    plan.spellList.map((s) => s.index),
    [...(preset.spells ?? []), ...GOOD_SPELLS],
    random,
  ).slice(0, plan.spells)
  draft.preparedPicks = plan.prepare === null ? [] : draft.spellPicks.slice(0, plan.prepare)

  // Who they are: the preset's, with a height and weight usual for the race.
  const size = TYPICAL_SIZE[preset.race]
  const mid = (range: [number, number]) =>
    random ? range[0] + random() * (range[1] - range[0]) : (range[0] + range[1]) / 2
  draft.name = preset.name
  draft.story = {
    ...EMPTY_STORY,
    ...(size
      ? { height: heightText(Math.round(mid(size.height))), weight: weightText(Math.round(mid(size.weight))) }
      : {}),
    ideals: backgroundData?.ideals[0] ?? '',
    bonds: backgroundData?.bonds[0] ?? '',
    flaws: backgroundData?.flaws[0] ?? '',
    ...preset.story,
  }
  return draft
}

/** Surprise me: a random race and class, with every pick made at random but sensibly. */
export function surpriseDraft(data: BuilderData, random: () => number = Math.random): BuilderDraft {
  const pick = pickWith(random)
  const race = pick(data.races.races)
  const cls = pick(data.classes)
  const background = data.backgrounds.find((b) => b.index === 'acolyte')
  const alignments = [
    'Lawful good',
    'Neutral good',
    'Chaotic good',
    'Lawful neutral',
    'True neutral',
    'Chaotic neutral',
  ]
  return autoDraft(
    {
      key: 'surprise',
      name: pick(NAMES[race.index] ?? ['Ash Wanderer']),
      race: race.index,
      subrace: race.subraces.length ? pick(race.subraces).index : undefined,
      className: cls.index,
      story: {
        alignment: pick(alignments),
        age: String(Math.round(18 + random() * 40)),
        personality: background ? pick(background.personality) : '',
        ideals: background ? pick(background.ideals) : '',
        bonds: background ? pick(background.bonds) : '',
        flaws: background ? pick(background.flaws) : '',
      },
    },
    data,
    random,
  )
}
