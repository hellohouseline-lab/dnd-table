// A character sheet as plain text, to copy or download: everything on the sheet, plus a picture
// description built from their race, class, looks and gear, ready to paste into an image
// generator to make a portrait of each character.

import { ABILITIES, ABILITY_NAME, ABILITY_SHORT } from './abilities.ts'
import type { Character } from './character.ts'
import { formatBonus } from './maths/core.ts'
import { deriveSheet } from './sheet.ts'

const line = (label: string, value: string) => (value.trim() ? `${label}: ${value.trim()}` : '')
const join = (parts: string[]) => parts.filter(Boolean).join('\n')

/** "an 87-year-old", "an elf", "a dwarf": by the sound, so "an" before a vowel or an 8, 11 or 18. */
export function anOrA(next: string): string {
  return /^(?:[aeiou]|8|11\b|11-|18\b|18-)/i.test(next.trim()) ? 'an' : 'a'
}

/** "Hill Dwarf", not "Hill Dwarf Dwarf". */
function raceName(c: Pick<Character, 'race' | 'subrace'>): string {
  if (!c.subrace) return c.race
  return c.subrace.toLowerCase().includes(c.race.toLowerCase()) ? c.subrace : `${c.subrace} ${c.race}`
}

/**
 * A description of how the character looks, for an image generator: who they are, their looks,
 * what they wear and carry, and their manner. Nothing that isn't on the sheet.
 */
