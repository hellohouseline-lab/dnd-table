// Changing a character after it's made, the builder's way: how many spells they may know or
// prepare at their level, what each weapon and armour does in plain words, and keeping the hand
// of cards in step with the weapons they carry.

import { entryId, type AttackEntry, type Character, type CharacterBuild, type InventoryItem } from './character.ts'
import { findItem, weaponProficient } from './build/gear.ts'
import { itemName } from './build/gearStep.ts'
import { subclassIndex } from './build/applyLevelUp.ts'
import { levelPlan, preparedCount, type ChoiceOption, type Have } from './build/levelUp.ts'
import {
  findWeapon,
  type SrdClass,
  type SrdEquipment,
  type SrdFeature,
  type SrdItem,
  type SrdSpell,
} from './srd/index.ts'

/** How a class keeps its spells (2014 rules). */
export type SpellWay = 'known' | 'spellbook' | 'prepared' | 'none'

export type SpellLimits = {
  way: SpellWay
  /** Cantrips allowed (a high elf's extra cantrip on top). */
  cantrips: number
  /** Spells known (bard, sorcerer, warlock, ranger); null when the class prepares instead. */
  known: number | null
  /** Spells prepared each day (cleric, druid, paladin, wizard); null for the rest. */
  prepared: number | null
  /** The highest spell level the slots reach. */
  maxLevel: number
}

const KNOWN = ['bard', 'sorcerer', 'warlock', 'ranger']

export function spellWay(cls: SrdClass): SpellWay {
  if (!cls.spellcastingAbility) return 'none'
  if (cls.index === 'wizard') return 'spellbook'
  return KNOWN.includes(cls.index) ? 'known' : 'prepared'
}

export function spellLimits(character: Pick<Character, 'level' | 'scores' | 'features'>, cls: SrdClass): SpellLimits {
  const row = cls.levels[character.level]
  const way = spellWay(cls)
  const elf = character.features.some((f) => /high elf cantrip/i.test(f.name)) ? 1 : 0
  return {
    way,
    cantrips: (row?.cantripsKnown ?? 0) + elf,
    known: way === 'known' ? (row?.spellsKnown ?? 0) : null,
    prepared:
      way === 'prepared' || way === 'spellbook' ? preparedCount(cls.index, character.level, character.scores) : null,
    maxLevel: (row?.slots ?? []).reduce((top, n, i) => (n > 0 ? i + 1 : top), 0),
  }
}

/** What the character's spell list holds now, counted against the limits. */
export function spellCounts(character: Pick<Character, 'spellcasting'>) {
  const spells = character.spellcasting.spells
  return {
    cantrips: spells.filter((s) => s.level === 0).length,
    spells: spells.filter((s) => s.level > 0).length,
    prepared: spells.filter((s) => s.level > 0 && s.prepared).length,
  }
}

