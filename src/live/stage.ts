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
  /** A scene's read-aloud, on stage for everyone when the DM shows it ('' when not). */
  readAloud: string
  /** The person the DM is showing (Show an NPC): their name, role and portrait; '' when nobody. */
  npcName: string
  npcRole: string
  npcImageId: string | null
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
    readAloud: '',
    npcName: '',
    npcRole: '',
    npcImageId: null,
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
    readAloud: row.read_aloud,
    npcName: row.npc_name,
    npcRole: row.npc_role,
    npcImageId: row.npc_image_id,
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
  if (patch.readAloud !== undefined) row.read_aloud = patch.readAloud.slice(0, 8000)
  if (patch.npcName !== undefined) row.npc_name = patch.npcName.slice(0, 80)
  if (patch.npcRole !== undefined) row.npc_role = patch.npcRole.slice(0, 80)
  if (patch.npcImageId !== undefined) row.npc_image_id = patch.npcImageId
  return row
}

/** The stage at a table; an empty one if the DM hasn't set it up yet. */
export async function getStage(campaignId: string): Promise<Stage> {
  const { data, error } = await db().from('stage').select('*').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data ? rowToStage(data) : emptyStage(campaignId)
}

/**
 * The DM changes the stage (setting it up the first time). An update, then an insert if there's no
 * row yet: an upsert would also rewrite campaign_id, which nobody may change, so it was refused.
 */
export async function saveStage(campaignId: string, patch: StagePatch): Promise<Stage> {
  const row = patchToRow(patch)
  const updated = await db().from('stage').update(row).eq('campaign_id', campaignId).select('*').maybeSingle()
  if (updated.error) throw fromDatabaseError(updated.error)
  if (updated.data) return rowToStage(updated.data)
  const { data, error } = await db()
    .from('stage')
    .insert({ campaign_id: campaignId, ...row })
    .select('*')
    .single()
  if (error) throw fromDatabaseError(error)
  return rowToStage(data)
}