export function pictureDescription(c: Character): string {
  const s = c.story
  const who = [s.age && `${s.age.replace(/\s*years?( old)?/i, '')}-year-old`, raceName(c), c.className]
    .filter(Boolean)
    .join(' ')
  const looks = [
    s.height && `${s.height.replace(/\s*\(.*\)/, '')} tall`,
    s.weight && `weighing ${s.weight.replace(/\s*\(.*\)/, '')}`,
    s.eyes && `${s.eyes.toLowerCase()} eyes`,
    s.skin && `${s.skin.toLowerCase()} skin`,
    s.hair && `${s.hair.toLowerCase()} hair`,
  ].filter(Boolean)
  const worn = c.inventory.filter((i) => i.worn).map((i) => i.name.toLowerCase())
  const weapons = c.attacks.map((a) => (a.name || 'a weapon').toLowerCase())
  const carrying = [
    worn.length > 0 && `wearing ${worn.join(' and ')}`,
    weapons.length > 0 && `carrying ${weapons.slice(0, 3).join(', ')}`,
    c.spellcasting.spells.length > 0 && 'with a hint of magic about them',
  ].filter(Boolean)
  const manner = [s.alignment && `${s.alignment.toLowerCase()} in nature`, s.personality].filter(Boolean)
  return [
    `A fantasy character portrait of ${c.name || 'an adventurer'}, ${anOrA(who)} ${who}${c.subclass ? ` (${c.subclass})` : ''}.`,
    looks.length > 0 && `${looks.join(', ').replace(/^./, (x) => x.toUpperCase())}.`,
    carrying.length > 0 && `${carrying.join(', ').replace(/^./, (x) => x.toUpperCase())}.`,
    manner.length > 0 &&
      `${manner.join('. ').replace(/^./, (x) => x.toUpperCase())}${/[.!?]$/.test(manner[manner.length - 1]) ? '' : '.'}`,
    c.background && `Once ${/^[aeiou]/i.test(c.background) ? 'an' : 'a'} ${c.background.toLowerCase()}.`,
    'Dungeons and Dragons style, painted, detailed, dramatic lighting.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** The whole sheet as text. */
export function characterText(c: Character): string {
  const sheet = deriveSheet(c)
  const s = c.story
  const coins = (['pp', 'gp', 'ep', 'sp', 'cp'] as const)
    .filter((k) => c.wallet[k] > 0)
    .map((k) => `${c.wallet[k]} ${k}`)
    .join(', ')
  return join([
    c.name.toUpperCase(),
    `Level ${c.level} ${raceName(c)} ${c.className}${c.subclass ? ` (${c.subclass})` : ''}${c.background ? `, ${c.background}` : ''}`,
    line('Alignment', s.alignment),
    '',
    'PICTURE DESCRIPTION',
    pictureDescription(c),
    '',
    'ABILITY SCORES',
    ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${c.scores[a]} (${formatBonus(sheet.modifiers[a])})`).join('  '),
    '',
    `Hit points ${c.maxHp} · Armour class ${c.armourClass} · Speed ${c.speed} ft · Initiative ${formatBonus(sheet.initiative)} · Training bonus ${formatBonus(sheet.proficiencyBonus)} · Passive Perception ${sheet.passivePerception}`,
    `Hit dice: ${c.level}d${c.hitDie}`,
    '',
    line(
      'Saving throws',
      sheet.saves.map((v) => `${ABILITY_NAME[v.ability]} ${formatBonus(v.bonus)}${v.proficient ? '*' : ''}`).join(', '),
    ),
    line(
      'Skills',
      sheet.skills
        .filter((k) => k.rank !== 'none')
        .map((k) => `${k.name} ${formatBonus(k.bonus)}${k.rank === 'expertise' ? ' (expertise)' : ''}`)
        .join(', '),
    ),
    line('Languages', c.languages),
    line('Also trained with', c.otherProficiencies),
    '',
    sheet.attacks.length > 0 ? 'ATTACKS' : '',
    ...sheet.attacks.map(
      (a) =>
        `- ${a.entry.name || 'Attack'}: ${formatBonus(a.result.toHit)} to hit, ${a.result.damage} ${a.result.damageType.toLowerCase()}`,
    ),
    sheet.attacks.length > 0 ? '' : '',
    c.spellcasting.spells.length > 0 ? 'SPELLS' : '',
    sheet.spell ? `Spell save DC ${sheet.spell.saveDc} · Spell attack ${formatBonus(sheet.spell.attackBonus)}` : '',
    c.spellcasting.slotsMax.some((n) => n > 0)
      ? `Slots: ${c.spellcasting.slotsMax
          .map((n, i) => (n > 0 ? `level ${i + 1}: ${n}` : ''))
          .filter(Boolean)
          .join(', ')}`
      : '',
    ...[...c.spellcasting.spells]
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .map(
        (sp) =>
          `- ${sp.name} (${sp.level === 0 ? 'cantrip' : `level ${sp.level}`}${sp.level > 0 && !sp.prepared ? ', not prepared' : ''})`,
      ),
    c.spellcasting.spells.length > 0 ? '' : '',
    c.features.length > 0 ? 'FEATURES AND TRAITS' : '',
    ...c.features.map(
      (f) =>
        `- ${f.name}${f.usesMax ? ` (${f.usesMax} use${f.usesMax === 1 ? '' : 's'}, back after a ${f.recharge === 'short' ? 'short or long' : 'long'} rest)` : ''}`,
    ),
    '',
    c.inventory.length > 0 ? 'EQUIPMENT' : '',
    ...c.inventory.map((i) => `- ${i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name}${i.worn ? ' (worn)' : ''}`),
    line('Coins', coins),
    '',
    'WHO THEY ARE',
    line('Age', s.age),
    line('Height', s.height),
    line('Weight', s.weight),
    line('Eyes', s.eyes),
    line('Skin', s.skin),
    line('Hair', s.hair),
    line('Personality', s.personality),
    line('Ideals', s.ideals),
    line('Bonds', s.bonds),
    line('Flaws', s.flaws),
    line('Goals', s.goals),
    line('Backstory', s.backstory),
  ])
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A safe file name: "thorin-ironfist.txt". */
export function sheetFileName(c: Pick<Character, 'name'>): string {
  return `${
    (c.name || 'character')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'character'
  }.txt`
}
