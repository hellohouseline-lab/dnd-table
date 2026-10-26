// Giving things (I1a): the DM gives items and coins, takes coins and shares them out; players hand
// things to each other. All of it happens in server functions (supabase/migrations/
// 20261027180000_giving.sql), so nothing is lost or doubled. Also the party stash, and noticing
// a gift arrive for your character.

import { useCallback, useEffect, useMemo, useState } from 'react'
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

/** What the DM can do with things and coins; each resolves with a problem, or null. */
export type GivingControls = {
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
  return useMemo(
    () => ({
      give: giveItems,
      take: takeCoins,
      split: (ids: string[], copper: number) => splitCoins(campaignId, ids, copper),
      stash,
    }),
    [campaignId, stash],
  )
}
