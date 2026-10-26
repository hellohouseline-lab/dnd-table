// Shops (I1c, docs/I1_PLAN.md): a general store, a blacksmith, an alchemist, a fletcher or a
// travelling merchant, each stocked from the free rules at their real prices, with a mark-up the DM
// picks (cheap, fair or pricey). Players buy with change made, and sell gear back for half the book
// price, as the 2014 rules suggest (decision 40). Magic items sell only where the shop stocks them,
// at half the DM's price (decision 41). The server works out the same prices when the coins move.

import { BITS } from './bits.ts'
import { itemName } from './build/gearStep.ts'
import { entryId, type InventoryItem } from './character.ts'
import type { Gift } from './magic.ts'
import { POTIONS } from './items.ts'
import type { SrdEquipment, SrdItem, SrdMagicItem } from './srd/index.ts'

export type ShopKind = 'general' | 'blacksmith' | 'alchemist' | 'fletcher' | 'merchant'

export const SHOP_KINDS: { key: ShopKind; name: string; line: string }[] = [
  { key: 'general', name: 'General store', line: 'Rope, torches, rations, packs and tools' },
  { key: 'blacksmith', name: 'Blacksmith', line: 'Weapons, armour and shields' },
  { key: 'alchemist', name: 'Alchemist', line: 'Potions, oil, acid and antitoxin' },
  { key: 'fletcher', name: 'Fletcher', line: 'Bows, crossbows, arrows and bolts' },
  { key: 'merchant', name: 'Travelling merchant', line: 'A few things for the road' },
]

export const MARKUPS: { key: number; name: string; line: string }[] = [
  { key: 80, name: 'Cheap', line: '80% of the book price' },
  { key: 100, name: 'Fair', line: 'The book price' },
  { key: 125, name: 'Pricey', line: '125% of the book price' },
]

/** One line on a shop's shelves. Prices are in copper. */
export type StockLine = {
  id: string
  /** The free rules' item (or magic item) index; null for one the DM typed in. */
  item: string | null
  magic?: string
  name: string
  /** The book price for one bundle (0 when the DM must set it, as for most magic items). */
  cost: number
  /** The DM's own price for one bundle, instead of the book price with the mark-up. */
  price: number | null
  /** How many bundles are left; null for plenty. */
  quantity: number | null
  /** Arrows come 20 to a bundle, blowgun needles 50. */
  bundle: number
  weight: number
  bonus?: number
  attune?: boolean
  note?: string
}

export type Shop = {
  id: string
  name: string
  keeper: string
  kind: ShopKind
  /** Percent of the book price. */
  markup: number
  /** Whether it buys from players. */
  buys: boolean
  open: boolean
  stock: StockLine[]
}

/** Things sold in bundles, as the price list has them. */
export const BUNDLES: Record<string, number> = {
  arrow: 20,
  'crossbow-bolt': 20,
  'sling-bullet': 20,
  'blowgun-needle': 50,
}

const GENERAL = [
  'backpack',
  'bedroll',
  'blanket',
  'candle',
  'chalk-1-piece',
  'crowbar',
  'flask-or-tankard',
  'grappling-hook',
  'hammer',
  'lantern-hooded',
  'oil-flask',
  'piton',
  'pouch',
  'rations-1-day',
  'rope-hempen-50-feet',
  'sack',
  'shovel',
  'soap',
  'tinderbox',
  'torch',
  'waterskin',
  'whetstone',
  'mess-kit',
  'healers-kit',
  'clothes-common',
  'clothes-travelers',
  'tent-two-person',
  'fishing-tackle',
  'ink-1-ounce-bottle',
  'ink-pen',
  'paper-one-sheet',
  'climbers-kit',
  'dice-set',
  'playing-card-set',
]
const ALCHEMIST = [
  'acid-vial',
  'alchemists-fire-flask',
  'antitoxin-vial',
  'oil-flask',
  'perfume-vial',
  'vial',
  'herbalism-kit',
  'healers-kit',
]
const FLETCHER = [
  'shortbow',
  'longbow',
  'crossbow-light',
  'crossbow-heavy',
  'crossbow-hand',
  'sling',
  'blowgun',
  'arrow',
  'crossbow-bolt',
  'sling-bullet',
  'blowgun-needle',
  'quiver',
  'case-crossbow-bolt',
]
const MERCHANT = [
  'rations-1-day',
  'torch',
  'rope-hempen-50-feet',
  'waterskin',
  'bedroll',
  'tinderbox',
  'oil-flask',
  'dagger',
  'healers-kit',
]
const PLENTY = new Set([
  'candle',
  'chalk-1-piece',
  'rations-1-day',
  'torch',
  'piton',
  'arrow',
  'crossbow-bolt',
  'sling-bullet',
  'paper-one-sheet',
])

/** A line for something from the free rules. */
export function gearLine(item: SrdItem, quantity: number | null): StockLine {
  const bundle = BUNDLES[item.index] ?? 1
  return {
    id: entryId(),
    item: item.index,
    name: bundle > 1 ? `${itemName(item.name)} (${bundle})` : itemName(item.name),
    cost: item.cost,
    price: null,
    quantity,
    bundle,
    weight: item.weight,
  }
}

