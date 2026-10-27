// Giving things (I1a): the DM gives items and coins, takes coins and shares them out; players hand
// things to each other. All of it happens in server functions (supabase/migrations/
// 20261027180000_giving.sql), so nothing is lost or doubled. Also the party stash, and noticing
// a gift arrive for your character.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RARITIES, TYPE_TAGS, type DmItem, type Rarity, type TypeTag } from '../rules/catalogue.ts'
import type { InventoryItem, Wallet } from '../rules/character.ts'
import { EMPTY_WALLET } from '../rules/character.ts'
import { useTableChanges, type RowChange } from './campaignChannel.ts'
import { parseInventory, parseWallet } from './characterRows.ts'
import type { Json, Tables } from './database.types.ts'
import { fromDatabaseError, messageFor, NOT_CONNECTED, TableError } from './errors.ts'
import { rowToLogEvent, type Gift } from './notebook.ts'
import { supabase } from './supabase.ts'

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

export type PartyStash = { items: InventoryItem[]; wallet: Wallet }
export const EMPTY_STASH: PartyStash = { items: [], wallet: EMPTY_WALLET }

/** The DM's offer of coins (in copper) for something a character carries. */
export type Offer = {
  id: string
  characterId: string
  itemId: string
  itemName: string
  quantity: number
  copper: number
  status: 'open' | 'sold' | 'declined' | 'withdrawn'
  createdAt: string
}

/** What the DM can do with things and coins; each resolves with a problem, or null. */
export type GivingControls = {
  /** The DM's own items, and making, changing and throwing them away. */
  yours: DmItem[]
  /** Loads the DM's items again (after pasting a campaign in). */
  reloadYours: () => void
  saveItem: (item: DmItem) => Promise<string | null>
  deleteItem: (id: string) => Promise<string | null>
  /** Offers to buy from players: the newest first. */
  offers: Offer[]
  offer: (characterId: string, itemId: string, quantity: number, copper: number) => Promise<string | null>
  withdraw: (offerId: string) => Promise<string | null>
  /** Puts things (and coins in copper) in the party stash for everyone. */
  putOnTable: (items: InventoryItem[], copper: number) => Promise<string | null>
  /** Takes one thing out of the stash for good, or clears it, coins and all. */
  removeFromStash: (itemId: string) => Promise<string | null>
  clearStash: () => Promise<string | null>
  /** Puts coins in the stash (positive copper) or takes them out (negative), with change made. */
  stashCoins: (copper: number) => Promise<string | null>
  /** Takes something (or some of a stack) away from a character, for good. */
  takeItem: (characterId: string, itemId: string, quantity: number) => Promise<string | null>
  /** Items (weapons listed with whether the character is trained, for their card) and coins in copper. */
  give: (
    characterId: string,
    items: InventoryItem[],
    weapons: Record<string, boolean>,
    copper: number,
  ) => Promise<string | null>
  take: (characterId: string, copper: number) => Promise<string | null>
  split: (characterIds: string[], copper: number) => Promise<string | null>
  stash: PartyStash
}

/** A player (or the DM) hands an item, or some of a stack, and coins to someone else. */
export type HandOver = (
  toCharacterId: string,
  what: { itemId: string | null; quantity: number; coins: Wallet; proficient: boolean | null },
) => Promise<string | null>

