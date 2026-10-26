// Opening a box (I1b, docs/I1_PLAN.md): a chest, a sack, a body, a desk or a hoard, junk to
// treasure. The free rules have no treasure tables, so these are ours: how many bits and bobs,
// pieces of gear, coins and magic items each richness holds (the DM can change the numbers), with
// magic items only up to the rarity that suits the party's level (decision 53): uncommon at levels
// 1 to 4, rare from 5, very rare from 11, legendary from 17. A search roll can trim or add to it.

import type { Entry, Rarity } from './catalogue.ts'
import { entryId, EMPTY_WALLET, type Wallet } from './character.ts'
import { giftName, needsBase } from './magic.ts'

export type Container = 'chest' | 'sack' | 'body' | 'desk' | 'hoard'
export type Richness = 'junk' | 'ordinary' | 'valuable' | 'treasure'
/** The search roll, if there was one: under 10, 10 to 14, 15 to 19, 20 or more. */
export type SearchRoll = 'none' | 'low' | 'fair' | 'good' | 'great'

export const CONTAINERS: { key: Container; name: string; line: string }[] = [
  { key: 'chest', name: 'A chest', line: 'Gear and coins, kept safe' },
  { key: 'sack', name: 'A sack or pack', line: 'Food, rope, odds and ends' },
  { key: 'body', name: 'A body', line: 'Pockets, a weapon, a few coins' },
  { key: 'desk', name: 'A desk or cupboard', line: 'Letters, tools, candles' },
  { key: 'hoard', name: 'A hoard', line: 'Mostly coins and magic' },
]

export const RICHNESS: { key: Richness; name: string; line: string }[] = [
  { key: 'junk', name: 'Junk', line: 'Odds and ends, a few copper' },
  { key: 'ordinary', name: 'Ordinary', line: 'Something useful, a few gold' },
  { key: 'valuable', name: 'Valuable', line: 'Good gear, a pouch of gold, a magic item' },
  { key: 'treasure', name: 'Treasure', line: 'A heap of gold and magic' },
]

export const SEARCH_ROLLS: { key: SearchRoll; name: string; line: string }[] = [
  { key: 'none', name: 'No roll', line: 'Just open it' },
  { key: 'low', name: 'Under 10', line: 'Only junk' },
  { key: 'fair', name: '10 to 14', line: 'The finds, but they miss the coins' },
  { key: 'good', name: '15 to 19', line: 'Everything' },
  { key: 'great', name: '20 or more', line: 'Everything, and something extra' },
]

type Span = [number, number]

/** How full each richness is: counts as low to high, coins in gold. */
export type BoxSettings = Record<Richness, { bits: Span; gear: Span; gold: Span; magic: Span }>

export const DEFAULT_BOXES: BoxSettings = {
  junk: { bits: [2, 4], gear: [0, 1], gold: [0, 0.2], magic: [0, 0] },
  ordinary: { bits: [1, 3], gear: [1, 2], gold: [1, 10], magic: [0, 0] },
  valuable: { bits: [0, 2], gear: [1, 3], gold: [10, 60], magic: [1, 1] },
  treasure: { bits: [0, 1], gear: [1, 2], gold: [50, 300], magic: [2, 3] },
}

/** The dearest gear (in copper) each richness may hold. */
const GEAR_COST: Record<Richness, number> = { junk: 100, ordinary: 1000, valuable: 5000, treasure: 50000 }

/** Containers lean towards some things: more coins in a hoard, fewer in a sack. */
const LEAN: Record<Container, { bits: number; gear: number; gold: number; magic: number }> = {
  chest: { bits: 1, gear: 1, gold: 1, magic: 1 },
  sack: { bits: 1.5, gear: 1.2, gold: 0.3, magic: 0.5 },
  body: { bits: 1, gear: 0.8, gold: 0.5, magic: 0.7 },
  desk: { bits: 1.5, gear: 0.8, gold: 0.5, magic: 0.7 },
  hoard: { bits: 0.3, gear: 0.6, gold: 2, magic: 1.5 },
}

