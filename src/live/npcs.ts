// The DM's people (S1c): loaded once, saved as they change. Only the DM can read or write them
// (supabase/migrations/20261027270000_npcs_take_items.sql).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ATTITUDES, type Attitude } from '../rules/npcs.ts'
import type { Tables } from './database.types.ts'
import { fromDatabaseError, messageFor, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type Npc = {
  id: string
  name: string
  role: string
  place: string
  portraitId: string | null
  voice: string
  wants: string
  knows: string
  secrets: string
  attitude: Attitude
  /** The shop they keep, if any. */
  shopId: string | null
  /** What's happened with them, newest first. */
  history: NpcNote[]
}

export type NpcNote = { id: string; at: string; text: string }

export const BLANK_NPC: Npc = {
  id: '',
  name: '',
  role: '',
  place: '',
  portraitId: null,
  voice: '',
  wants: '',
  knows: '',
  secrets: '',
  attitude: 'neutral',
  shopId: null,
  history: [],
}

export type NpcControls = {
  npcs: Npc[]
  status: 'loading' | 'ready'
  error: string | null
  /** Makes a new person (no id) or saves a change; resolves with the saved person, or null. */
  save: (npc: Npc) => Promise<Npc | null>
  remove: (id: string) => Promise<void>
  reload: () => void
}

export const NO_NPCS: NpcControls = {
  npcs: [],
  status: 'ready',
  error: null,
  save: async () => null,
  remove: async () => {},
  reload: () => {},
}

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

function rowToNpc(row: Tables<'npcs'>): Npc {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    place: row.place,
    portraitId: row.portrait_id,
    voice: row.voice,
    wants: row.wants,
    knows: row.knows,
    secrets: row.secrets,
    attitude: ATTITUDES.find((a) => a.key === row.attitude)?.key ?? 'neutral',
    shopId: row.shop_id,
    history: Array.isArray(row.history)
      ? row.history.flatMap((h) =>
          h && typeof h === 'object' && !Array.isArray(h) && typeof h.text === 'string'
            ? [{ id: String(h.id ?? crypto.randomUUID()), at: String(h.at ?? ''), text: h.text }]
            : [],
        )
      : [],
  }
}

const byName = (a: Npc, b: Npc) => a.name.localeCompare(b.name)

export function useNpcs(campaignId: string): NpcControls {
  const [npcs, setNpcs] = useState<Npc[]>([])
  const [status, setStatus] = useState<NpcControls['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [loads, setLoads] = useState(0)

  useEffect(() => {
    if (!supabase) return
    let live = true
    void supabase
      .from('npcs')
      .select('*')
      .eq('campaign_id', campaignId)
      .then(({ data, error: problem }) => {
        if (!live) return
        if (problem) setError(messageFor(fromDatabaseError(problem)))
        else setNpcs(data.map(rowToNpc).sort(byName))
        setStatus('ready')
      })
    return () => {
      live = false
    }
  }, [campaignId, loads])

  const save = useCallback(
    async (npc: Npc) => {
      const row = {
        name: npc.name.trim().slice(0, 80) || 'Someone',
        role: npc.role.slice(0, 80),
        place: npc.place.slice(0, 120),
        portrait_id: npc.portraitId,
        voice: npc.voice.slice(0, 500),
        wants: npc.wants.slice(0, 1000),
        knows: npc.knows.slice(0, 2000),
        secrets: npc.secrets.slice(0, 2000),
        attitude: npc.attitude,
        shop_id: npc.shopId,
        history: npc.history.slice(0, 200).map((h) => ({ id: h.id, at: h.at, text: h.text.slice(0, 500) })),
      }
      const saved = npc.id
        ? await db().from('npcs').update(row).eq('id', npc.id).select('*').single()
        : await db()
            .from('npcs')
            .insert({ ...row, campaign_id: campaignId })
            .select('*')
            .single()
      if (saved.error) {
        setError(messageFor(fromDatabaseError(saved.error)))
        return null
      }
      setError(null)
      const person = rowToNpc(saved.data)
      setNpcs((now) => [...now.filter((n) => n.id !== person.id), person].sort(byName))
      return person
    },
    [campaignId],
  )

  const remove = useCallback(async (id: string) => {
    setNpcs((now) => now.filter((n) => n.id !== id))
    const { error: problem } = await db().from('npcs').delete().eq('id', id)
    if (problem) setError(messageFor(fromDatabaseError(problem)))
  }, [])

  const reload = useCallback(() => setLoads((n) => n + 1), [])
  return useMemo(() => ({ npcs, status, error, save, remove, reload }), [npcs, status, error, save, remove, reload])
}
