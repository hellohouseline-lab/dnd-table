// Giving things: an item from the free rules, a magic item (a +1 weapon or armour is paired with
// the weapon or armour itself, "Longsword +1"), or something typed in. And attunement: a magic
// item that needs it works only while attuned, and a character can be attuned to three at most.

import { entryId, type InventoryItem } from './character.ts'
import { itemName } from './build/gearStep.ts'
import { POTIONS } from './items.ts'
import type { SrdItem, SrdMagicItem } from './srd/index.ts'

export const ATTUNE_LIMIT = 3

export type Gift =
  | { kind: 'gear'; item: SrdItem }
  | { kind: 'magic'; magic: SrdMagicItem; base: SrdItem | null }
  | { kind: 'typed'; name: string }

/** A magic +1 weapon or armour needs a weapon or a suit of armour (or a shield) to go with. */
export function needsBase(magic: SrdMagicItem): 'weapon' | 'armor' | null {
  if (magic.bonus === undefined) return null
  if (magic.kind === 'weapon' || magic.kind === 'ammunition') return 'weapon'
  if (magic.kind === 'armor') return 'armor'
  return null
}

/** What a gift is called on the sheet: "Longsword +1", "Cloak of Protection". */
export function giftName(gift: Gift): string {
  if (gift.kind === 'typed') return gift.name.trim().slice(0, 60)
  if (gift.kind === 'gear') return itemName(gift.item.name)
  if (gift.base && gift.magic.bonus) return `${itemName(gift.base.name)} +${gift.magic.bonus}`
  return gift.magic.name
}

/** A gift as a line in a pack (the server gives it its own id). */
export function giftItem(gift: Gift, quantity: number): InventoryItem {
  const base = { id: entryId(), name: giftName(gift), quantity, worn: false }
  if (gift.kind === 'typed') return { ...base, item: null, weight: 0, uses: null }
  if (gift.kind === 'gear') {
    return {
      ...base,
      item: gift.item.index,
      weight: gift.item.weight,
      uses: gift.item.index === 'healers-kit' ? 10 : null,
    }
  }
  const { magic } = gift
  const potion = POTIONS.find((p) => p.index === magic.index)
  return {
    ...base,
    item: gift.base?.index ?? magic.index,
    weight: gift.base?.weight ?? potion?.weight ?? 0,
    uses: null,
    magic: magic.index,
    ...(magic.bonus ? { bonus: magic.bonus } : {}),
    ...(magic.attune ? { attune: true, attuned: false } : {}),
  }
}

export function attunedCount(inventory: InventoryItem[]): number {
  return inventory.filter((i) => i.attune && i.attuned).length
}

/** Attune to an item, or stop; null when they're attuned to three already. */
export function toggleAttuned(inventory: InventoryItem[], id: string): InventoryItem[] | null {
  const target = inventory.find((i) => i.id === id)
  if (!target?.attune) return inventory
  if (!target.attuned && attunedCount(inventory) >= ATTUNE_LIMIT) return null
  return inventory.map((i) => (i.id === id ? { ...i, attuned: !i.attuned } : i))
}

const RARITY_WORDS: Record<string, string> = {
  Common: 'common',
  Uncommon: 'uncommon',
  Rare: 'rare',
  'Very Rare': 'very rare',
  Legendary: 'legendary',
  Artifact: 'an artefact',
}

/** "Uncommon · needs attuning". */
export function magicWords(magic: SrdMagicItem): string {
  const rarity = RARITY_WORDS[magic.rarity] ?? magic.rarity.toLowerCase()
  return [rarity.replace(/^./, (c) => c.toUpperCase()), magic.attune ? 'needs attuning' : '']
    .filter(Boolean)
    .join(' · ')
}

/** Items added to a pack, as the server does it: one more of the same thing, or a new line (always, for attuning). */
export function mergeItems(inventory: InventoryItem[], items: InventoryItem[]): InventoryItem[] {
  let next = inventory
  for (const item of items) {
    const same = item.attune
      ? undefined
      : next.find(
          (i) =>
            i.item === item.item &&
            i.name === item.name &&
            (i.magic ?? null) === (item.magic ?? null) &&
            (i.bonus ?? 0) === (item.bonus ?? 0),
        )
    next = same
      ? next.map((i) => (i.id === same.id ? { ...i, quantity: i.quantity + item.quantity } : i))
      : [...next, { ...item, id: entryId(), worn: false, ...(item.attune ? { attuned: false } : {}) }]
  }
  return next
}