const RARITY_ORDER: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary']

/** The rarest magic item that suits a party of this level. */
export function rarityCap(level: number): Rarity {
  if (level >= 17) return 'Legendary'
  if (level >= 11) return 'Very Rare'
  if (level >= 5) return 'Rare'
  return 'Uncommon'
}

export type Find = { id: string; entry: Entry; quantity: number }
export type BoxContents = { finds: Find[]; coins: Wallet }
export type BoxAsk = { container: Container; richness: Richness; level: number; search: SearchRoll }

type Rand = () => number

const between = ([low, high]: Span, rand: Rand) => low + Math.floor(rand() * (Math.floor(high) - Math.floor(low) + 1))
const pick = <T>(list: T[], rand: Rand): T | undefined => list[Math.floor(rand() * list.length)]

/** What can turn up in a box of this kind, by part. */
export function boxPools(entries: Entry[], ask: Pick<BoxAsk, 'richness' | 'level' | 'container'>) {
  const cap = RARITY_ORDER.indexOf(rarityCap(ask.level))
  const magic = entries.filter(
    (e) =>
      e.source === 'magic' &&
      e.rarity !== null &&
      RARITY_ORDER.indexOf(e.rarity) <= cap &&
      RARITY_ORDER.includes(e.rarity),
  )
  const gear = entries.filter((e) => {
    if (e.source !== 'gear' || e.gift.kind !== 'gear') return false
    const item = e.gift.item
    if (item.sub === 'Equipment Packs' || item.kind === 'mounts-and-vehicles') return false
    if (item.cost > GEAR_COST[ask.richness]) return false
    // A body has its weapon; a desk its tools; a sack, travelling gear.
    if (ask.container === 'desk') return item.kind === 'tools' || item.sub === 'Standard Gear'
    if (ask.container === 'sack') return item.sub === 'Standard Gear' || item.sub === 'Ammunition'
    return true
  })
  return { magic, gear, bits: entries.filter((e) => e.source === 'bits') }
}

/** A +1 weapon or armour from a box comes as a real weapon or suit: "Longsword +1". */
function withBase(entry: Entry | undefined, entries: Entry[], rand: Rand): Entry | undefined {
  if (!entry || entry.gift.kind !== 'magic') return entry
  const kind = needsBase(entry.gift.magic)
  if (!kind) return entry
  const bases = entries.flatMap((e) =>
    e.gift.kind === 'gear' && (kind === 'weapon' ? e.gift.item.kind === 'weapon' : e.gift.item.kind === 'armor')
      ? [e.gift.item]
      : [],
  )
  const base = pick(bases, rand) ?? null
  const gift = { ...entry.gift, base }
  return base ? { ...entry, key: `${entry.key}:${base.index}`, name: giftName(gift), gift } : entry
}

/** A magic item, leaning towards the less rare ones, and towards potions and scrolls. */
function pickMagic(pool: Entry[], rand: Rand): Entry | undefined {
  const consumable = pool.filter((e) => e.type === 'potions' || e.type === 'scrolls')
  if (consumable.length > 0 && rand() < 0.4) return pick(consumable, rand)
  const rarities = [...new Set(pool.map((e) => e.rarity))].sort(
    (a, b) => RARITY_ORDER.indexOf(a as Rarity) - RARITY_ORDER.indexOf(b as Rarity),
  )
  // The commoner a rarity, the likelier: 3 to 2 to 1.
  const weights = rarities.map((_, i) => rarities.length - i)
  let roll = rand() * weights.reduce((a, b) => a + b, 0)
  const rarity = rarities.find((_, i) => (roll -= weights[i]) < 0) ?? rarities[0]
  return pick(
    pool.filter((e) => e.rarity === rarity),
    rand,
  )
}

/** Gold as coins: whole gold pieces, with silver and copper for the odd change (and platinum in a hoard). */
function goldCoins(gold: number, container: Container): Wallet {
  const copper = Math.round(gold * 100)
  const pp = container === 'hoard' ? Math.floor(copper / 1000 / 2) : 0
  const rest = copper - pp * 1000
  return { ...EMPTY_WALLET, pp, gp: Math.floor(rest / 100), sp: Math.floor((rest % 100) / 10), cp: rest % 10 }
}

