// The spellbook on the Powers tab: every spell in the free rules, searched and sorted by level, with
// the character level a class can first cast each one, and how a spell joins a character's list.

import type { Character, SpellEntry } from './character.ts'
import { spellCounts, spellLimits, spellWay } from './manage.ts'
import type { SrdClass, SrdSpell } from './srd/index.ts'

/** Which spells to show: a level (0 for cantrips) or all, this class's list or every class's, and words to find. */
export type SpellbookFilter = { level: number | 'all'; classIndex: string | null; search: string }

/** Spells matching the filter, by level then name. Words are found in the name first, then anywhere in the text. */
export function spellbookList(spells: SrdSpell[], filter: SpellbookFilter): SrdSpell[] {
  const words = filter.search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (spell: SrdSpell, text: (s: SrdSpell) => string) => words.every((w) => text(spell).includes(w))
  const shown = spells.filter(
    (s) =>
      (filter.level === 'all' || s.level === filter.level) &&
      (filter.classIndex === null || s.classes.includes(filter.classIndex)),
  )
  const byLevel = (a: SrdSpell, b: SrdSpell) => a.level - b.level || a.name.localeCompare(b.name)
  if (words.length === 0) return shown.sort(byLevel)
  const named = shown.filter((s) => matches(s, (x) => x.name.toLowerCase())).sort(byLevel)
  const described = shown
    .filter((s) => !named.includes(s) && matches(s, (x) => `${x.name} ${x.desc} ${x.higherLevel ?? ''}`.toLowerCase()))
    .sort(byLevel)
  return [...named, ...described]
}

/** Warlocks cast 6th to 9th level spells once a day (Mystic Arcanum) from levels 11, 13, 15 and 17. */
const ARCANUM_FROM: Record<number, number> = { 6: 11, 7: 13, 8: 15, 9: 17 }

/** The first character level at which this class can cast spells of this level, or null if never. */
export function castableFrom(cls: SrdClass, spellLevel: number): number | null {
  if (!cls.spellcastingAbility) return null
  if (spellLevel === 0) return (cls.levels['1']?.cantripsKnown ?? 0) > 0 ? 1 : null
  for (let level = 1; level <= 20; level += 1) {
    const slots = cls.levels[String(level)]?.slots ?? []
    if (slots.some((n, i) => n > 0 && i + 1 >= spellLevel)) return level
  }
  return cls.index === 'warlock' ? (ARCANUM_FROM[spellLevel] ?? null) : null
}

export type SpellCount = { label: string; have: number; of: number; over: boolean }

/** "Cantrips 3 of 3", then "Known 3 of 4" or "Prepared 4 of 5", for the character's class and level. */
export function spellCountsFor(
  character: Pick<Character, 'level' | 'scores' | 'features' | 'spellcasting'>,
  cls: SrdClass,
): SpellCount[] {
  const limits = spellLimits(character, cls)
  if (limits.way === 'none') return []
  const counts = spellCounts(character)
  const count = (label: string, have: number, of: number) => ({ label, have, of, over: have > of })
  const out: SpellCount[] = []
  if (limits.cantrips > 0 || counts.cantrips > 0) out.push(count('Cantrips', counts.cantrips, limits.cantrips))
  if (limits.known !== null) out.push(count('Known', counts.spells, limits.known))
  if (limits.prepared !== null) out.push(count('Prepared', counts.prepared, limits.prepared))
  return out
}

/** Whether this class marks spells as prepared each day (clerics, druids, paladins, wizards). */
export function preparesSpells(cls: SrdClass | undefined): boolean {
  if (!cls) return true
  const way = spellWay(cls)
  return way === 'prepared' || way === 'spellbook'
}

/**
 * A spell from the book joining the character's list. Cantrips and spells a class knows are ready
 * straight away; a class that prepares has it prepared while there's room. A spell above the
 * character's level waits, unprepared, until they can cast it.
 */
export function newSpellEntry(
  spell: SrdSpell,
  character: Pick<Character, 'level' | 'scores' | 'features' | 'spellcasting'>,
  cls: SrdClass | undefined,
  id: string,
): SpellEntry {
  let prepared = true
  if (spell.level > 0 && cls) {
    const from = castableFrom(cls, spell.level)
    if (from !== null && from > character.level) prepared = false
    else if (preparesSpells(cls))
      prepared = spellCounts(character).prepared < (spellLimits(character, cls).prepared ?? 0)
  }
  return { id, index: spell.index, name: spell.name, level: spell.level, prepared }
}

/** Slots for one spell level, one more or one fewer; never below 0 or above 9, and never fewer than are used. */
export function changeSlots(
  spellcasting: Character['spellcasting'],
  index: number,
  by: 1 | -1,
): Character['spellcasting'] {
  const max = Math.min(9, Math.max(0, spellcasting.slotsMax[index] + by))
  return {
    ...spellcasting,
    slotsMax: spellcasting.slotsMax.map((n, i) => (i === index ? max : n)),
    slotsUsed: spellcasting.slotsUsed.map((n, i) => (i === index ? Math.min(n, max) : n)),
  }
}

/** Slots back to the class table for the character's level, keeping what's used where it still fits. */
export function resetSlots(spellcasting: Character['spellcasting'], table: number[]): Character['spellcasting'] {
  return {
    ...spellcasting,
    slotsMax: [...table],
    slotsUsed: spellcasting.slotsUsed.map((n, i) => Math.min(n, table[i] ?? 0)),
  }
}