/** A line for a magic item: the DM sets its price, but a Potion of Healing starts at 50 gp. */
export function magicLine(magic: SrdMagicItem, base: SrdItem | null, quantity: number | null): StockLine {
  const potion = POTIONS.find((p) => p.index === magic.index)
  return {
    id: entryId(),
    item: base?.index ?? magic.index,
    magic: magic.index,
    name: base && magic.bonus ? `${itemName(base.name)} +${magic.bonus}` : magic.name,
    cost: magic.index === 'potion-of-healing-common' ? 5000 : 0,
    price: null,
    quantity,
    bundle: 1,
    weight: base?.weight ?? potion?.weight ?? 0,
    ...(magic.bonus ? { bonus: magic.bonus } : {}),
    ...(magic.attune ? { attune: true } : {}),
  }
}

/** A line for anything the Give browser can show. */
export function lineFor(gift: Gift, quantity: number | null): StockLine | null {
  if (gift.kind === 'gear') return gearLine(gift.item, quantity)
  if (gift.kind === 'magic') return magicLine(gift.magic, gift.base, quantity)
  if (gift.kind === 'bit') {
    return {
      id: entryId(),
      item: gift.bit.index,
      name: gift.bit.name,
      cost: gift.bit.worth,
      price: null,
      quantity,
      bundle: 1,
      weight: gift.bit.weight,
      note: gift.bit.note,
    }
  }
  if (gift.kind === 'yours') {
    return {
      id: entryId(),
      item: null,
      name: gift.item.name,
      cost: 0,
      price: null,
      quantity,
      bundle: 1,
      weight: 0,
      ...(gift.item.description ? { note: gift.item.description } : {}),
    }
  }
  return null
}

/** What a kind of shop has on its shelves to start with. */
export function startingStock(kind: ShopKind, equipment: SrdEquipment, magic: SrdMagicItem[]): StockLine[] {
  const find = (index: string) => equipment.items.find((i) => i.index === index)
  const lines = (indexes: string[], each: number) =>
    indexes.flatMap((index) => {
      const item = find(index)
      return item ? [gearLine(item, PLENTY.has(index) ? null : each)] : []
    })
  const potions = (count: number) =>
    magic.filter((m) => m.index === 'potion-of-healing-common').map((m) => magicLine(m, null, count))
  if (kind === 'general') return lines(GENERAL, 5)
  if (kind === 'alchemist') return [...potions(3), ...lines(ALCHEMIST, 4)]
  if (kind === 'fletcher') return lines(FLETCHER, 2)
  if (kind === 'merchant') return [...lines(MERCHANT, 2), ...potions(2)]
  return equipment.items
    .filter((i) => i.kind === 'weapon' && i.sub !== 'Ammunition' && !FLETCHER.includes(i.index))
    .map((i) => gearLine(i, 2))
    .concat(equipment.items.filter((i) => i.kind === 'armor').map((i) => gearLine(i, 1)))
}

/** What one bundle costs here: the DM's own price, or the book price with the mark-up. */
export function linePrice(line: StockLine, markup: number): number {
  return line.price ?? Math.round((line.cost * markup) / 100)
}

/** Lines the DM still has to price (magic items from the free rules have no price). */
export function needsPrice(line: StockLine): boolean {
  return line.price === null && line.cost === 0 && line.magic !== undefined
}

/** What it becomes in a pack when bought. */
export function boughtItem(line: StockLine, bundles: number): InventoryItem {
  return {
    id: entryId(),
    item: line.item,
    name: line.bundle > 1 ? line.name.replace(/ \(\d+\)$/, '') : line.name,
    quantity: bundles * line.bundle,
    weight: line.weight,
    worn: false,
    uses: line.item === 'healers-kit' ? 10 : null,
    ...(line.magic ? { magic: line.magic } : {}),
    ...(line.bonus ? { bonus: line.bonus } : {}),
    ...(line.attune ? { attune: true, attuned: false } : {}),
    ...(line.note ? { note: line.note } : {}),
  }
}

/**
 * What a shop pays for one of something (in copper), or null if it won't buy it: half the book
 * price for gear and bits and bobs, half the shop's own price for a magic item it stocks.
 */
export function sellPrice(item: InventoryItem, shop: Shop, equipment: SrdEquipment): number | null {
  if (!shop.buys || item.worn) return null
  if (item.magic) {
    const line = shop.stock.find((l) => l.magic === item.magic && (l.bonus ?? 0) === (item.bonus ?? 0))
    return line ? Math.floor(linePrice(line, shop.markup) / line.bundle / 2) : null
  }
  if (!item.item) return null
  const bit = BITS.find((b) => b.index === item.item)
  const book = bit?.worth ?? equipment.items.find((i) => i.index === item.item)?.cost
  if (book === undefined || book === 0) return null
  return Math.floor(book / (BUNDLES[item.item] ?? 1) / 2)
}
