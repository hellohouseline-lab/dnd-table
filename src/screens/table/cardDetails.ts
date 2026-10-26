// What a card in your hand does, in plain words, for the side panel that opens when you click it:
// an attack's numbers and reach, a spell's effect and how it's cast, a feature's effect and uses.

import type { AttackEntry, Character, FeatureEntry } from '../../rules/character.ts'
import {
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

export type CardDetails = {
  /** "Attack", "1st-level evocation", "Feature". */
  kind: string
  title: string
  /** The numbers and facts, one per line. */
  lines: string[]
  /** What it takes from your turn. */
  cost: FeatureCost
  /** The full rules text, under More. */
  more: string | null
}

const PROPERTY_WORDS: Record<string, string> = {
  finesse: 'finesse (Strength or Dexterity)',
  light: 'light (a second one in your other hand)',
  heavy: 'heavy',
  reach: 'reach (10 ft)',
  thrown: 'thrown',
  'two-handed': 'two-handed',
  versatile: 'versatile',
  loading: 'loading (one shot a turn)',
  ammunition: 'needs ammunition',
}

export function attackDetails(character: Character, attack: AttackEntry): CardDetails {
  const weapon = findWeapon(attack.weapon)
  const derived = deriveSheet(character).attacks.find((a) => a.entry.id === attack.id)?.result
  const lines: string[] = []
  if (derived) {
    lines.push(`${formatBonus(derived.toHit)} to hit · ${derived.damage} ${derived.damageType.toLowerCase()}`)
    if (derived.versatileDamage) lines.push(`Two-handed: ${derived.versatileDamage}`)
  }
  if (weapon?.range === 'Ranged')
    lines.push(`Range ${weapon.normalRange ?? '?'}/${weapon.longRange ?? '?'} ft (the second number with disadvantage)`)
  else if (weapon?.properties.includes('thrown')) {
    lines.push(`Reach 5 ft, or thrown ${weapon.normalRange ?? '?'}/${weapon.longRange ?? '?'} ft`)
  } else lines.push(`Melee, reach ${weapon?.properties.includes('reach') ? 10 : 5} ft`)
  const properties = (weapon?.properties ?? []).filter((p) => p !== 'reach' && PROPERTY_WORDS[p])
  if (properties.length > 0)
    lines.push(
      properties
        .map((p) => PROPERTY_WORDS[p])
        .join(', ')
        .replace(/^./, (c) => c.toUpperCase()),
    )
  if (isRaging(character) && derived?.ability === 'strength' && weapon?.range !== 'Ranged') {
    lines.push(`Raging: +${rageDamage(character.level)} damage, added when you roll`)
  }
  return { kind: 'Attack', title: attack.name || weapon?.name || 'Attack', lines, cost: 'action', more: null }
}

export function spellDetails(character: Character, spell: SrdSpell): CardDetails {
  const cost = castingCost(spell.castingTime)
  const summary = spellSummary(spell, character)
  return {
    kind:
      spell.level === 0
        ? `Cantrip · ${spell.school.toLowerCase()}`
        : `${levelWords(spell.level)}-level ${spell.school.toLowerCase()}`,
    title: spell.name,
    lines: [
      ...(summary ? [summary] : []),
      `${spell.castingTime} · ${spell.range} · ${spell.duration}`,
      ...(spell.concentration
        ? ['Concentration: casting another concentration spell, or failing a save when hurt, ends it']
        : []),
      ...(spell.area ? [`Covers a ${spell.area.size} ft ${spell.area.type}`] : []),
      `Components: ${spell.components}`,
    ],
    cost: cost === 'longer' ? 'free' : cost,
    more: [spell.desc, spell.higherLevel ? `At higher levels. ${spell.higherLevel}` : ''].filter(Boolean).join('\n\n'),
  }
}

/** The first sentence or two of a description, for features the table doesn't run itself. */
function opening(text: string): string {
  const sentences = text.split(/(?<=\.)\s+/).filter(Boolean)
  return sentences.slice(0, 2).join(' ')
}

export function featureDetails(character: Character, feature: FeatureEntry): CardDetails {
  const rule = featureRule(feature.name)
  const lines = [featureSummary(rule, character.level) ?? opening(feature.description)]
  if (feature.usesMax !== null) {
    const back = feature.recharge === 'short' ? 'back after a short or long rest' : 'back after a long rest'
    lines.push(`${feature.usesLeft} of ${feature.usesMax} uses left, ${back}`)
  }
  return {
    kind: 'Feature',
    title: feature.name,
    lines: lines.filter(Boolean),
    cost: featureCost(feature.name, feature.description),
    more: feature.description || null,
  }
}
