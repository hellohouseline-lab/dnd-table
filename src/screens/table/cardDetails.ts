// What a card in your hand does, for the card that shows when you hover on it: a title, four boxes
// of numbers (a spell's casting time, range, components and duration; a weapon's to hit, damage,
// reach and kind), what it does as short bullet points, and a foot line (a spell's school and level).

import type { IconName } from '../../components/Icon.tsx'
import type { AttackEntry, Character, FeatureEntry } from '../../rules/character.ts'
import {
  COST_WORDS,
  durationRounds,
  featureCost,
  featureRule,
  featureSummary,
  isRaging,
  rageDamage,
  type FeatureCost,
} from '../../rules/features.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { castingCost, spellSummary } from '../../rules/spells.ts'
import { findWeapon, type SrdSpell } from '../../rules/srd/index.ts'
import { levelWords } from '../fight/useCasting.ts'

export type CardStat = { label: string; value: string }

export type CardDetails = {
  kind: 'spell' | 'weapon' | 'feature' | 'move'
  title: string
  /** The picture in the medallion: the weapon's kind, a star for spells. */
  icon: IconName
  /** Up to four boxes under the title. */
  stats: CardStat[]
  /** What it does, one point each. */
  bullets: string[]
  /** The foot of the card: a spell's school and level; a weapon's kind and damage type. */
  footer: [string, string]
  /** What it takes from your turn. */
  cost: FeatureCost
  /** A concentration spell: marked on the banner. */
  concentration?: boolean
}

/** Most bullet points a card shows; the rest is on your sheet. */
const MOST_BULLETS = 7

const PROPERTY_WORDS: Record<string, string> = {
  finesse: 'Finesse: use Strength or Dexterity, whichever is better',
  light: 'Light: hold a second light weapon to attack with it as a bonus action',
  heavy: 'Heavy: small creatures attack with it at disadvantage',
  thrown: 'Thrown: you can throw it and use the same ability',
  'two-handed': 'Two-handed: needs both hands',
  versatile: 'Versatile: more damage held in two hands',
  loading: 'Loading: only one shot with it per action',
  ammunition: 'Needs ammunition, which you can find again after a fight',
}

/** The picture for a weapon, from its name. */
export function weaponIcon(name: string): IconName {
  const n = name.toLowerCase()
  if (/crossbow/.test(n)) return 'crossbow'
  if (/bow/.test(n)) return 'bow'
  if (/dagger|knife|sickle/.test(n)) return 'dagger'
  if (/axe/.test(n)) return 'axe'
  if (/hammer|mace|maul|club|flail|morningstar/.test(n)) return 'hammer'
  if (/spear|javelin|pike|halberd|glaive|trident|lance|dart/.test(n)) return 'spear'
  if (/staff/.test(n)) return 'staff'
  if (/sling/.test(n)) return 'sling'
  if (/whip/.test(n)) return 'whip'
  return 'sword'
}

/** "150 feet" as "150 ft"; "Self (15-foot cone)" as "Self, 15 ft cone". */
function shortRange(range: string): string {
  return range
    .replace(/(\d+)[- ]feet\b|(\d+)[- ]foot\b/gi, (_, a: string, b: string) => `${a ?? b} ft`)
    .replace(/\s*\((.*)\)/, ', $1')
}

