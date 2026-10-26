// Everything the DM can ask for (screen 08): skill checks, plain ability checks and saving throws,
// each with a short line for the DM's buttons and a longer one for the player's prompt, plus the
// difficulty presets and how a requested roll is judged.

import { ABILITIES, ABILITY_NAME, type Ability } from './abilities.ts'
import { SKILLS } from './srd/index.ts'

export type AskKind = 'skill' | 'ability' | 'save'

export type Askable = {
  /** 'skill:perception', 'save:constitution', 'ability:strength'. */
  key: string
  kind: AskKind
  ability: Ability
  skill: string | null
  /** The button name: "Perception", "Constitution save", "Strength check". */
  name: string
  /** The full name: "Perception check", "Constitution saving throw". */
  label: string
  /** For the DM's button: "Notice something hidden". */
  short: string
  /** For the player's prompt: "Spot, hear or sense something that's easy to miss." */
  plain: string
}

const SKILL_WORDS: Record<string, [string, string]> = {
  acrobatics: ['Keep your balance or tumble', 'Stay on your feet, tumble past or keep your balance.'],
  'animal-handling': ['Calm or steer an animal', 'Calm, steer or read the mood of an animal.'],
  arcana: ['Recall magic lore', 'Remember what you know about spells, magic items and other planes.'],
  athletics: ['Climb, jump, swim or shove', 'Climb, jump, swim, or shove and grapple with brute strength.'],
  deception: ['Tell a convincing lie', 'Hide the truth with a straight face.'],
  history: ['Recall the past', 'Remember what you know of kingdoms, wars and legends.'],
  insight: ['Tell if someone is lying', 'Read someone’s face and work out what they really mean.'],
  intimidation: ['Scare someone into it', 'Use threats or a hard stare to get your way.'],
  investigation: ['Search for clues', 'Look closely and work out what happened here.'],
  medicine: ['Steady the dying or spot an illness', 'Stabilise a dying friend or work out what ails someone.'],
  nature: ['Recall nature lore', 'Remember what you know about plants, beasts and weather.'],
  perception: ['Notice something hidden', 'Spot, hear or sense something that’s easy to miss.'],
  performance: ['Entertain a crowd', 'Win over an audience with music, a story or a show.'],
  persuasion: ['Talk someone round', 'Win someone over with good manners and a good argument.'],
  religion: ['Recall religious lore', 'Remember what you know of gods, rites and holy symbols.'],
  'sleight-of-hand': ['Pick a pocket or palm something', 'Use quick fingers without anyone noticing.'],
  stealth: ['Move without being seen', 'Slip past unseen and unheard.'],
  survival: ['Track, hunt or find the way', 'Follow tracks, find food or keep from getting lost.'],
}

const SAVE_WORDS: Record<Ability, [string, string]> = {
  strength: ['Push back or break free', 'Hold your ground against something that pushes, pins or grabs you.'],
  dexterity: ['Dodge a trap or a blast', 'Throw yourself clear of a trap, a fall or a fireball.'],
  constitution: ['Resist poison or exhaustion', 'Steel yourself against poison, sickness or exhaustion.'],
  intelligence: ['See through an illusion', 'Keep your wits against illusions and tricks of the mind.'],
  wisdom: ['Resist fear or mind magic', 'Hold firm against fear, charms and magic that grips the mind.'],
  charisma: ['Hold on to who you are', 'Resist being banished, possessed or bent to another’s will.'],
}

const CHECK_WORDS: Record<Ability, [string, string]> = {
  strength: ['Lift, push or break', 'Force a door, lift a gate or win an arm-wrestle.'],
  dexterity: ['Something quick and nimble', 'Do something quick and nimble that no skill quite covers.'],
  constitution: ['Keep going', 'Hold your breath, keep drinking or push on through a long march.'],
  intelligence: ['Work it out', 'Puzzle something out with clear thinking.'],
  wisdom: ['Trust your gut', 'Follow a hunch or sense what’s right.'],
  charisma: ['Make an impression', 'Win the moment with sheer force of personality.'],
}

export const ASKABLES: Askable[] = [
  ...SKILLS.map((skill) => ({
    key: `skill:${skill.index}`,
    kind: 'skill' as const,
    ability: skill.ability,
    skill: skill.index,
    name: skill.name,
    label: `${skill.name} check`,
    short: SKILL_WORDS[skill.index]?.[0] ?? '',
    plain: SKILL_WORDS[skill.index]?.[1] ?? '',
  })),
  ...ABILITIES.map((ability) => ({
    key: `save:${ability}`,
    kind: 'save' as const,
    ability,
    skill: null,
    name: `${ABILITY_NAME[ability]} save`,
    label: `${ABILITY_NAME[ability]} saving throw`,
    short: SAVE_WORDS[ability][0],
    plain: SAVE_WORDS[ability][1],
  })),
  ...ABILITIES.map((ability) => ({
    key: `ability:${ability}`,
    kind: 'ability' as const,
    ability,
    skill: null,
    name: `${ABILITY_NAME[ability]} check`,
    label: `${ABILITY_NAME[ability]} check`,
    short: CHECK_WORDS[ability][0],
    plain: CHECK_WORDS[ability][1],
  })),
]

/** The nine on the Ask for a roll screen; the rest are under "Any other skill or save". */
export const PRESET_KEYS = [
  'skill:perception',
  'skill:investigation',
  'skill:insight',
  'skill:stealth',
  'skill:athletics',
  'skill:persuasion',
  'save:dexterity',
  'save:constitution',
  'save:wisdom',
]

export function findAskable(key: string): Askable | undefined {
  return ASKABLES.find((askable) => askable.key === key)
}

/** The Askable for a saved request. */
export function askableFor(request: { kind: string; ability: string; skill: string | null }): Askable | undefined {
  return findAskable(request.kind === 'skill' ? `skill:${request.skill}` : `${request.kind}:${request.ability}`)
}

export const DIFFICULTIES = [
  { name: 'Easy', dc: 10, plain: 'Most people manage' },
  { name: 'Medium', dc: 15, plain: 'A real challenge' },
  { name: 'Hard', dc: 20, plain: 'Only the skilled or lucky' },
  { name: 'Very hard', dc: 25, plain: 'The stuff of legend' },
]

/**
 * Checks and saves are decided by the total alone: meet or beat the DC to pass. A natural 20 or 1
 * makes no difference here (it only does on attack rolls).
 */
export function passes(total: number, dc: number): boolean {
  return total >= dc
}

/** "Everyone", "Elowen", "Thorin and Elowen", "Thorin, Elowen and Pip". */
export function namesText(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
