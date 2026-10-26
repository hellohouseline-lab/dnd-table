// What things are worth, for the DM's eyes: the book price for gear and our bits and bobs, and for
// magic items (which the free rules don't price) a rough guide by rarity. A +1 weapon is the guide
// for its rarity plus the weapon itself. Shown so the DM can tell a bargain from a rip-off.

import { BITS } from './bits.ts'
import type { Rarity } from './catalogue.ts'
import type { Gift } from './magic.ts'
import { coinsFor, coinWords } from './money.ts'
import { BUNDLES } from './shops.ts'
import type { SrdEquipment, SrdMagicItem } from './srd/index.ts'

/** A rough guide to magic item prices by rarity, in gold pieces (low, high). */
export const RARITY_GUIDE: Record<Rarity, [number, number | null]> = {
  Common: [50, 100],
  Uncommon: [100, 500],
  Rare: [500, 5000],
  'Very Rare': [5000, 50000],
  Legendary: [50000, null],
  Artifact: [0, null],
}

export type Value =
  { kind: 'book'; copper: number } | { kind: 'guide'; low: number; high: number | null; rarity: Rarity }

type Valued = { item: string | null; magic?: string | null; bonus?: number }

/** What one of something is worth, or null if nobody can say (something the DM typed in). */
export function marketValue(thing: Valued, equipment: SrdEquipment, magicItems: SrdMagicItem[] | null): Value | null {
  const base = thing.item ? equipment.items.find((i) => i.index === thing.item) : undefined
  if (thing.magic) {
    if (thing.magic === 'potion-of-healing-common') return { kind: 'book', copper: 5000 }
    const magic = magicItems?.find((m) => m.index === thing.magic)
    const rarity = (magic?.rarity ?? null) as Rarity | null
    if (!rarity || rarity === 'Artifact') return null
    const [low, high] = RARITY_GUIDE[rarity]
    const extra = base ? Math.round(base.cost / 100) : 0
    return { kind: 'guide', low: low + extra, high: high === null ? null : high + extra, rarity }
  }
  if (!thing.item) return null
  const bit = BITS.find((b) => b.index === thing.item)
  if (bit) return bit.worth > 0 ? { kind: 'book', copper: bit.worth } : null
  if (!base) return null
  return { kind: 'book', copper: Math.round(base.cost / (BUNDLES[base.index] ?? 1)) }
}

const gp = (n: number) => `${n.toLocaleString('en-GB')} gp`

/** "15 gp", "worthless", "about 100 to 500 gp", "50,000 gp or more". */
export function valueWords(value: Value | null, quantity = 1): string {
  if (!value) return ''
  if (value.kind === 'book') return value.copper === 0 ? 'worthless' : coinWords(coinsFor(value.copper * quantity))
  if (value.high === null) return `${gp(value.low * quantity)} or more`
  return `about ${gp(value.low * quantity)} to ${gp(value.high * quantity)}`
}

/** How a price compares with what it's worth: cheap, fair or pricey (null when there's no guide). */
export function priceVerdict(price: number, value: Value | null, quantity = 1): 'cheap' | 'fair' | 'pricey' | null {
  if (!value) return null
  if (value.kind === 'book') {
    const worth = value.copper * quantity
    if (worth === 0) return null
    if (price < worth * 0.9) return 'cheap'
    if (price > worth * 1.1) return 'pricey'
    return 'fair'
  }
  const low = value.low * 100 * quantity
  const high = value.high === null ? null : value.high * 100 * quantity
  if (price < low) return 'cheap'
  if (high !== null && price > high) return 'pricey'
  return 'fair'
}

/** The value of a card in the Give browser or a box. */
export function entryValue(gift: Gift, equipment: SrdEquipment, magicItems: SrdMagicItem[] | null): Value | null {
  if (gift.kind === 'gear') return marketValue({ item: gift.item.index }, equipment, magicItems)
  if (gift.kind === 'bit') return marketValue({ item: gift.bit.index }, equipment, magicItems)
  if (gift.kind === 'magic') {
    return marketValue(
      { item: gift.base?.index ?? null, magic: gift.magic.index, bonus: gift.magic.bonus },
      equipment,
      magicItems,
    )
  }
  return null
}