/** "V, S, M (a pinch of salt)" as ["V, S, M", "a pinch of salt"]. */
function splitComponents(components: string): [string, string | null] {
  const match = components.match(/^([^(]*)\((.*)\)\s*$/)
  return match ? [match[1].trim(), match[2].trim()] : [components.trim(), null]
}

/** A description cut into sentences, one bullet point each. */
export function toBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((sentence) => sentence.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
}

function capped(bullets: string[]): string[] {
  if (bullets.length <= MOST_BULLETS) return bullets
  return [...bullets.slice(0, MOST_BULLETS - 1), 'More on your character sheet.']
}

export function attackDetails(character: Character, attack: AttackEntry): CardDetails {
  const weapon = findWeapon(attack.weapon)
  const derived = deriveSheet(character).attacks.find((a) => a.entry.id === attack.id)?.result
  const ranged = weapon?.range === 'Ranged'
  const reach = ranged
    ? `${weapon?.normalRange ?? '?'}/${weapon?.longRange ?? '?'} ft`
    : weapon?.properties.includes('thrown')
      ? `5 ft, thrown ${weapon.normalRange ?? '?'}/${weapon.longRange ?? '?'}`
      : `${weapon?.properties.includes('reach') ? 10 : 5} ft`
  const bullets: string[] = []
  if (derived?.versatileDamage) bullets.push(`Two hands: ${derived.versatileDamage} damage`)
  if (ranged || weapon?.properties.includes('thrown')) {
    bullets.push('Past the first range number, you attack with disadvantage')
  }
  for (const p of weapon?.properties ?? []) {
    if (PROPERTY_WORDS[p] && !(p === 'versatile' && derived?.versatileDamage)) bullets.push(PROPERTY_WORDS[p])
  }
  if (isRaging(character) && derived?.ability === 'strength' && !ranged) {
    bullets.push(`Raging: +${rageDamage(character.level)} damage, added when you roll`)
  }
  bullets.push('Click the card, then click who you are attacking')
  const damageType = derived?.damageType ?? weapon?.damageType ?? ''
  return {
    kind: 'weapon',
    title: attack.name || weapon?.name || 'Attack',
    icon: weaponIcon(attack.weapon || attack.name),
    stats: [
      { label: 'To hit', value: derived ? formatBonus(derived.toHit) : '?' },
      { label: 'Damage', value: derived ? derived.damage : (weapon?.damageDice ?? '?') },
      { label: ranged ? 'Range' : 'Reach', value: reach },
      { label: 'Uses', value: derived ? (derived.ability === 'strength' ? 'Strength' : 'Dexterity') : '?' },
    ],
    bullets: capped(bullets),
    footer: [
      weapon ? `${weapon.category} ${ranged ? 'ranged' : 'melee'} weapon` : 'Weapon',
      damageType ? damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase() : '',
    ],
    cost: 'action',
  }
}

export function spellDetails(character: Character, spell: SrdSpell): CardDetails {
  const cost = castingCost(spell.castingTime)
  const summary = spellSummary(spell, character)
  const [components, material] = splitComponents(spell.components)
  const bullets = [...(summary ? [summary.charAt(0).toUpperCase() + summary.slice(1)] : []), ...toBullets(spell.desc)]
  const extra = [
    ...(material ? [`Needs ${material}`] : []),
    ...(spell.concentration
      ? [
          character.concentration && character.concentration !== spell.name
            ? `Casting this ends your concentration on ${character.concentration}`
            : 'Concentration: one spell at a time. Each time you take damage, a Constitution save (DC 10 or half the damage) keeps it; being knocked out or stunned ends it',
        ]
      : []),
    ...(spell.higherLevel ? [`Higher levels: ${spell.higherLevel.replace(/^At Higher Levels\.?\s*/i, '')}`] : []),
  ]
  // The extras matter most for play, so they keep their place when the description is long.
  const room = Math.max(1, MOST_BULLETS - extra.length)
  const cut = bullets.length > room
  const body = cut ? bullets.slice(0, room - 1) : bullets
  return {
    kind: 'spell',
    title: spell.name,
    icon: 'star',
    stats: [
      { label: 'Casting time', value: spell.castingTime },
      { label: 'Range', value: shortRange(spell.range) },
      { label: 'Components', value: components },
      {
        label: 'Duration',
        value: spell.concentration ? `Concentration, ${spell.duration.replace(/^up to/i, 'up to')}` : spell.duration,
      },
    ],
    bullets: [...body, ...extra, ...(cut ? ['More on your character sheet.'] : [])],
    footer: [
      `${spell.school}${spell.ritual ? ' · ritual' : ''}`,
      spell.level === 0 ? 'Cantrip' : `${levelWords(spell.level)} level`,
    ],
    cost: cost === 'longer' ? 'free' : cost,
    concentration: spell.concentration,
  }
}

export function featureDetails(character: Character, feature: FeatureEntry): CardDetails {
  const rule = featureRule(feature.name)
  const cost = featureCost(feature.name, feature.description)
  const summary = featureSummary(rule, character.level)
  const bullets = summary ? toBullets(summary) : toBullets(feature.description)
  // "for 1 minute" in its text, counted in rounds as the fight counts it.
  const time = (summary ?? feature.description).match(/\bfor (\d+ (?:round|minute|hour)s?)\b/i)?.[1]
  const rounds = time ? durationRounds(time) : null
  const lasts = time ? (rounds !== null && rounds <= 100 ? `${time} (${rounds} rounds)` : time) : null
  return {
    kind: 'feature',
    title: feature.name,
    icon: 'powers',
    stats: [
      { label: 'Takes', value: COST_WORDS[cost].replace(/^Your /, '').replace(/^./, (c) => c.toUpperCase()) },
      {
        label: 'Uses',
        value: feature.usesMax === null ? 'Always' : `${feature.usesLeft} of ${feature.usesMax}`,
      },
      {
        label: 'Back after',
        value: feature.usesMax === null ? '-' : feature.recharge === 'short' ? 'Short rest' : 'Long rest',
      },
      ...(lasts ? [{ label: 'Lasts', value: lasts }] : []),
    ],
    bullets: capped(bullets),
    footer: ['Feature', character.className ? `${character.className} ${character.level}` : `Level ${character.level}`],
    cost,
  }
}

/** Dash, Disengage, Hide or Dodge, taken as a bonus action. */
export function moveDetails(name: string, what: string): CardDetails {
  return {
    kind: 'move',
    title: name,
    icon: 'leave',
    stats: [
      { label: 'Takes', value: 'Bonus action' },
      { label: 'Lasts', value: 'This turn' },
    ],
    bullets: [what, 'Keeps your action free for an attack or spell'],
    footer: ['Bonus action', ''],
    cost: 'bonus',
  }
}
