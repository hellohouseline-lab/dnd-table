// The builder's Gear step: the class's starting choices and the background's kit made into an
// inventory, with the armour worn, the AC it gives, the weapons as attacks, the weight carried and
// the coins to start with.

import { entryId, type AttackEntry, type InventoryItem, type Wallet } from '../character.ts'
import { EMPTY_WALLET } from '../character.ts'
import type { GearChoice, GearPart, SrdBackground, SrdClass, SrdEquipment } from '../srd/index.ts'
import { armourClass, carryingCapacity, type ArmourClass } from './body.ts'
import type { BuilderDraft } from './draft.ts'
import {
  attacksFrom,
  findItem,
  pickComplete,
  startingGear,
  totalWeight,
  wornFrom,
  type GearPick,
  type Owned,
} from './gear.ts'
import type { Scores } from './scores.ts'

/** British spelling for the SRD's item names: "Leather Armor" as "Leather Armour". */
export function itemName(name: string): string {
  return name.replace(/\bArmor\b/g, 'Armour').replace(/\barmor\b/g, 'armour')
}

/** A category pick in words: its own ("a martial weapon"), or "one of the holy symbols". */
export function categoryWords(part: { category: string; desc: string }): string {
  return part.desc || `one of the ${part.category.replace(/-/g, ' ')}`
}

/** What an option gives, in words: "Chain Mail", "Leather Armour, Longbow and 20 Arrows", "a martial weapon". */
export function optionWords(option: GearPart[], equipment: SrdEquipment): string {
  const parts = option.map((part) => {
    if ('category' in part) return categoryWords(part)
    const name = itemName(findItem(equipment, part.item)?.name ?? part.item)
    return part.quantity > 1 ? `${part.quantity} × ${name}` : name
  })
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '')
}

export type GearSummary = {
  owned: Owned[]
  worn: { armour: string | null; shield: boolean }
  ac: ArmourClass | null
  attacks: AttackEntry[]
  weight: number
  capacity: number | null
  /** Coins to start with (the background's purse). */
  wallet: Wallet
  missing: string[]
}

function choicesMissing(choices: GearChoice[], picks: (GearPick | null)[], from: string): string[] {
  const left = choices.filter((choice, i) => !pickComplete(choice, picks[i] ?? undefined)).length
  return left === 0 ? [] : [left === 1 ? `Make the last ${from} choice` : `Make ${left} more ${from} choices`]
}

export function gearSummary(
  draft: BuilderDraft,
  cls: SrdClass | null,
  background: SrdBackground | null,
  equipment: SrdEquipment,
  scores: Scores | null,
): GearSummary {
  const classOwned = cls
    ? startingGear(
        cls.startingGear,
        cls.startingChoices,
        draft.gearPicks.map((p) => p ?? undefined),
        equipment,
      )
    : []
  const backgroundOwned = background
    ? startingGear(
        background.gear,
        background.gearChoices,
        draft.backgroundGearPicks.map((p) => p ?? undefined),
        equipment,
      )
    : []
  // The same item from both adds up.
  const merged = new Map<string, number>()
  for (const o of [...classOwned, ...backgroundOwned]) merged.set(o.item, (merged.get(o.item) ?? 0) + o.quantity)
  const owned = [...merged].map(([item, quantity]) => ({ item, quantity }))

  const worn = wornFrom(owned, equipment)
  return {
    owned,
    worn: { armour: worn.armour?.index ?? null, shield: worn.shield },
    ac: scores ? armourClass(scores, worn, cls?.index ?? '') : null,
    attacks: attacksFrom(owned, equipment, cls?.proficiencies ?? []),
    weight: totalWeight(owned, equipment),
    capacity: scores ? carryingCapacity(scores.strength) : null,
    wallet: { ...EMPTY_WALLET, gp: background?.gold ?? 0 },
    missing: [
      ...(cls ? choicesMissing(cls.startingChoices, draft.gearPicks, 'gear') : ['Pick a class first']),
      ...(background ? choicesMissing(background.gearChoices, draft.backgroundGearPicks, 'background') : []),
    ],
  }
}

/** The inventory to save: each item with its weight, armour and shield worn, a healer's kit with its 10 uses. */
export function toInventory(owned: Owned[], worn: GearSummary['worn'], equipment: SrdEquipment): InventoryItem[] {
  return owned.map(({ item, quantity }) => {
    const found = findItem(equipment, item)
    return {
      id: entryId(),
      item,
      name: itemName(found?.name ?? item),
      quantity,
      weight: found?.weight ?? 0,
      worn: item === worn.armour || (worn.shield && found?.sub === 'Shield'),
      uses: item === 'healers-kit' ? 10 : null,
    }
  })
}