/** The spells a class can choose from at this level: its list, up to the highest slot level. */
export function spellChoices(cls: SrdClass, limits: SpellLimits, spells: SrdSpell[]): SrdSpell[] {
  return spells
    .filter((s) => s.classes.includes(cls.index) && s.level <= limits.maxLevel)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

const PROPERTY_WORDS: Record<string, string> = {
  finesse: 'finesse',
  light: 'light',
  heavy: 'heavy',
  thrown: 'thrown',
  'two-handed': 'two-handed',
  versatile: 'versatile',
  loading: 'loading',
  ammunition: 'needs ammunition',
  reach: 'reach 10 ft',
}

/** "1d8 slashing · versatile (1d10)", for a weapon's card. */
export function weaponWords(index: string): string {
  const w = findWeapon(index)
  if (!w) return ''
  const damage = w.damageDice ? `${w.damageDice} ${w.damageType.toLowerCase()}` : 'no damage'
  const props = w.properties
    .filter((p) => PROPERTY_WORDS[p])
    .map((p) => (p === 'versatile' && w.versatileDice ? `versatile (${w.versatileDice})` : PROPERTY_WORDS[p]))
  const range =
    w.range === 'Ranged' || w.properties.includes('thrown')
      ? `range ${w.normalRange ?? '?'}/${w.longRange ?? '?'} ft`
      : ''
  return [damage, ...props, range].filter(Boolean).join(' · ')
}

/** "11 + Dexterity", "14 + Dexterity (up to +2)", "16 · needs Strength 13 · noisy", "+2 AC". */
export function armourWords(item: SrdItem): string {
  const a = item.armour
  if (!a) return ''
  if (item.sub === 'Shield') return `+${a.base} AC, in one hand`
  const dex = a.dexBonus ? (a.maxDex === null ? ' + Dexterity' : ` + Dexterity (up to +${a.maxDex})`) : ''
  return [
    `AC ${a.base}${dex}`,
    a.strength ? `needs Strength ${a.strength}` : '',
    a.stealthDisadvantage ? 'noisy (Stealth at disadvantage)' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "15 gp", "5 sp", "2 cp" from copper. */
export function costWords(copper: number): string {
  if (copper >= 100 && copper % 100 === 0) return `${copper / 100} gp`
  if (copper >= 10 && copper % 10 === 0) return `${copper / 10} sp`
  return copper > 0 ? `${copper} cp` : 'free'
}

/**
 * The hand of cards for the weapons carried: a weapon newly carried becomes an attack (with the
 * class's proficiency), and one no longer carried leaves the hand. Attacks typed in by hand (with
 * no SRD weapon) stay as they are.
 */
export function syncAttacks(
  attacks: AttackEntry[],
  inventory: InventoryItem[],
  equipment: SrdEquipment,
  proficiencies: string,
): AttackEntry[] {
  const held = inventory.filter((i) => i.quantity > 0 && i.item)
  const carried = new Set(held.map((i) => i.item as string))
  const kept = attacks.filter((a) => !a.weapon || carried.has(a.weapon) || !findItem(equipment, a.weapon))
  const have = new Set(kept.map((a) => `${a.weapon}:${a.magicBonus}`))
  const added: AttackEntry[] = []
  for (const i of held) {
    const attack = attackFor(i, equipment, proficiencies)
    const key = attack ? `${attack.weapon}:${attack.magicBonus}` : ''
    if (attack && !have.has(key)) {
      have.add(key)
      added.push(attack)
    }
  }
  return [...kept, ...added]
}

/** A carried weapon as a card in the hand, with its +1 if it's magic; null for anything else. */
export function attackFor(item: InventoryItem, equipment: SrdEquipment, proficiencies: string): AttackEntry | null {
  const weapon = item.item ? findItem(equipment, item.item) : undefined
  if (weapon?.kind !== 'weapon') return null
  const bonus = item.bonus ?? 0
  return {
    id: `weapon-${weapon.index}${bonus ? `-${bonus}` : ''}`,
    name: bonus ? `${itemName(weapon.name)} +${bonus}` : itemName(weapon.name),
    weapon: weapon.index,
    proficient: weaponProficient(weapon, proficiencies.split(/,\s*/)),
    magicBonus: bonus,
    ability: 'strength',
    damageDice: '',
    damageType: '',
  }
}

/** A wizard copying a spell into their book: 50 gp and 2 hours a spell level (2014 rules). */
export function copyCost(level: number): string {
  return `${level * 50} gp and ${level * 2} hours`
}

/** Whether the character is trained in a piece of armour or a shield ("Light armor", "All armor", "Shields"). */
export function armourTrained(item: SrdItem, proficiencies: string): boolean {
  const words = proficiencies.toLowerCase()
  if (item.sub === 'Shield') return /\bshields?\b/.test(words)
  if (/\ball armou?r\b/.test(words)) return true
  return new RegExp(`\\b${(item.sub ?? '').toLowerCase()} armou?r\\b`).test(words)
}

/** Something to carry: one more of it if it's carried already, else a new line (a pack opens into its contents). */
export function addToInventory(
  inventory: InventoryItem[],
  thing: { index: string; name: string; weight: number },
  equipment: SrdEquipment,
): InventoryItem[] {
  const pack = findItem(equipment, thing.index)?.contents
  const parts = pack
    ? pack.flatMap((c) => {
        const found = findItem(equipment, c.item)
        return found
          ? [{ thing: { index: found.index, name: found.name, weight: found.weight }, quantity: c.quantity }]
          : []
      })
    : [{ thing, quantity: 1 }]
  let next = inventory
  for (const { thing: t, quantity } of parts) {
    const existing = next.find((i) => i.item === t.index)
    next = existing
      ? next.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i))
      : [
          ...next,
          {
            id: entryId(),
            item: t.index,
            name: itemName(t.name),
            quantity,
            weight: t.weight,
            worn: false,
            uses: t.index === 'healers-kit' ? 10 : null,
          },
        ]
  }
  return next
}

/** Put on or take off armour or a shield; putting on a suit of armour takes off any other suit. */
export function toggleWorn(inventory: InventoryItem[], id: string, equipment: SrdEquipment): InventoryItem[] {
  const target = inventory.find((i) => i.id === id)
  const srd = target?.item ? findItem(equipment, target.item) : undefined
  if (!target || !srd?.armour) return inventory
  const wearing = !target.worn
  const isShield = srd.sub === 'Shield'
  return inventory.map((i) => {
    if (i.id === id) return { ...i, worn: wearing }
    const other = i.item ? findItem(equipment, i.item) : undefined
    const sameSlot = other?.armour && (other.sub === 'Shield') === isShield
    return wearing && sameSlot ? { ...i, worn: false } : i
  })
}

/** A choice a class has made by this level (a fighting style, expertise, invocations), with what's picked now. */
export type ChoiceGroup = {
  name: string
  kind: 'feature' | 'skill'
  /** How many in all, adding up every level that asked. */
  choose: number
  options: ChoiceOption[]
  picked: string[]
}

const THIEVES_EXPERTISE = 'Thieves’ tools (expertise)'

/**
 * Every choice the class has asked for up to the character's level, grouped by name (a rogue's
 * expertise at levels 1 and 6 is one group of four), with the options they've picked: a feature
 * on the sheet named "Fighting Style: Defense", or expertise in a skill.
 */
export function choiceGroups(
  cls: SrdClass,
  build: Pick<
    CharacterBuild,
    'level' | 'subclass' | 'features' | 'skillExpertise' | 'otherProficiencies' | 'spellcasting'
  >,
  features: Record<string, SrdFeature>,
): ChoiceGroup[] {
  const names = new Set(build.features.map((f) => f.name.replace(/^[^:]+:\s*/, '').toLowerCase()))
  const have: Have = {
    features: Object.keys(features).filter((k) => names.has(features[k].name.replace(/^[^:]+:\s*/, '').toLowerCase())),
    spells: build.spellcasting.spells.flatMap((s) => (s.index ? [s.index] : [])),
  }
  const sub = subclassIndex(cls, build, null)
  const groups = new Map<string, ChoiceGroup>()
  for (let level = 1; level <= build.level; level++) {
    for (const choice of levelPlan(cls, level, sub, have, features).choices) {
      if (choice.kind !== 'feature' && choice.kind !== 'skill') continue
      const group = groups.get(choice.name) ?? {
        name: choice.name,
        kind: choice.kind,
        choose: 0,
        options: [],
        picked: [],
      }
      group.choose += choice.choose
      for (const option of choice.options) {
        // Having it already is fine here: that's what's picked.
        const fixed = option.why === 'you have it already' ? { ...option, allowed: true, why: null } : option
        const at = group.options.findIndex((o) => o.index === option.index)
        if (at < 0) group.options.push(fixed)
        else if (fixed.allowed) group.options[at] = fixed
      }
      groups.set(choice.name, group)
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    picked: group.options
      .filter((o) =>
        group.kind === 'skill'
          ? o.index === 'thieves-tools'
            ? build.otherProficiencies.includes(THIEVES_EXPERTISE)
            : build.skillExpertise.includes(o.index)
          : build.features.some((f) => f.name.toLowerCase() === `${group.name}: ${o.name}`.toLowerCase()),
      )
      .map((o) => o.index),
  }))
}

