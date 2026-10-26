// Bonus actions (2014 rules, SRD 5.1): what each class, subclass, race, weapon and spell lets you do
// with your bonus action, and which ones something on your turn has just made ready (attacking
// with the Attack action opens up an off-hand attack, a monk's unarmed strike and Flurry of Blows).
// You get one bonus action a turn, only on your turn, and only when something gives you one.
//
// Spells with a casting time of 1 bonus action come from the spell list itself. Features from
// books outside the SRD are entered by the group with their own text, and count as bonus actions
// when that text says so (see featureCost). None of the SRD races has a bonus action.

import type { AttackEntry, Character } from './character.ts'
import { abilityModifier } from './maths/core.ts'
import { isRaging, RAGE } from './features.ts'
import { findWeapon } from './srd/index.ts'

/** Attacks made with the bonus action, each checked by the server. */
export type BonusAttackKind = 'offhand' | 'martialArts' | 'flurry' | 'frenzy'

/** When an option can be used. */
export type BonusTrigger =
  /** Any time on your turn. */
  | 'always'
  /** After you've attacked with the Attack action this turn. */
  | 'afterAttack'
  /** While you're raging. */
  | 'whileRaging'

export type BonusEntry = {
  key: string
  name: string
  /** Where it comes from, in plain words: "Rogue, level 2". */
  source: string
  /** What it does, in plain words. */
  what: string
  trigger: BonusTrigger
  /** What else it costs: "1 ki point". */
  cost?: string
  /** The class and subclass that have it, and from which level; none for everyone. */
  className?: string
  subclass?: string
  level?: number
  /** The table rolls it as an attack. */
  attack?: BonusAttackKind
  /** The sheet feature that holds its uses (Rage, Second Wind); the table plays that card. */
  feature?: string
  /** Names of features on the sheet that this entry stands for, so they aren't shown twice. */
  covers?: string[]
}

/** Every SRD class and subclass bonus action, plus two-weapon fighting for anyone. */
export const BONUS_CATALOGUE: BonusEntry[] = [
  {
    key: 'offhand',
    name: 'Off-hand attack',
    source: 'Two-weapon fighting (anyone)',
    what: 'After attacking with a light melee weapon, attack with the light weapon in your other hand. No ability bonus to its damage.',
    trigger: 'afterAttack',
    attack: 'offhand',
  },
  {
    key: 'rage',
    name: 'Rage',
    source: 'Barbarian, level 1',
    what: 'Rage for 1 minute: extra damage, resistance to weapon damage, advantage on Strength checks and saves.',
    trigger: 'always',
    className: 'barbarian',
    level: 1,
    feature: 'Rage',
  },
  {
    key: 'frenzy',
    name: 'Frenzy attack',
    source: 'Barbarian (Berserker), level 3',
    what: 'While in a frenzied rage, make one melee weapon attack on each of your turns after the first. You gain a level of exhaustion when the rage ends.',
    trigger: 'whileRaging',
    className: 'barbarian',
    subclass: 'berserker',
    level: 3,
    attack: 'frenzy',
    covers: ['Frenzy'],
  },
  {
    key: 'bardic-inspiration',
    name: 'Bardic Inspiration',
    source: 'Bard, level 1',
    what: 'Give a creature within 60 ft who can hear you an inspiration die to add to one roll in the next 10 minutes.',
    trigger: 'always',
    className: 'bard',
    level: 1,
    feature: 'Bardic Inspiration',
  },
  {
    key: 'second-wind',
    name: 'Second Wind',
    source: 'Fighter, level 1',
    what: 'Regain 1d10 + your fighter level in hit points. Once per short or long rest.',
    trigger: 'always',
    className: 'fighter',
    level: 1,
    feature: 'Second Wind',
  },
  {
    key: 'martial-arts',
    name: 'Unarmed strike',
    source: 'Monk (Martial Arts), level 1',
    what: 'After attacking with an unarmed strike or a monk weapon, make one unarmed strike.',
    trigger: 'afterAttack',
    className: 'monk',
    level: 1,
    attack: 'martialArts',
    covers: ['Martial Arts'],
  },
  {
    key: 'flurry',
    name: 'Flurry of Blows',
    source: 'Monk (Ki), level 2',
    what: 'After taking the Attack action, make two unarmed strikes.',
    trigger: 'afterAttack',
    cost: '1 ki point',
    className: 'monk',
    level: 2,
    attack: 'flurry',
    covers: ['Flurry of Blows'],
  },
  {
    key: 'patient-defense',
    name: 'Patient Defense',
    source: 'Monk (Ki), level 2',
    what: 'Take the Dodge action: attacks against you have disadvantage until your next turn.',
    trigger: 'always',
    cost: '1 ki point',
    className: 'monk',
    level: 2,
    covers: ['Patient Defense'],
  },
  {
    key: 'step-of-the-wind',
    name: 'Step of the Wind',
    source: 'Monk (Ki), level 2',
    what: 'Take the Dash or Disengage action, and your jump distance is doubled this turn.',
    trigger: 'always',
    cost: '1 ki point',
    className: 'monk',
    level: 2,
    covers: ['Step of the Wind'],
  },
  {
    key: 'cunning-action',
    name: 'Cunning Action',
    source: 'Rogue, level 2',
    what: 'Take the Dash, Disengage or Hide action.',
    trigger: 'always',
    className: 'rogue',
    level: 2,
    covers: ['Cunning Action'],
  },
  {
    key: 'fast-hands',
    name: 'Fast Hands',
    source: 'Rogue (Thief), level 3',
    what: 'Make a Sleight of Hand check, use thieves’ tools on a trap or lock, or use an object.',
    trigger: 'always',
    className: 'rogue',
    subclass: 'thief',
    level: 3,
    covers: ['Fast Hands'],
  },
  {
    key: 'font-of-magic',
    name: 'Font of Magic',
    source: 'Sorcerer, level 2',
    what: 'Turn sorcery points into a spell slot, or a spell slot into sorcery points.',
    trigger: 'always',
    className: 'sorcerer',
    level: 2,
    covers: ['Font of Magic', 'Flexible Casting'],
  },
  {
    key: 'quickened-spell',
    name: 'Quickened Spell',
    source: 'Sorcerer (Metamagic), level 3',
    what: 'Cast a spell that takes 1 action as a bonus action instead, for 2 sorcery points.',
    trigger: 'always',
    cost: '2 sorcery points',
    className: 'sorcerer',
    level: 3,
    feature: 'Quickened Spell',
  },
]

