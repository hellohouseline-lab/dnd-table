import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { CharacterChange, CharacterRow } from './characterRows.ts'
import { rowToRoll, type Roll, type RollRow } from './rolls.ts'
import { supabase } from './supabase.ts'

// Each campaign has one private live channel, 'campaign:<id>'. The database only lets people at
// that table use it. It carries who is online (presence), changes to the party's characters and
// new rolls (secret ones reach only the roller and the DM, by the database's rules).
// Everything on screen shares the one connection, which closes a moment after the last user
// lets go, so React reopening a screen doesn't reconnect.

type LiveCampaign = {
  channel: RealtimeChannel
  online: ReadonlySet<string>
  presenceListeners: Set<() => void>
  characterListeners: Set<(change: CharacterChange) => void>
  rollListeners: Set<(roll: Roll) => void>
  users: number
  closeTimer?: ReturnType<typeof setTimeout>
}

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
