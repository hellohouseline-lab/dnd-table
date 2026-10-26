// Shops (I1c): the DM's shops and their notes, open shops for players, buying and selling through
// the server (supabase/migrations/20261027210000_shops.sql), and the sales the DM can undo.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InventoryItem } from '../rules/character.ts'
import { SHOP_KINDS, type Shop, type ShopKind, type StockLine } from '../rules/shops.ts'
import { useTableChanges, type RowChange } from './campaignChannel.ts'
import { parseInventory } from './characterRows.ts'
import type { Json, Tables } from './database.types.ts'
import { fromDatabaseError, messageFor, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

async function call(
  run: () => PromiseLike<{ error: { message: string; code?: string } | null }>,
): Promise<string | null> {
  try {
    const { error } = await run()
    if (error) throw fromDatabaseError(error)
    return null
  } catch (caught) {
    return messageFor(caught)
  }
}

export type Sale = {
  id: string
  shopId: string | null
  characterId: string
  kind: 'buy' | 'sell'
  item: InventoryItem | null
  quantity: number
  copper: number
  undone: boolean
  createdAt: string
}

/** A player's own price for something on the shelves, and the DM's answer. Prices in copper. */
export type Haggle = {
  id: string
  shopId: string
  characterId: string
  stockId: string
  itemName: string
  bundles: number
  asking: number
  offer: number
  counter: number | null
  status: 'open' | 'countered' | 'agreed' | 'refused' | 'withdrawn'
  createdAt: string
}

/** The DM's side: making and stocking shops, opening and closing them, and undoing sales. */
export type ShopControls = {
  shops: Shop[]
  /** The DM's note on each shopkeeper, by shop. */
  notes: Record<string, string>
  save: (shop: Shop, note: string) => Promise<string | null>
  remove: (shopId: string) => Promise<string | null>
  setOpen: (shopId: string, open: boolean) => Promise<string | null>
  sales: Sale[]
  undo: (saleId: string) => Promise<string | null>
  /** Players' offers: agree, say no, or name a counter-price (copper). */
  haggles: Haggle[]
  answerHaggle: (haggleId: string, agree: boolean, counter: number | null) => Promise<string | null>
  /** Whether players may add gear for free on Change your character. */
  playersAddGear: boolean
  setPlayersAddGear: (value: boolean) => Promise<string | null>
}

/** A player's side: the open shops, buying and selling. */
export type Shopping = {
  shops: Shop[]
  buy: (shopId: string, stockId: string, bundles: number, proficient: boolean | null) => Promise<string | null>
  sell: (shopId: string, itemId: string, quantity: number) => Promise<string | null>
  /** Your own offers, newest first. */
  haggles: Haggle[]
  haggle: (
    shopId: string,
    stockId: string,
    bundles: number,
    offer: number,
    proficient: boolean | null,
  ) => Promise<string | null>
  takeCounter: (haggleId: string, take: boolean) => Promise<string | null>
}

export const NO_SHOPS: ShopControls = {
  shops: [],
  notes: {},
  save: async () => null,
  remove: async () => null,
  setOpen: async () => null,
  sales: [],
  undo: async () => null,
  haggles: [],
  answerHaggle: async () => null,
  playersAddGear: true,
  setPlayersAddGear: async () => null,
}

function parseStock(value: Json): StockLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return []
    const l = v as Record<string, Json | undefined>
    if (typeof l.id !== 'string' || typeof l.name !== 'string') return []
    const num = (x: Json | undefined, d: number) => (typeof x === 'number' && x >= 0 ? x : d)
    return [
      {
        id: l.id,
        item: typeof l.item === 'string' ? l.item : null,
        ...(typeof l.magic === 'string' ? { magic: l.magic } : {}),
        name: l.name,
        cost: num(l.cost, 0),
        price: typeof l.price === 'number' ? l.price : null,
        quantity: typeof l.quantity === 'number' ? l.quantity : null,
        bundle: Math.max(1, num(l.bundle, 1)),
        weight: num(l.weight, 0),
        ...(typeof l.bonus === 'number' ? { bonus: l.bonus } : {}),
        ...(l.attune === true ? { attune: true } : {}),
        ...(typeof l.note === 'string' ? { note: l.note } : {}),
      },
    ]
  })
}

