// Everything the DM can give, as one list of cards with tags to filter by: magic items by rarity
// and type, everyday gear, bits and bobs, and the DM's own items. The free rules call 167 items
// "wondrous", so those are sorted into amulets, cloaks, boots and the rest by name.

import { itemName } from './build/gearStep.ts'
import type { Bit } from './bits.ts'
import { armourWords, costWords, weaponWords } from './manage.ts'
import { magicWords, type Gift } from './magic.ts'
import type { SrdEquipment, SrdItem, SrdMagicItem } from './srd/index.ts'

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary' | 'Artifact'

export const RARITIES: { key: Rarity; name: string }[] = [
  { key: 'Common', name: 'Common' },
  { key: 'Uncommon', name: 'Uncommon' },
  { key: 'Rare', name: 'Rare' },
  { key: 'Very Rare', name: 'Very rare' },
  { key: 'Legendary', name: 'Legendary' },
]

export type TypeTag =
  | 'weapons'
  | 'armour'
  | 'potions'
  | 'rings'
  | 'amulets'
  | 'cloaks'
  | 'boots-gloves'
  | 'belts'
  | 'headwear'
  | 'bags'
  | 'wands'
  | 'staffs-rods'
  | 'scrolls'
  | 'tools'
  | 'gear'
  | 'other'

export const TYPE_TAGS: { key: TypeTag; name: string }[] = [
  { key: 'weapons', name: 'Weapons' },
  { key: 'armour', name: 'Armour' },
  { key: 'potions', name: 'Potions' },
  { key: 'rings', name: 'Rings' },
  { key: 'amulets', name: 'Amulets' },
  { key: 'cloaks', name: 'Cloaks' },
  { key: 'boots-gloves', name: 'Boots and gloves' },
  { key: 'belts', name: 'Belts' },
  { key: 'headwear', name: 'Headwear' },
  { key: 'bags', name: 'Bags' },
  { key: 'wands', name: 'Wands' },
  { key: 'staffs-rods', name: 'Staffs and rods' },
  { key: 'scrolls', name: 'Scrolls' },
  { key: 'tools', name: 'Kits and tools' },
  { key: 'gear', name: 'Gear' },
  { key: 'other', name: 'Other' },
]

export type Source = 'magic' | 'gear' | 'bits' | 'yours'

export const SOURCES: { key: Source; name: string }[] = [
  { key: 'magic', name: 'Magic items' },
  { key: 'gear', name: 'Everyday gear' },
  { key: 'bits', name: 'Bits and bobs' },
  { key: 'yours', name: 'Your items' },
]

/** An item the DM made: kept privately in their campaign until given. */
export type DmItem = {
  id: string
  name: string
  description: string
  type: TypeTag
  rarity: Rarity | null
  /** Matters to the story: giving it fills in who has it in the notebook. */
  key: boolean
}

export type Entry = {
  key: string
  name: string
  /** One line: what it does, or how rare. */
  line: string
  /** The full text, to read on the card. */
  desc: string
  source: Source
  rarity: Rarity | null
  type: TypeTag
  gift: Gift
}

const WONDROUS: [TypeTag, RegExp][] = [
  ['amulets', /amulet|necklace|periapt|medallion|brooch|scarab/i],
  ['cloaks', /cloak|robe|cape|mantle/i],
  ['boots-gloves', /boots|slippers|gloves|gauntlets|bracers/i],
  ['belts', /belt|girdle/i],
  ['headwear', /helm|circlet|headband|\bhat\b/i],
  ['bags', /\bbag\b|portable hole|haversack/i],
]

const MAGIC_KIND: Record<string, TypeTag> = {
  weapon: 'weapons',
  ammunition: 'weapons',
  armor: 'armour',
  potion: 'potions',
  ring: 'rings',
  wand: 'wands',
  staff: 'staffs-rods',
  rod: 'staffs-rods',
  scroll: 'scrolls',
}

export function magicType(item: SrdMagicItem): TypeTag {
  if (MAGIC_KIND[item.kind]) return MAGIC_KIND[item.kind]
  return WONDROUS.find(([, pattern]) => pattern.test(item.name))?.[0] ?? 'other'
}

export function gearType(item: SrdItem): TypeTag {
  if (item.kind === 'weapon') return 'weapons'
  if (item.kind === 'armor') return 'armour'
  if (item.kind === 'tools') return 'tools'
  return 'gear'
}

function gearLine(item: SrdItem): string {
  if (item.kind === 'weapon') return weaponWords(item.index)
  if (item.armour) return armourWords(item)
  return [item.sub, item.cost ? costWords(item.cost) : null].filter(Boolean).join(' · ')
}

/** Every card the Give window can show. */
export function buildCatalogue(data: {
  magic: SrdMagicItem[]
  equipment: SrdEquipment
  bits: Bit[]
  yours: DmItem[]
}): Entry[] {
  return [
    ...data.yours.map((item): Entry => ({
      key: `yours:${item.id}`,
      name: item.name,
      line: item.key ? 'Key item' : (item.description.split(/(?<=\.)\s/)[0] ?? ''),
      desc: item.description,
      source: 'yours',
      rarity: item.rarity,
      type: item.type,
      gift: { kind: 'yours', item },
    })),
    ...data.magic
      .filter((m) => m.rarity !== 'Artifact')
      .map((m): Entry => ({
        key: `magic:${m.index}`,
        name: m.name,
        line: magicWords(m),
        desc: m.desc,
        source: 'magic',
        rarity: m.rarity as Rarity,
        type: magicType(m),
        gift: { kind: 'magic', magic: m, base: null },
      })),
    ...data.equipment.items
      .filter((i) => i.kind !== 'mounts-and-vehicles')
      .map((i): Entry => ({
        key: `gear:${i.index}`,
        name: itemName(i.name),
        line: gearLine(i),
        desc: '',
        source: 'gear',
        rarity: null,
        type: gearType(i),
        gift: { kind: 'gear', item: i },
      })),
    ...data.bits.map((b): Entry => ({
      key: `bits:${b.index}`,
      name: b.name,
      line: b.note,
      desc: '',
      source: 'bits',
      rarity: null,
      type: 'other',
      gift: { kind: 'bit', bit: b },
    })),
  ]
}

export type CatalogueFilter = { sources: Source[]; rarities: Rarity[]; types: TypeTag[]; search: string }

/** Tags in the same group widen the list (Rings or Amulets); groups narrow it (Rare and Rings). */
export function filterCatalogue(entries: Entry[], filter: CatalogueFilter): Entry[] {
  const words = filter.search.trim().toLowerCase()
  return entries.filter(
    (e) =>
      (filter.sources.length === 0 || filter.sources.includes(e.source)) &&
      (filter.rarities.length === 0 || (e.rarity !== null && filter.rarities.includes(e.rarity))) &&
      (filter.types.length === 0 || filter.types.includes(e.type)) &&
      (!words || e.name.toLowerCase().includes(words) || e.line.toLowerCase().includes(words)),
  )
}
