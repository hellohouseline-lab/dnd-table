import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { CharacterChange, CharacterRow } from './characterRows.ts'
import type { Tables } from './database.types.ts'
import { rowToAsked, type AskedRoll, type RollRequestRow } from './rollRequests.ts'
import { rowToRoll, type Roll, type RollRow } from './rolls.ts'
import { supabase } from './supabase.ts'

// Each campaign has one private live channel, 'campaign:<id>'. The database only lets people at
// that table use it. It carries who is online (presence), changes to the party's characters, new
// and changed rolls (secret ones reach only the roller and the DM, by the database's rules), the
// DM's requests for a roll, the stage, the log and the library, and sound effects as they're played.
// Everything on screen shares the one connection, which closes a moment after the last user
// lets go, so React reopening a screen doesn't reconnect.

type LiveCampaign = {
  channel: RealtimeChannel
  online: ReadonlySet<string>
  presenceListeners: Set<() => void>
  characterListeners: Set<(change: CharacterChange) => void>
  rollListeners: Set<(roll: Roll) => void>
  rollChangeListeners: Set<(roll: Roll) => void>
  requestListeners: Set<(request: AskedRoll) => void>
  tableListeners: Map<WatchedTable, Set<(change: RowChange<WatchedTable>) => void>>
  effectListeners: Set<(assetId: string) => void>
  users: number
  closeTimer?: ReturnType<typeof setTimeout>
}

/** Tables whose changes reach the screens as they are, row by row. */
export type WatchedTable = 'stage' | 'log_events' | 'assets'

/** A row added or changed, or the id of one removed. */
export type RowChange<T extends WatchedTable> = { type: 'upsert'; row: Tables<T> } | { type: 'delete'; id: string }

const WATCHED: WatchedTable[] = ['stage', 'log_events', 'assets']
const CLOSE_DELAY_MS = 1000
const NOBODY: ReadonlySet<string> = new Set()
const open = new Map<string, LiveCampaign>()

