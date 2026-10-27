// Saved campaigns: campaign files the DM keeps to start any table from. Only the person who saved
// one can read it (supabase/migrations/20261027320000_campaign_presets.sql), so a bought adventure
// never goes in this public repository.

import { useCallback, useEffect, useState } from 'react'
import { fromDatabaseError, messageFor, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type CampaignPreset = { id: string; name: string; body: string; updatedAt: string }

export type CampaignPresetControls = {
  presets: CampaignPreset[]
  error: string | null
  /** Saves a campaign file under its name, replacing one already saved with that name. */
  save: (name: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

async function listPresets(): Promise<CampaignPreset[]> {
  const { data, error } = await db().from('campaign_presets').select('id, name, body, updated_at').order('name')
  if (error) throw fromDatabaseError(error)
  return data.map((row) => ({ id: row.id, name: row.name, body: row.body, updatedAt: row.updated_at }))
}

export function useCampaignPresets(): CampaignPresetControls {
  const [presets, setPresets] = useState<CampaignPreset[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listPresets().then(
      (list) => live && setPresets(list),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    return () => {
      live = false
    }
  }, [])

  const load = useCallback(async () => setPresets(await listPresets()), [])

  const save = useCallback(
    async (name: string, body: string) => {
      setError(null)
      const known = presets.find((p) => p.name === name)
      const { error: failed } = known
        ? await db().from('campaign_presets').update({ body, updated_at: new Date().toISOString() }).eq('id', known.id)
        : await db().from('campaign_presets').insert({ name, body })
      if (failed) throw fromDatabaseError(failed)
      await load()
    },
    [load, presets],
  )

  const remove = useCallback(
    async (id: string) => {
      setError(null)
      const { error: failed } = await db().from('campaign_presets').delete().eq('id', id)
      if (failed) throw fromDatabaseError(failed)
      await load()
    },
    [load],
  )

  return { presets, error, save, remove }
}
