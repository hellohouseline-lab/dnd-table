// Starting gear (2014 rules, SRD): the class's choices and the background's kit become an
// inventory. Packs are opened into what's in them, the best armour and a shield are worn, and
// weapons go into the hand as attacks.

import type { AttackEntry } from '../character.ts'
import type { GearChoice, GearPart, SrdEquipment, SrdItem } from '../srd/index.ts'

export type Owned = { item: string; quantity: number }

/**
 * One choice made: which option, and for each category part in it, the items picked ("a martial
 * weapon": ["longsword"]).
 */
export type GearPick = { option: number; picks: string[][] }

/** The items an option gives, with the category parts filled in from the picks. */
export function optionItems(option: GearPart[], picks: string[][] = []): Owned[] {
  let category = 0
  return option.flatMap((part): Owned[] => {
    if ('item' in part) return [{ item: part.item, quantity: part.quantity }]
    const picked = picks[category++] ?? []
    return picked.slice(0, part.choose).map((item) => ({ item, quantity: 1 }))
  })
}

/** Whether every category part in the chosen option has its picks. */
export function pickComplete(choice: GearChoice, pick: GearPick | undefined): boolean {
  if (!pick) return false
  const option = choice.options[pick.option]
  if (!option) return false
  let category = 0
  return option.every((part) => ('item' in part ? true : (pick.picks[category++]?.length ?? 0) === part.choose))
}

/** Adds up the same item and opens packs into their contents. */
export function combine(owned: Owned[], equipment: SrdEquipment): Owned[] {
  const out = new Map<string, number>()
  const add = (item: string, quantity: number) => out.set(item, (out.get(item) ?? 0) + quantity)
  for (const { item, quantity } of owned) {
    const found = equipment.items.find((i) => i.index === item)
    if (found?.contents) for (const c of found.contents) add(c.item, c.quantity * quantity)
    else add(item, quantity)
  }
  return [...out].map(([item, quantity]) => ({ item, quantity }))
}

/** All the starting gear: fixed items, the choices made, and the background's kit. */
export function startingGear(
  fixed: Owned[],
  choices: GearChoice[],
  picks: (GearPick | undefined)[],
  equipment: SrdEquipment,
): Owned[] {
  const chosen = choices.flatMap((choice, i) => {
    const pick = picks[i]
    const option = pick ? choice.options[pick.option] : undefined
    return option ? optionItems(option, pick?.picks) : []
  })
  return combine([...fixed, ...chosen], equipment)
}

export function findItem(equipment: SrdEquipment, index: string): SrdItem | undefined {
  return equipment.items.find((i) => i.index === index)
}

/** What to wear from what's owned: the armour giving the best base AC, and a shield if there is one. */
export function wornFrom(owned: Owned[], equipment: SrdEquipment): { armour: SrdItem | null; shield: boolean } {
  const items = owned.map((o) => findItem(equipment, o.item)).filter((i): i is SrdItem => Boolean(i?.armour))
  const armour = items.filter((i) => i.sub !== 'Shield').sort((a, b) => b.armour!.base - a.armour!.base)[0] ?? null
  return { armour, shield: items.some((i) => i.sub === 'Shield') }
}

/**
 * Whether a class's proficiencies cover a weapon: "Simple Weapons", "Martial Weapons", or the
 * weapon by name ("Daggers", "Crossbows, light", "Hand crossbows").
 */
export function weaponProficient(weapon: SrdItem, proficiencies: string[]): boolean {
  const words = proficiencies.map((p) => p.toLowerCase())
  if (words.includes(`${(weapon.sub ?? '').toLowerCase()} weapons`)) return true
  const name = weapon.name.toLowerCase()
  const flipped = name.replace(/^(\w+), (\w+)$/, '$2 $1') // "Crossbow, light" as "light crossbow"
  return words.some((p) => {
    const one = p.replace(/s\b/g, '').replace(/^(\w+), (\w+)$/, '$2 $1')
    return one === name.replace(/s\b/g, '') || one === flipped.replace(/s\b/g, '')
  })
}

/** Weapons owned, as attack cards (one each, however many there are). */
export function attacksFrom(owned: Owned[], equipment: SrdEquipment, proficiencies: string[] = []): AttackEntry[] {
  return owned
    .map((o) => findItem(equipment, o.item))
    .filter((i): i is SrdItem => i?.kind === 'weapon')
    .filter((i) => !/^(arrow|bolt|sling-bullet|blowgun-needle)s?$/.test(i.index))
    .map((weapon) => ({
      id: `weapon-${weapon.index}`,
      name: weapon.name,
      weapon: weapon.index,
      proficient: weaponProficient(weapon, proficiencies),
      magicBonus: 0,
      ability: 'strength',
      damageDice: '',
      damageType: '',
    }))
}

/** Total weight in pounds. */
export function totalWeight(owned: Owned[], equipment: SrdEquipment): number {
  return owned.reduce((sum, o) => sum + (findItem(equipment, o.item)?.weight ?? 0) * o.quantity, 0)
}

/** "15 gp", "2 gp 5 sp", "8 cp", from copper pieces. */
export function coinText(copper: number): string {
  const gp = Math.floor(copper / 100)
  const sp = Math.floor((copper % 100) / 10)
  const cp = copper % 10
  return [gp && `${gp} gp`, sp && `${sp} sp`, cp && `${cp} cp`].filter(Boolean).join(' ') || '0 gp'
}
