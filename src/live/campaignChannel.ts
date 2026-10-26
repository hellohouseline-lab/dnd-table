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
// Presence also says who is in the call and whether their camera and microphone are on.
// Everything on screen shares the one connection, which closes a moment after the last user
// lets go, so React reopening a screen doesn't reconnect.

type LiveCampaign = {
  channel: RealtimeChannel
  online: ReadonlySet<string>
  calls: ReadonlyMap<string, CallPresence>
  since: string
  presenceListeners: Set<() => void>
  characterListeners: Set<(change: CharacterChange) => void>
  rollListeners: Set<(roll: Roll) => void>
  rollChangeListeners: Set<(roll: Roll) => void>
  requestListeners: Set<(request: AskedRoll) => void>
  tableListeners: Map<WatchedTable, Set<(change: RowChange<WatchedTable>) => void>>
  effectListeners: Set<(assetId: string) => void>
  pointerListeners: Set<(kind: 'hand' | 'ping', pointer: MapPointer) => void>
  cameraKeyListeners: Set<() => void>
  /** Told to load everything again: after the connection comes back, or when the tab is looked at again. */
  catchUpListeners: Set<() => void>
  subscribedBefore: boolean
  users: number
  closeTimer?: ReturnType<typeof setTimeout>
}

/** Tables whose changes reach the screens as they are, row by row. */
export type WatchedTable = 'stage' | 'log_events' | 'assets' | 'encounters' | 'combatants' | 'tokens'

/** A row added or changed, or the id of one removed. */
export type RowChange<T extends WatchedTable> = { type: 'upsert'; row: Tables<T> } | { type: 'delete'; id: string }

const WATCHED: WatchedTable[] = ['stage', 'log_events', 'assets', 'encounters', 'combatants', 'tokens']

/** A hand over the battle map (in grid squares), or a ping: sent to everyone, never saved. */
export type MapPointer = { userId: string; name: string; x: number; y: number }

/** Someone in the call: whether their camera and microphone are on. */
export type CallPresence = { camera: boolean; mic: boolean }

const CLOSE_DELAY_MS = 1000
const NOBODY: ReadonlySet<string> = new Set()
const NO_CALLS: ReadonlyMap<string, CallPresence> = new Map()
const open = new Map<string, LiveCampaign>()
/** This tab's place in each table's call, announced with its presence (only the tab sending the call has one). */
const myCalls = new Map<string, CallPresence>()

function callOf(meta: unknown): CallPresence | null {
  const call = (meta as { call?: unknown } | null)?.call as Partial<CallPresence> | undefined
  return call && typeof call.camera === 'boolean' && typeof call.mic === 'boolean'
    ? { camera: call.camera, mic: call.mic }
    : null
}

function presencePayload(campaignId: string, live: LiveCampaign) {
  const call = myCalls.get(campaignId)
  return call ? { since: live.since, call } : { since: live.since }
}

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
    calls: NO_CALLS,
    since: new Date().toISOString(),
    presenceListeners: new Set(),
    characterListeners: new Set(),
    rollListeners: new Set(),
    rollChangeListeners: new Set(),
    requestListeners: new Set(),
    tableListeners: new Map(WATCHED.map((table) => [table, new Set()])),
    effectListeners: new Set(),
    pointerListeners: new Set(),
    cameraKeyListeners: new Set(),
    catchUpListeners: new Set(),
    subscribedBefore: false,
    users: 1,
  }

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    live.online = new Set(Object.keys(state))
    // A person may have several tabs open; they're in the call if any one of them is sending it.
    const calls = new Map<string, CallPresence>()
    for (const [userId, metas] of Object.entries(state)) {
      const call = metas.map(callOf).find((c) => c !== null)
      if (call) calls.set(userId, call)
    }
    live.calls = calls
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

  for (const kind of ['hand', 'ping'] as const) {
    channel.on('broadcast', { event: kind }, ({ payload }) => {
      const p = payload as Partial<MapPointer>
      if (typeof p.userId === 'string' && typeof p.x === 'number' && typeof p.y === 'number') {
        const pointer = { userId: p.userId, name: String(p.name ?? ''), x: p.x, y: p.y }
        live.pointerListeners.forEach((listener) => listener(kind, pointer))
      }
    })
  }

  channel.on('broadcast', { event: 'camera-key' }, () => live.cameraKeyListeners.forEach((listener) => listener()))

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      void channel.track(presencePayload(campaignId, live))
      // Changes made while the connection was down never arrive, so after a reconnect, load again.
      if (live.subscribedBefore) live.catchUpListeners.forEach((listener) => listener())
      live.subscribedBefore = true
    } else {
      console.warn(`The table's live connection: ${status}`)
    }
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