/** Giving that does nothing, for tests. */
export const NO_GIVING: GivingControls = {
  give: async () => null,
  take: async () => null,
  split: async () => null,
  stash: EMPTY_STASH,
  yours: [],
  reloadYours: () => {},
  saveItem: async () => null,
  deleteItem: async () => null,
  offers: [],
  offer: async () => null,
  withdraw: async () => null,
  putOnTable: async () => null,
  removeFromStash: async () => null,
  clearStash: async () => null,
  takeItem: async () => null,
  stashCoins: async () => null,
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

export function giveItems(
  characterId: string,
  items: InventoryItem[],
  weapons: Record<string, boolean>,
  copper: number,
) {
  return call(() =>
    db().rpc('give_items', {
      p_character_id: characterId,
      p_items: items as unknown as Json,
      p_weapons: weapons,
      p_copper: copper,
    }),
  )
}

export function takeCoins(characterId: string, copper: number) {
  return call(() => db().rpc('take_coins', { p_character_id: characterId, p_copper: copper }))
}

export function splitCoins(campaignId: string, characterIds: string[], copper: number) {
  return call(() =>
    db().rpc('split_coins', { p_campaign_id: campaignId, p_character_ids: characterIds, p_copper: copper }),
  )
}

export function handOver(fromCharacterId: string): HandOver {
  return (to, what) =>
    call(() =>
      db().rpc('hand_over', {
        p_from: fromCharacterId,
        p_to: to,
        p_item_id: what.itemId as string,
        p_quantity: what.quantity,
        p_coins: what.coins as unknown as Json,
        p_proficient: what.proficient as boolean,
      }),
    )
}

function rowToStash(row: Tables<'party_stash'>): PartyStash {
  return { items: parseInventory(row.items), wallet: parseWallet(row.wallet) }
}

/** The party stash, kept up to date. */
export function useStash(campaignId: string, userId: string): PartyStash {
  const [stash, setStash] = useState<PartyStash>(EMPTY_STASH)
  useEffect(() => {
    if (!supabase) return
    let live = true
    void supabase
      .from('party_stash')
      .select('*')
      .eq('campaign_id', campaignId)
      .maybeSingle()
      .then(({ data }) => live && data && setStash(rowToStash(data)))
    return () => {
      live = false
    }
  }, [campaignId])
  const onChange = useCallback((change: RowChange<'party_stash'>) => {
    setStash(change.type === 'upsert' ? rowToStash(change.row) : EMPTY_STASH)
  }, [])
  useTableChanges(campaignId, userId, 'party_stash', onChange)
  return stash
}

/** Calls back when something given to this character arrives (live, not on loading). */
export function useGiftArrivals(
  campaignId: string,
  userId: string,
  characterId: string | null,
  onGift: (gift: Gift, text: string) => void,
): void {
  const onChange = useCallback(
    (change: RowChange<'log_events'>) => {
      if (change.type !== 'upsert' || !characterId) return
      const event = rowToLogEvent(change.row)
      if (event.gift?.to.includes(characterId)) onGift(event.gift, event.text)
    },
    [characterId, onGift],
  )
  useTableChanges(campaignId, userId, 'log_events', onChange)
}

/** Giving for the DM screen, through the server. */
export function useGivingControls(campaignId: string, userId: string): GivingControls {
  const stash = useStash(campaignId, userId)
  const offers = useOffers(campaignId, userId)
  const [yours, setYours] = useState<DmItem[]>([])
  const reload = useCallback(() => {
    if (!supabase) return
    void supabase
      .from('dm_items')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at')
      .then(({ data }) => data && setYours(data.map(rowToDmItem)))
  }, [campaignId])
  useEffect(reload, [reload])
  return useMemo(
    () => ({
      give: giveItems,
      take: takeCoins,
      split: (ids: string[], copper: number) => splitCoins(campaignId, ids, copper),
      stash,
      yours,
      reloadYours: reload,
      saveItem: async (item: DmItem) => {
        const row = {
          name: item.name.trim().slice(0, 60),
          description: item.description.slice(0, 1000),
          type: item.type,
          rarity: item.rarity,
          key: item.key,
        }
        const problem = await call(() =>
          yours.some((y) => y.id === item.id)
            ? db().from('dm_items').update(row).eq('id', item.id)
            : db()
                .from('dm_items')
                .insert({ ...row, campaign_id: campaignId }),
        )
        if (!problem) reload()
        return problem
      },
      deleteItem: async (id: string) => {
        const problem = await call(() => db().from('dm_items').delete().eq('id', id))
        if (!problem) reload()
        return problem
      },
      offers,
      offer: (characterId: string, itemId: string, quantity: number, copper: number) =>
        call(() =>
          db().rpc('make_offer', {
            p_character_id: characterId,
            p_item_id: itemId,
            p_quantity: quantity,
            p_copper: copper,
          }),
        ),
      withdraw: (offerId: string) => call(() => db().rpc('withdraw_offer', { p_offer_id: offerId })),
      putOnTable: (items: InventoryItem[], copper: number) =>
        call(() =>
          db().rpc('put_on_table', { p_campaign_id: campaignId, p_items: items as unknown as Json, p_copper: copper }),
        ),
      removeFromStash: (itemId: string) =>
        call(() => db().rpc('remove_from_stash', { p_campaign_id: campaignId, p_item_id: itemId })),
      clearStash: () => call(() => db().rpc('clear_stash', { p_campaign_id: campaignId })),
      stashCoins: (copper: number) =>
        call(() => db().rpc('stash_coins', { p_campaign_id: campaignId, p_copper: copper })),
      takeItem: (characterId: string, itemId: string, quantity: number) =>
        call(() => db().rpc('take_items', { p_character_id: characterId, p_item_id: itemId, p_quantity: quantity })),
    }),
    [campaignId, stash, yours, offers, reload],
  )
}

function rowToDmItem(row: Tables<'dm_items'>): DmItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: (TYPE_TAGS.some((t) => t.key === row.type) ? row.type : 'other') as TypeTag,
    rarity: (RARITIES.some((r) => r.key === row.rarity) ? row.rarity : null) as Rarity | null,
    key: row.key,
  }
}