/** Opens a box: bits and bobs, gear, coins and magic items, as the settings and the search roll say. */
export function openBox(
  entries: Entry[],
  ask: BoxAsk,
  settings: BoxSettings = DEFAULT_BOXES,
  rand: Rand = Math.random,
): BoxContents {
  const s = settings[ask.richness]
  const lean = LEAN[ask.container]
  const pools = boxPools(entries, ask)
  const scale = ([low, high]: Span, by: number): Span => [low * by, high * by]
  const count = (span: Span, by: number) => Math.max(0, Math.round(between(scale(span, by), rand)))

  let bits = count(s.bits, lean.bits)
  let gear = count(s.gear, lean.gear)
  let magic = count(s.magic, lean.magic)
  let gold = s.gold[0] * lean.gold + rand() * (s.gold[1] - s.gold[0]) * lean.gold

  if (ask.search === 'low') {
    bits = Math.max(1, Math.min(2, bits))
    gear = 0
    magic = 0
    gold = 0
  } else if (ask.search === 'fair') {
    gold = 0
  } else if (ask.search === 'great') {
    if (pools.magic.length > 0 && ask.richness !== 'junk' && rand() < 0.5) magic += 1
    else gear += 1
  }

  const finds: Find[] = []
  const add = (entry: Entry | undefined, quantity = 1) => {
    if (!entry) return
    const same = finds.find((f) => f.entry.key === entry.key)
    if (same) same.quantity += quantity
    else finds.push({ id: entryId(), entry, quantity })
  }
  for (let i = 0; i < magic; i++) add(withBase(pickMagic(pools.magic, rand), entries, rand))
  for (let i = 0; i < gear; i++) {
    const g = pick(pools.gear, rand)
    const ammo = g?.gift.kind === 'gear' && g.gift.item.sub === 'Ammunition'
    add(g, ammo ? 10 + Math.floor(rand() * 11) : 1)
  }
  for (let i = 0; i < bits; i++) add(pick(pools.bits, rand))
  return { finds, coins: goldCoins(gold, ask.container) }
}

/** Another of the same kind in place of one find: a magic item for a magic item, gear for gear. */
export function rerollFind(entries: Entry[], ask: BoxAsk, find: Find, rand: Rand = Math.random): Find {
  const pools = boxPools(entries, ask)
  const pool = find.entry.source === 'magic' ? pools.magic : find.entry.source === 'gear' ? pools.gear : pools.bits
  const others = pool.filter((e) => e.key !== find.entry.key)
  const entry = find.entry.source === 'magic' ? withBase(pickMagic(others, rand), entries, rand) : pick(others, rand)
  return entry ? { id: entryId(), entry, quantity: 1 } : find
}

/** The party's level for boxes: the average, rounded down (at least 1). */
export function partyLevel(levels: number[]): number {
  if (levels.length === 0) return 1
  return Math.max(1, Math.floor(levels.reduce((a, b) => a + b, 0) / levels.length))
}

/** Settings read back from storage: anything missing or odd falls back to the default. */
export function parseBoxSettings(value: unknown): BoxSettings {
  const out = structuredClone(DEFAULT_BOXES)
  if (!value || typeof value !== 'object') return out
  for (const richness of Object.keys(out) as Richness[]) {
    const row = (value as Record<string, unknown>)[richness]
    if (!row || typeof row !== 'object') continue
    for (const part of ['bits', 'gear', 'gold', 'magic'] as const) {
      const span = (row as Record<string, unknown>)[part]
      if (
        Array.isArray(span) &&
        span.length === 2 &&
        span.every((n) => typeof n === 'number' && n >= 0 && n <= 10000)
      ) {
        out[richness][part] = [Math.min(span[0], span[1]), Math.max(span[0], span[1])]
      }
    }
  }
  return out
}