/** The sheet with a choice group's picks changed. */
export function applyChoice(build: CharacterBuild, group: ChoiceGroup, picked: string[]): CharacterBuild {
  if (group.kind === 'skill') {
    const all = new Set(group.options.map((o) => o.index))
    const thieves = picked.includes('thieves-tools')
    const others = build.otherProficiencies.split(/,\s*/).filter((p) => p && p !== THIEVES_EXPERTISE)
    return {
      ...build,
      skillExpertise: [
        ...build.skillExpertise.filter((s) => !all.has(s)),
        ...picked.filter((s) => s !== 'thieves-tools'),
      ],
      otherProficiencies: [...others, ...(thieves ? [THIEVES_EXPERTISE] : [])].join(', '),
    }
  }
  const prefix = `${group.name}: `.toLowerCase()
  const kept = build.features.filter(
    (f) =>
      !f.name.toLowerCase().startsWith(prefix) ||
      group.options.some(
        (o) => picked.includes(o.index) && f.name.toLowerCase() === `${prefix}${o.name.toLowerCase()}`,
      ),
  )
  const added = group.options
    .filter(
      (o) => picked.includes(o.index) && !kept.some((f) => f.name.toLowerCase() === `${prefix}${o.name.toLowerCase()}`),
    )
    .map((o) => ({
      id: entryId(),
      name: `${group.name}: ${o.name}`,
      description: o.desc,
      usesMax: null,
      usesLeft: 0,
      recharge: null,
    }))
  return { ...build, features: [...kept, ...added] }
}

/** "Cantrip", "Level 2". */
export const levelWord = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`)
