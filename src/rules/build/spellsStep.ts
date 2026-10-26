// The builder's Spells step (2014 rules): how many cantrips and spells a class picks at a level,
// from which list, and which spells its subclass always has ready.
//   * Bards, sorcerers, warlocks and rangers know a set number of spells.
//   * Clerics and druids prepare their level plus their Wisdom modifier from the whole class list.
//   * Wizards write spells into a spellbook (six at level 1, two more each level) and prepare their
//     level plus their Intelligence modifier from it.

import { entryId, type SpellEntry } from '../character.ts'
import type { SrdClass, SrdSpell } from '../srd/index.ts'
import type { BuilderDraft } from './draft.ts'
import { preparedCount } from './levelUp.ts'
import type { Scores } from './scores.ts'

export type SpellPlan = {
  /** Cantrips to pick. */
  cantrips: number
  /** Spells to pick: known (bard, sorcerer, warlock, ranger), written in the book (wizard), or prepared (cleric, druid). */
  spells: number
  /** How the spells are kept, for the words on the step. */
  how: 'known' | 'spellbook' | 'prepared' | 'none'
  /** A wizard prepares this many from their book. */
  prepare: number | null
  /** The highest spell level the slots reach. */
  maxLevel: number
  cantripList: SrdSpell[]
  spellList: SrdSpell[]
  /** Spells the subclass always has prepared (a Life cleric's Bless and Cure Wounds). */
  always: SrdSpell[]
}

const KNOWN = ['bard', 'sorcerer', 'warlock', 'ranger']

export function spellPlan(
  cls: SrdClass,
  level: number,
  subclass: string | null,
  scores: Scores | null,
  spells: SrdSpell[],
): SpellPlan {
  const row = cls.levels[level]
  const maxLevel = (row?.slots ?? []).reduce((top, n, i) => (n > 0 ? i + 1 : top), 0)
  const prepared = preparedCount(cls.index, level, scores ?? {})
  const how: SpellPlan['how'] = !cls.spellcastingAbility
    ? 'none'
    : cls.index === 'wizard'
      ? 'spellbook'
      : KNOWN.includes(cls.index)
        ? 'known'
        : 'prepared'
  const spellCount =
    how === 'spellbook'
      ? 6 + (level - 1) * 2
      : how === 'known'
        ? (row?.spellsKnown ?? 0)
        : maxLevel > 0
          ? (prepared ?? 0)
          : 0
  const ofClass = spells.filter((s) => s.classes.includes(cls.index))
  const alwaysIndexes = (subclass ? (cls.subclassSpells[subclass] ?? []) : [])
    .filter((s) => s.level <= level && !s.terrain)
    .map((s) => s.spell)
  return {
    cantrips: row?.cantripsKnown ?? 0,
    spells: spellCount,
    how,
    prepare: how === 'spellbook' ? prepared : null,
    maxLevel,
    cantripList: ofClass.filter((s) => s.level === 0),
    spellList: ofClass.filter((s) => s.level >= 1 && s.level <= maxLevel && !alwaysIndexes.includes(s.index)),
    always: alwaysIndexes.flatMap((index) => spells.filter((s) => s.index === index)),
  }
}

/** What's still to pick, in plain words. */
export function spellsMissing(draft: BuilderDraft, plan: SpellPlan): string[] {
  const missing: string[] = []
  const cantrips = draft.cantripPicks.length
  const chosen = draft.spellPicks.length
  if (cantrips < plan.cantrips)
    missing.push(`Pick ${plan.cantrips - cantrips} more cantrip${plan.cantrips - cantrips === 1 ? '' : 's'}`)
  if (chosen < plan.spells) {
    const word = plan.how === 'prepared' ? 'to prepare' : plan.how === 'spellbook' ? 'for your spellbook' : ''
    missing.push(`Pick ${plan.spells - chosen} more spell${plan.spells - chosen === 1 ? '' : 's'} ${word}`.trim())
  }
  if (plan.prepare !== null && draft.preparedPicks.length < Math.min(plan.prepare, chosen)) {
    missing.push(`Prepare ${Math.min(plan.prepare, chosen) - draft.preparedPicks.length} more from your book`)
  }
  return missing
}

/** The sheet's spell list: cantrips, picked spells (prepared or not), and the subclass's, always ready. */
export function spellEntries(draft: BuilderDraft, plan: SpellPlan, spells: SrdSpell[]): SpellEntry[] {
  const find = (index: string) => spells.find((s) => s.index === index)
  const entry = (spell: SrdSpell, prepared: boolean): SpellEntry => ({
    id: entryId(),
    index: spell.index,
    name: spell.name,
    level: spell.level,
    prepared,
  })
  return [
    ...draft.cantripPicks.flatMap((i) => (find(i) ? [entry(find(i)!, true)] : [])),
    ...draft.spellPicks.flatMap((i) => {
      const spell = find(i)
      if (!spell) return []
      // Only a wizard leaves some of their spells unprepared.
      return [entry(spell, plan.how !== 'spellbook' || draft.preparedPicks.includes(i))]
    }),
    ...plan.always.map((spell) => entry(spell, true)),
  ]
}
