// Things you can use from your pack (2014 rules, SRD): potions of healing, a healer's kit, flasks to
// throw, antitoxin, caltrops and ball bearings. Using one takes your action in a fight, as the
// 2014 rules say (Matt's decision 36), and so does giving a potion to someone within reach.

import { armourClass } from './build/body.ts'
import { findItem } from './build/gear.ts'
import type { Character, InventoryItem } from './character.ts'
import type { DiceGroup } from './dice.ts'
import type { SrdEquipment } from './srd/index.ts'

export type UsableKind = 'heal' | 'stabilise' | 'throw' | 'effect' | 'other'

export type Usable = {
  kind: UsableKind
  /** What it does, in plain words, for its card. */
  what: string
  /** Healing or damage dice, and the flat amount added. */
  dice?: DiceGroup[]
  bonus?: number
  /** Thrown: its damage type, range in feet, and the creatures it hurts (holy water: fiends and undead). */
  damageType?: string
  rangeFt?: number
  onlyAgainst?: string[]
  /** An effect it puts on you (antitoxin), for this many rounds. */
  effect?: { key: string; name: string; roundsLeft: number }
  /** Who it's for: yourself, or someone within reach (a potion, a kit), or a target in range. */
  target: 'self-or-ally' | 'dying-ally' | 'enemy' | 'self' | 'none'
}

/** The SRD items the table knows how to use, by index. */
export const USABLE: Record<string, Usable> = {
  'potion-of-healing-common': {
    kind: 'heal',
    what: 'Drink it (or give it to someone next to you) to heal 2d4 + 2. Takes your action.',
    dice: [{ sides: 4, count: 2 }],
    bonus: 2,
    target: 'self-or-ally',
  },
  'potion-of-healing-greater': {
    kind: 'heal',
    what: 'Heals 4d4 + 4. Takes your action to drink or give.',
    dice: [{ sides: 4, count: 4 }],
    bonus: 4,
    target: 'self-or-ally',
  },
  'potion-of-healing-superior': {
    kind: 'heal',
    what: 'Heals 8d4 + 8. Takes your action to drink or give.',
    dice: [{ sides: 4, count: 8 }],
    bonus: 8,
    target: 'self-or-ally',
  },
  'potion-of-healing-supreme': {
    kind: 'heal',
    what: 'Heals 10d4 + 20. Takes your action to drink or give.',
    dice: [{ sides: 4, count: 10 }],
    bonus: 20,
    target: 'self-or-ally',
  },
  'healers-kit': {
    kind: 'stabilise',
    what: 'Steady a friend at 0 hit points: no more death saves. Takes your action and one of its 10 uses.',
    target: 'dying-ally',
  },
  'alchemists-fire-flask': {
    kind: 'throw',
    what: 'Throw it up to 20 ft: 1d4 fire on a hit, burning until they put it out. Takes your action.',
    dice: [{ sides: 4, count: 1 }],
    damageType: 'fire',
    rangeFt: 20,
    target: 'enemy',
  },
  'acid-vial': {
    kind: 'throw',
    what: 'Throw it up to 20 ft: 2d6 acid on a hit. Takes your action.',
    dice: [{ sides: 6, count: 2 }],
    damageType: 'acid',
    rangeFt: 20,
    target: 'enemy',
  },
  'holy-water-flask': {
    kind: 'throw',
    what: 'Throw it up to 20 ft: 2d6 radiant to a fiend or undead on a hit. Takes your action.',
    dice: [{ sides: 6, count: 2 }],
    damageType: 'radiant',
    rangeFt: 20,
    onlyAgainst: ['fiend', 'undead'],
    target: 'enemy',
  },
  'antitoxin-vial': {
    kind: 'effect',
    what: 'Drink it: advantage on saving throws against poison for an hour. Takes your action.',
    effect: { key: 'antitoxin', name: 'Antitoxin', roundsLeft: 600 },
    target: 'self',
  },
  caltrops: {
    kind: 'other',
    what: 'Scatter them over a 5-foot square: anyone walking in makes a DC 15 Dexterity save or stops and takes 1 piercing. Takes your action.',
    target: 'none',
  },
  'ball-bearings-bag-of-1000': {
    kind: 'other',
    what: 'Spill them over a 10-foot square: anyone walking in makes a DC 10 Dexterity save or falls prone. Takes your action.',
    target: 'none',
  },
}

/** The SRD's potions of healing aren't in its equipment list (they're magic items), so the shop and inventory use these. */
export const POTIONS = [
  { index: 'potion-of-healing-common', name: 'Potion of Healing', weight: 0.5 },
  { index: 'potion-of-healing-greater', name: 'Potion of Greater Healing', weight: 0.5 },
  { index: 'potion-of-healing-superior', name: 'Potion of Superior Healing', weight: 0.5 },
  { index: 'potion-of-healing-supreme', name: 'Potion of Supreme Healing', weight: 0.5 },
] as const

/** Items in an inventory that can be used, with what using them does. */
export function usableItems(inventory: InventoryItem[]): { item: InventoryItem; use: Usable }[] {
  return inventory.flatMap((item) => {
    const use = item.item ? USABLE[item.item] : undefined
    if (!use || item.quantity <= 0 || (item.uses !== null && item.uses <= 0)) return []
    return [{ item, use }]
  })
}

/** The AC from what's worn, if any of it is SRD armour (otherwise the sheet's AC stands). */
export function wornArmourClass(
  character: Pick<Character, 'scores' | 'className'>,
  inventory: InventoryItem[],
  equipment: SrdEquipment,
): number | null {
  const owned = inventory.filter((i) => i.item).map((i) => ({ worn: i.worn, srd: findItem(equipment, i.item ?? '') }))
  if (!owned.some((o) => o.srd?.armour)) return null
  const armour = owned.find((o) => o.worn && o.srd?.armour && o.srd.sub !== 'Shield')?.srd ?? null
  const shield = owned.some((o) => o.worn && o.srd?.sub === 'Shield')
  return armourClass(character.scores, { armour, shield }, character.className.toLowerCase()).ac
}