export function rowToShop(row: Tables<'shops'>): Shop {
  return {
    id: row.id,
    name: row.name,
    keeper: row.keeper,
    kind: (SHOP_KINDS.some((k) => k.key === row.kind) ? row.kind : 'general') as ShopKind,
    markup: row.markup,
    buys: row.buys,
    open: row.open,
    stock: parseStock(row.stock),
  }
}

function rowToSale(row: Tables<'sales'>): Sale {
  return {
    id: row.id,
    shopId: row.shop_id,
    characterId: row.character_id,
    kind: row.kind === 'sell' ? 'sell' : 'buy',
    item: parseInventory([row.item])[0] ?? null,
    quantity: row.quantity,
    copper: row.copper,
    undone: row.undone,
    createdAt: row.created_at,
  }
}

/** The shops you may see (all, for the DM; the open ones, for players), kept up to date. */
export function useShops(campaignId: string, userId: string): Shop[] {
  const [shops, setShops] = useState<Shop[]>([])
  const load = useCallback(() => {
    if (!supabase) return
    void supabase
      .from('shops')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at')
      .then(({ data }) => data && setShops(data.map(rowToShop)))
  }, [campaignId])
  useEffect(load, [load])
  const onChange = useCallback((change: RowChange<'shops'>) => {
    if (change.type === 'delete') setShops((now) => now.filter((s) => s.id !== change.id))
    // A shop a player can't see (closed) may still send an update with open false: drop it then.
    else {
      const shop = rowToShop(change.row)
      setShops((now) =>
        now.some((s) => s.id === shop.id) ? now.map((s) => (s.id === shop.id ? shop : s)) : [...now, shop],
      )
    }
  }, [])
  useTableChanges(campaignId, userId, 'shops', onChange)
  // A shop opening or closing (or a sale) is said in the log: look again, as a closed shop can't say so itself.
  const onLog = useCallback(
    (change: RowChange<'log_events'>) => {
      const data = change.type === 'upsert' ? change.row.data : null
      if (data && typeof data === 'object' && !Array.isArray(data) && 'shop' in data) load()
    },
    [load],
  )
  useTableChanges(campaignId, userId, 'log_events', onLog)
  return shops
}

function useSales(campaignId: string, userId: string): Sale[] {
  const [sales, setSales] = useState<Sale[]>([])
  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('sales')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => data && setSales(data.map(rowToSale)))
  }, [campaignId])
  const onChange = useCallback((change: RowChange<'sales'>) => {
    if (change.type !== 'upsert') return
    const sale = rowToSale(change.row)
    setSales((now) => [sale, ...now.filter((s) => s.id !== sale.id)].slice(0, 30))
  }, [])
  useTableChanges(campaignId, userId, 'sales', onChange)
  return sales
}

function rowToHaggle(row: Tables<'haggles'>): Haggle {
  return {
    id: row.id,
    shopId: row.shop_id,
    characterId: row.character_id,
    stockId: row.stock_id,
    itemName: row.item_name,
    bundles: row.bundles,
    asking: row.asking,
    offer: row.offer,
    counter: row.counter,
    status:
      (['open', 'countered', 'agreed', 'refused', 'withdrawn'] as const).find((s) => s === row.status) ?? 'withdrawn',
    createdAt: row.created_at,
  }
}

/** Haggles you may see (all, for the DM; your own, for a player), newest first, kept up to date. */
export function useHaggles(campaignId: string, userId: string): Haggle[] {
  const [haggles, setHaggles] = useState<Haggle[]>([])
  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('haggles')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => data && setHaggles(data.map(rowToHaggle)))
  }, [campaignId])
  const onChange = useCallback((change: RowChange<'haggles'>) => {
    if (change.type !== 'upsert') return
    const haggle = rowToHaggle(change.row)
    setHaggles((now) => [haggle, ...now.filter((h) => h.id !== haggle.id)].slice(0, 30))
  }, [])
  useTableChanges(campaignId, userId, 'haggles', onChange)
  return haggles
}