/** Calls `onPointer` when someone else moves their hand over the battle map or pings it. */
export function usePointerBroadcasts(
  campaignId: string,
  userId: string,
  onPointer: (kind: 'hand' | 'ping', pointer: MapPointer) => void,
): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.pointerListeners.add(onPointer)
    return () => {
      live.pointerListeners.delete(onPointer)
      release(campaignId)
    }
  }, [campaignId, userId, onPointer])
}

/** Shows everyone your hand on the map, or a ping. (Hands are sent at most 4 times a second; see useMapPointers.) */
export function broadcastPointer(campaignId: string, kind: 'hand' | 'ping', pointer: MapPointer): void {
  void open.get(campaignId)?.channel.send({ type: 'broadcast', event: kind, payload: pointer })
}

/** Everyone in the call right now, by user id, with whether their camera and microphone are on. */
export function useCallPresence(campaignId: string, userId: string): ReadonlyMap<string, CallPresence> {
  const [calls, setCalls] = useState<ReadonlyMap<string, CallPresence>>(NO_CALLS)

  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    const update = () => setCalls(live.calls)
    live.presenceListeners.add(update)
    update()
    return () => {
      live.presenceListeners.delete(update)
      release(campaignId)
    }
  }, [campaignId, userId])

  return calls
}

/** Tells the table this tab is sending your camera and voice (or null when it stops). */
export function setCallPresence(campaignId: string, call: CallPresence | null): void {
  const before = myCalls.get(campaignId)
  if (call ? before?.camera === call.camera && before.mic === call.mic : !before) return
  if (call) myCalls.set(campaignId, call)
  else myCalls.delete(campaignId)
  const live = open.get(campaignId)
  if (live && String(live.channel.state) === 'joined') void live.channel.track(presencePayload(campaignId, live))
}

/** Calls `onChange` when the DM makes new camera links, so everyone reconnects with the new password. */
export function useCameraKeyBroadcasts(campaignId: string, userId: string, onChange: () => void): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.cameraKeyListeners.add(onChange)
    return () => {
      live.cameraKeyListeners.delete(onChange)
      release(campaignId)
    }
  }, [campaignId, userId, onChange])
}

/** DM: tells everyone the camera password has changed. */
export function broadcastCameraKey(campaignId: string): void {
  void open.get(campaignId)?.channel.send({ type: 'broadcast', event: 'camera-key', payload: {} })
}

const CATCH_UP_GAP_MS = 5000
let lastCatchUp = 0

// A laptop waking up or a tab coming back into view may have missed changes: load again, at most
// every few seconds.
if (typeof document !== 'undefined') {
  const catchUp = () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCatchUp < CATCH_UP_GAP_MS) return
    lastCatchUp = Date.now()
    open.forEach((live) => live.catchUpListeners.forEach((listener) => listener()))
  }
  document.addEventListener('visibilitychange', catchUp)
  window.addEventListener('online', catchUp)
  window.addEventListener('focus', catchUp)
}

/** Calls `onCatchUp` when this screen may have missed live changes and should load again. */
export function useCatchUp(campaignId: string, userId: string, onCatchUp: () => void): void {
  useEffect(() => {
    const live = acquire(campaignId, userId)
    if (!live) return
    live.catchUpListeners.add(onCatchUp)
    return () => {
      live.catchUpListeners.delete(onCatchUp)
      release(campaignId)
    }
  }, [campaignId, userId, onCatchUp])
}