function acquire(campaignId: string, userId: string): LiveCampaign | null {
  if (!supabase) return null
  const existing = open.get(campaignId)
  if (existing) {
    clearTimeout(existing.closeTimer)
    existing.users += 1
    return existing
  }

  const channel = supabase.channel(`campaign:${campaignId}`, {
    config: { private: true, presence: { key: userId } },
  })
  const live: LiveCampaign = {
    channel,
    online: NOBODY,
    presenceListeners: new Set(),
    characterListeners: new Set(),
    rollListeners: new Set(),
    rollChangeListeners: new Set(),
    requestListeners: new Set(),
    tableListeners: new Map(WATCHED.map((table) => [table, new Set()])),
    effectListeners: new Set(),
    users: 1,
  }

  channel.on('presence', { event: 'sync' }, () => {
    live.online = new Set(Object.keys(channel.presenceState()))
    live.presenceListeners.forEach((listener) => listener())
  })

  // Listeners for database changes must be in place before subscribing.
  channel.on<CharacterRow>(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
      const change: CharacterChange | null =
        payload.eventType === 'DELETE'
          ? payload.old.id
            ? { type: 'delete', id: payload.old.id }
            : null
          : { type: 'upsert', row: payload.new }
      if (change) live.characterListeners.forEach((listener) => listener(change))
    },
  )

  channel.on<RollRow>(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'rolls', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
      const roll = rowToRoll(payload.new)
      live.rollListeners.forEach((listener) => listener(roll))
    },
  )

  channel.on<RollRow>(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'rolls', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
      const roll = rowToRoll(payload.new)
      live.rollChangeListeners.forEach((listener) => listener(roll))
    },
  )

  channel.on<RollRequestRow>(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'roll_requests', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
      if (payload.eventType === 'DELETE') return
      const request = rowToAsked(payload.new)
      live.requestListeners.forEach((listener) => listener(request))
    },
  )

  for (const table of WATCHED) {
    channel.on<Record<string, unknown>>(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` },
      (payload) => {
        const old = payload.old as { id?: string; campaign_id?: string }
        const change =
          payload.eventType === 'DELETE'
            ? { type: 'delete' as const, id: String(old.id ?? old.campaign_id ?? '') }
            : { type: 'upsert' as const, row: payload.new as Tables<typeof table> }
        live.tableListeners.get(table)?.forEach((listener) => listener(change))
      },
    )
  }

  channel.on('broadcast', { event: 'effect' }, ({ payload }) => {
    const assetId = (payload as { assetId?: unknown }).assetId
    if (typeof assetId === 'string') live.effectListeners.forEach((listener) => listener(assetId))
  })

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void channel.track({ since: new Date().toISOString() })
  })
  open.set(campaignId, live)
  return live
}

function release(campaignId: string): void {
  const live = open.get(campaignId)
  if (!live) return
  live.users -= 1
  if (live.users > 0) return
  live.closeTimer = setTimeout(() => {
    open.delete(campaignId)
    void supabase?.removeChannel(live.channel)
  }, CLOSE_DELAY_MS)
}

/** The user ids of everyone with this campaign open right now, including you. */
export function useOnlineIds(campaignId: string, userId: string): ReadonlySet<string> {
  const [online, setOnline] = useState<ReadonlySet<string>>(NOBODY)

  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    const update = () => setOnline(live.online)
    live.presenceListeners.add(update)
    update()
    return () => {
      live.presenceListeners.delete(update)
      release(campaignId)
    }
  }, [campaignId, userId])

  return online
}

/** Calls `onChange` whenever a character at this table is added, changed or removed. */
export function useCharacterChanges(
  campaignId: string,
  userId: string,
  onChange: (change: CharacterChange) => void,
): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.characterListeners.add(onChange)
    return () => {
      live.characterListeners.delete(onChange)
      release(campaignId)
    }
  }, [campaignId, userId, onChange])
}

/** Calls `onRoll` for every new roll at this table that you're allowed to see, your own included. */
export function useRollInserts(campaignId: string, userId: string, onRoll: (roll: Roll) => void): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.rollListeners.add(onRoll)
    return () => {
      live.rollListeners.delete(onRoll)
      release(campaignId)
    }
  }, [campaignId, userId, onRoll])
}

/** Calls `onChange` when a roll at this table changes, such as the DM turning a fail into a pass. */
export function useRollChanges(campaignId: string, userId: string, onChange: (roll: Roll) => void): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.rollChangeListeners.add(onChange)
    return () => {
      live.rollChangeListeners.delete(onChange)
      release(campaignId)
    }
  }, [campaignId, userId, onChange])
}

/** Calls `onRequest` when the DM asks for a roll, or closes one. */
export function useRequestChanges(campaignId: string, userId: string, onRequest: (request: AskedRoll) => void): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.requestListeners.add(onRequest)
    return () => {
      live.requestListeners.delete(onRequest)
      release(campaignId)
    }
  }, [campaignId, userId, onRequest])
}

/** Calls `onChange` when a row of this table, at this table, is added, changed or removed. */
export function useTableChanges<T extends WatchedTable>(
  campaignId: string,
  userId: string,
  table: T,
  onChange: (change: RowChange<T>) => void,
): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    const listeners = live.tableListeners.get(table) as Set<(change: RowChange<T>) => void> | undefined
    listeners?.add(onChange)
    return () => {
      listeners?.delete(onChange)
      release(campaignId)
    }
  }, [campaignId, userId, table, onChange])
}

/** Calls `onEffect` when someone else at the table plays a sound effect. */
export function useEffectBroadcasts(campaignId: string, userId: string, onEffect: (assetId: string) => void): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.effectListeners.add(onEffect)
    return () => {
      live.effectListeners.delete(onEffect)
      release(campaignId)
    }
  }, [campaignId, userId, onEffect])
}

/** Tells everyone at the table to play a sound effect now. (It isn't saved anywhere.) */
export function broadcastEffect(campaignId: string, assetId: string): void {
  void open.get(campaignId)?.channel.send({ type: 'broadcast', event: 'effect', payload: { assetId } })
}