function rowToOffer(row: Tables<'offers'>): Offer {
  return {
    id: row.id,
    characterId: row.character_id,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: row.quantity,
    copper: row.copper,
    status: (['open', 'sold', 'declined', 'withdrawn'] as const).find((s) => s === row.status) ?? 'withdrawn',
    createdAt: row.created_at,
  }
}

/** Offers you may see (all, for the DM; your character's, for a player), newest first, kept up to date. */
export function useOffers(campaignId: string, userId: string): Offer[] {
  const [offers, setOffers] = useState<Offer[]>([])
  useEffect(() => {
    if (!supabase) return
    let live = true
    void supabase
      .from('offers')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => live && data && setOffers(data.map(rowToOffer)))
    return () => {
      live = false
    }
  }, [campaignId])
  const onChange = useCallback((change: RowChange<'offers'>) => {
    if (change.type !== 'upsert') return
    const offer = rowToOffer(change.row)
    setOffers((now) => [offer, ...now.filter((o) => o.id !== offer.id)])
  }, [])
  useTableChanges(campaignId, userId, 'offers', onChange)
  return offers
}

/** A player sells, or says no thanks. */
export function answerOffer(offerId: string, sell: boolean): Promise<string | null> {
  return call(() => db().rpc('answer_offer', { p_offer_id: offerId, p_sell: sell }))
}

/** The party stash for a player: what's in it, taking something, and sharing out its coins. */
export type StashControls = {
  stash: PartyStash
  take: (itemId: string, quantity: number, proficient: boolean | null) => Promise<string | null>
  split: () => Promise<string | null>
}

export function useStashControls(campaignId: string, userId: string, characterId: string | null): StashControls {
  const stash = useStash(campaignId, userId)
  return useMemo(
    () => ({
      stash,
      take: (itemId: string, quantity: number, proficient: boolean | null) =>
        call(() =>
          db().rpc('take_from_stash', {
            p_character_id: characterId as string,
            p_item_id: itemId,
            p_quantity: quantity,
            p_proficient: proficient as boolean,
          }),
        ),
      split: () => call(() => db().rpc('split_stash', { p_campaign_id: campaignId })),
    }),
    [campaignId, characterId, stash],
  )
}