type Who = Pick<Character, 'className' | 'subclass' | 'level' | 'features' | 'attacks'> & {
  effects?: Character['effects']
}

function has(who: Who, name: string): boolean {
  const wanted = name.toLowerCase()
  return who.features.some((f) => f.name.trim().toLowerCase() === wanted)
}

/** The bonus actions this character has at all, from the catalogue. */
export function bonusEntries(who: Who): BonusEntry[] {
  const className = who.className.toLowerCase()
  const subclass = who.subclass.toLowerCase()
  return BONUS_CATALOGUE.filter((entry) => {
    if (entry.key === 'offhand') return lightWeapons(who).length >= 2
    if (entry.className && !className.includes(entry.className)) return false
    if (entry.level && who.level < entry.level) return false
    if (entry.subclass && !subclass.includes(entry.subclass)) return false
    // Metamagic is a choice: only if it's on the sheet.
    if (entry.key === 'quickened-spell') return has(who, 'Quickened Spell')
    return true
  })
}

/** Light melee weapons on the sheet, for two-weapon fighting. */
export function lightWeapons(who: Pick<Character, 'attacks'>): AttackEntry[] {
  return who.attacks.filter((a) => {
    const weapon = findWeapon(a.weapon)
    return Boolean(weapon && weapon.range === 'Melee' && weapon.properties.includes('light'))
  })
}

/** Feature names on the sheet that a catalogue entry stands for (shown once, as the entry). */
export function coveredFeatures(who: Who): Set<string> {
  return new Set(bonusEntries(who).flatMap((e) => (e.covers ?? []).map((name) => name.toLowerCase())))
}

/** This turn so far, as far as bonus actions care. */
export type BonusTurn = { myTurn: boolean; bonusUsed: boolean; attacksMade: number }

/** Whether something on this turn has made an entry ready. */
export function isReady(entry: BonusEntry, who: Who, turn: BonusTurn): boolean {
  if (!turn.myTurn || turn.bonusUsed) return false
  if (entry.trigger === 'afterAttack') return turn.attacksMade > 0
  // Frenzy starts the turn after the rage does (a fresh rage still has all 10 rounds).
  if (entry.trigger === 'whileRaging') {
    const rage = (who.effects ?? []).find((e) => e.key === RAGE.key)
    return isRaging(who) && (rage?.roundsLeft === undefined || rage.roundsLeft < 10)
  }
  return true
}

/**
 * The bonus actions something has just made ready (you attacked, you're raging), to offer the
 * player and tell the DM. The always-on ones are on the cards already.
 */
export function triggeredBonus(who: Who, turn: BonusTurn): BonusEntry[] {
  return bonusEntries(who).filter((e) => e.trigger !== 'always' && isReady(e, who, turn))
}

/** A monk's Martial Arts die: d4, then d6 from level 5, d8 from 11, d10 from 17. */
export function martialArtsDie(level: number): string {
  return level >= 17 ? '1d10' : level >= 11 ? '1d8' : level >= 5 ? '1d6' : '1d4'
}

/**
 * A monk's unarmed strike as an attack on the sheet: Dexterity or Strength, whichever is better,
 * with proficiency, for the Martial Arts die in bludgeoning damage.
 */
export function unarmedStrike(who: Pick<Character, 'level' | 'scores'>): AttackEntry {
  const dex = abilityModifier(who.scores.dexterity)
  const str = abilityModifier(who.scores.strength)
  return {
    id: 'unarmed-strike',
    name: 'Unarmed strike',
    weapon: null,
    proficient: true,
    magicBonus: 0,
    ability: dex >= str ? 'dexterity' : 'strength',
    damageDice: martialArtsDie(who.level),
    damageType: 'bludgeoning',
  }
}