/** Shops for the DM screen, through the database. */
export function useShopControls(campaignId: string, userId: string, playersAddGear: boolean): ShopControls {
  const shops = useShops(campaignId, userId)
  const sales = useSales(campaignId, userId)
  const haggles = useHaggles(campaignId, userId)
  const [notes, setNotes] = useState<Record<string, string>>({})
  // The DM's latest choice, until the campaign row catches up.
  const [chosen, setChosen] = useState<boolean | null>(null)
  const addGear = chosen ?? playersAddGear
  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('shop_notes')
      .select('*')
      .eq('campaign_id', campaignId)
      .then(({ data }) => data && setNotes(Object.fromEntries(data.map((n) => [n.shop_id, n.note]))))
  }, [campaignId])

  return useMemo(
    () => ({
      shops,
      notes,
      sales,
      save: async (shop: Shop, note: string) => {
        const row = {
          name: shop.name.trim().slice(0, 60) || 'A shop',
          keeper: shop.keeper.trim().slice(0, 60),
          kind: shop.kind,
          markup: shop.markup,
          buys: shop.buys,
          open: shop.open,
          stock: shop.stock as unknown as Json,
        }
        try {
          const known = shops.some((s) => s.id === shop.id)
          const saved = known
            ? await db().from('shops').update(row).eq('id', shop.id).select('id').single()
            : await db()
                .from('shops')
                .insert({ ...row, campaign_id: campaignId })
                .select('id')
                .single()
          if (saved.error) throw fromDatabaseError(saved.error)
          const id = saved.data.id
          const kept = await db()
            .from('shop_notes')
            .update({ note: note.slice(0, 500) })
            .eq('shop_id', id)
            .select('shop_id')
          if (kept.error) throw fromDatabaseError(kept.error)
          if (kept.data.length === 0 && note.trim()) {
            const { error } = await db()
              .from('shop_notes')
              .insert({ shop_id: id, campaign_id: campaignId, note: note.slice(0, 500) })
            if (error) throw fromDatabaseError(error)
          }
          setNotes((now) => ({ ...now, [id]: note }))
          return null
        } catch (caught) {
          return messageFor(caught)
        }
      },
      remove: (shopId: string) => call(() => db().from('shops').delete().eq('id', shopId)),
      setOpen: (shopId: string, open: boolean) =>
        call(() => db().rpc('set_shop_open', { p_shop_id: shopId, p_open: open })),
      undo: (saleId: string) => call(() => db().rpc('undo_sale', { p_sale_id: saleId })),
      haggles,
      answerHaggle: (haggleId: string, agree: boolean, counter: number | null) =>
        call(() => db().rpc('answer_haggle', { p_haggle_id: haggleId, p_agree: agree, p_counter: counter as number })),
      playersAddGear: addGear,
      setPlayersAddGear: async (value: boolean) => {
        setChosen(value)
        return call(() => db().from('campaigns').update({ players_add_gear: value }).eq('id', campaignId))
      },
    }),
    [shops, notes, sales, haggles, campaignId, addGear],
  )
}

/** Shopping for a player's table screen. */
export function useShopping(campaignId: string, userId: string, characterId: string | null): Shopping {
  const all = useShops(campaignId, userId)
  const haggles = useHaggles(campaignId, userId)
  return useMemo(
    () => ({
      shops: all.filter((s) => s.open),
      buy: (shopId: string, stockId: string, bundles: number, proficient: boolean | null) =>
        call(() =>
          db().rpc('buy_item', {
            p_shop_id: shopId,
            p_stock_id: stockId,
            p_bundles: bundles,
            p_character_id: characterId as string,
            p_proficient: proficient as boolean,
          }),
        ),
      sell: (shopId: string, itemId: string, quantity: number) =>
        call(() =>
          db().rpc('sell_item', {
            p_shop_id: shopId,
            p_character_id: characterId as string,
            p_item_id: itemId,
            p_quantity: quantity,
          }),
        ),
      haggles: haggles.filter((h) => h.characterId === characterId),
      haggle: (shopId: string, stockId: string, bundles: number, offer: number, proficient: boolean | null) =>
        call(() =>
          db().rpc('haggle', {
            p_shop_id: shopId,
            p_stock_id: stockId,
            p_bundles: bundles,
            p_character_id: characterId as string,
            p_offer: offer,
            p_proficient: proficient as boolean,
          }),
        ),
      takeCounter: (haggleId: string, take: boolean) =>
        call(() => db().rpc('take_counter', { p_haggle_id: haggleId, p_take: take })),
    }),
    [all, characterId, haggles],
  )
}
