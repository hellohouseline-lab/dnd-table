// The stage: what everyone sees and hears now. One row per table; only the DM changes it, and the
// change reaches every screen through the live channel.

import type { Tables, TablesUpdate } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type Stage = {
  campaignId: string
  sceneName: string
  imageId: string | null
  musicId: string | null
  musicPlaying: boolean
  /** Server time in milliseconds when the (looping) track would have started; null when stopped. */
  musicStartedAt: number | null
  /** Seconds into the track, while paused. */
  musicPosition: number
  musicVolume: number
  /** Ambience loops and their levels, 0 to 1. */
  ambience: Record<string, number>
  /** The battle map, shown instead of the picture while `mode` is 'map'. */
  mapId: string | null
  mode: 'scene' | 'map'
  playersMoveTokens: boolean
}

export type StagePatch = Partial<Omit<Stage, 'campaignId'>>

type StageRow = Tables<'stage'>

export function emptyStage(campaignId: string): Stage {
  return {
    campaignId,
    sceneName: '',
    imageId: null,
    musicId: null,
    musicPlaying: false,
    musicStartedAt: null,
    musicPosition: 0,
    musicVolume: 0.8,
    ambience: {},
    mapId: null,
    mode: 'scene',
    playersMoveTokens: true,
  }
}

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

export function rowToStage(row: StageRow): Stage {
  const ambience: Record<string, number> = {}
  if (row.ambience && typeof row.ambience === 'object' && !Array.isArray(row.ambience)) {
    for (const [id, level] of Object.entries(row.ambience)) {
      const value = Number(level)
      if (Number.isFinite(value) && value > 0) ambience[id] = Math.min(1, value)
    }
  }
  return {
    campaignId: row.campaign_id,
    sceneName: row.scene_name,
    imageId: row.image_id,
    musicId: row.music_id,
    musicPlaying: row.music_playing,
    musicStartedAt: row.music_started_at ? new Date(row.music_started_at).getTime() : null,
    musicPosition: row.music_position,
    musicVolume: row.music_volume,
    ambience,
    mapId: row.map_id,
    mode: row.mode === 'map' ? 'map' : 'scene',
    playersMoveTokens: row.players_move_tokens,
  }
}

function patchToRow(patch: StagePatch): TablesUpdate<'stage'> {
  const row: TablesUpdate<'stage'> = {}
  if (patch.sceneName !== undefined) row.scene_name = patch.sceneName.slice(0, 80)
  if (patch.imageId !== undefined) row.image_id = patch.imageId
  if (patch.musicId !== undefined) row.music_id = patch.musicId
  if (patch.musicPlaying !== undefined) row.music_playing = patch.musicPlaying
  if (patch.musicStartedAt !== undefined) {
    row.music_started_at = patch.musicStartedAt === null ? null : new Date(patch.musicStartedAt).toISOString()
  }
  if (patch.musicPosition !== undefined) row.music_position = Math.max(0, patch.musicPosition)
  if (patch.musicVolume !== undefined) row.music_volume = Math.min(1, Math.max(0, patch.musicVolume))
  if (patch.ambience !== undefined) row.ambience = patch.ambience
  if (patch.mapId !== undefined) row.map_id = patch.mapId
  if (patch.mode !== undefined) row.mode = patch.mode
  if (patch.playersMoveTokens !== undefined) row.players_move_tokens = patch.playersMoveTokens
  return row
}

/** The stage at a table; an empty one if the DM hasn't set it up yet. */
export async function getStage(campaignId: string): Promise<Stage> {
  const { data, error } = await db().from('stage').select('*').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data ? rowToStage(data) : emptyStage(campaignId)
}

/** The DM changes the stage (setting it up the first time). */
export async function saveStage(campaignId: string, patch: StagePatch): Promise<Stage> {
  const { data, error } = await db()
    .from('stage')
    .upsert({ campaign_id: campaignId, ...patchToRow(patch) }, { onConflict: 'campaign_id' })
    .select('*')
    .single()
  if (error) throw fromDatabaseError(error)
  return rowToStage(data)
}
