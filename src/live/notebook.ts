// The DM's notebook and the session log. The database lets only the DM read or write the notebook;
// the log is written by the DM's screens, and players see only entries marked visible.

import { DEFAULT_BOXES, parseBoxSettings, type BoxSettings } from '../rules/boxes.ts'
import type { Json, Tables } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

/** A step; one Go here wrote carries its scene's id, so the next scene can replace it. */
export type NextStep = { id: string; text: string; done: boolean; scene?: string }
export type KeyItem = { id: string; name: string; holder: string }
export type Notebook = {
  whereWeAre: string
  nextSteps: NextStep[]
  keyItems: KeyItem[]
  /** How full the DM's boxes are (their own numbers, or ours). */
  boxSettings: BoxSettings
  /** The scene the party is in now (story mode), if any. */
  currentSceneId: string | null
}

export type LogKind = 'note' | 'damage' | 'heal' | 'rest' | 'condition' | 'stage' | 'gift'
export type LogEvent = {
  id: string
  campaignId: string
  kind: LogKind
  text: string
  visible: boolean
  createdAt: string
  /** Something given: to whom (character ids), from whom, what, and coins in copper. */
  gift?: Gift
}

export type Gift = {
  to: string[]
  from: string | null
  items: { name: string; quantity: number }[]
  copper: number
  /** Put on the table for the whole party, not given to one. */
  stash: boolean
}

export const EMPTY_NOTEBOOK: Notebook = {
  whereWeAre: '',
  nextSteps: [],
  keyItems: [],
  boxSettings: DEFAULT_BOXES,
  currentSceneId: null,
}
const LOG_LENGTH = 150

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

function list<T>(value: Json, parse: (item: Record<string, Json | undefined>) => T | null): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const parsed = parse(item)
    return parsed ? [parsed] : []
  })
}

export function rowToNotebook(row: Tables<'dm_notebooks'>): Notebook {
  return {
    whereWeAre: row.where_we_are,
    nextSteps: list(row.next_steps, (item) =>
      typeof item.text === 'string'
        ? {
            id: String(item.id ?? crypto.randomUUID()),
            text: item.text,
            done: item.done === true,
            ...(typeof item.scene === 'string' ? { scene: item.scene } : {}),
          }
        : null,
    ),
    keyItems: list(row.key_items, (item) =>
      typeof item.name === 'string'
        ? {
            id: String(item.id ?? crypto.randomUUID()),
            name: item.name,
            holder: typeof item.holder === 'string' ? item.holder : '',
          }
        : null,
    ),
    boxSettings: parseBoxSettings(row.box_settings),
    currentSceneId: row.current_scene_id,
  }
}

export async function getNotebook(campaignId: string): Promise<Notebook> {
  const { data, error } = await db().from('dm_notebooks').select('*').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data ? rowToNotebook(data) : EMPTY_NOTEBOOK
}

/** An update, then an insert the first time: an upsert also rewrites campaign_id, which is refused. */
export async function saveNotebook(campaignId: string, notebook: Notebook): Promise<void> {
  const row = {
    where_we_are: notebook.whereWeAre.slice(0, 4000),
    next_steps: notebook.nextSteps,
    key_items: notebook.keyItems,
    box_settings: notebook.boxSettings,
    current_scene_id: notebook.currentSceneId,
  }
  const updated = await db().from('dm_notebooks').update(row).eq('campaign_id', campaignId).select('campaign_id')
  if (updated.error) throw fromDatabaseError(updated.error)
  if (updated.data.length > 0) return
  const { error } = await db()
    .from('dm_notebooks')
    .insert({ campaign_id: campaignId, ...row })
  if (error) throw fromDatabaseError(error)
}

const KINDS: LogKind[] = ['note', 'damage', 'heal', 'rest', 'condition', 'stage', 'gift']

export function rowToLogEvent(row: Tables<'log_events'>): LogEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: KINDS.find((kind) => kind === row.kind) ?? 'note',
    text: row.text,
    visible: row.visible,
    createdAt: row.created_at,
    ...(row.kind === 'gift' ? { gift: parseGift(row.data) } : {}),
  }
}

function parseGift(data: Json): Gift {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const ids = (value: Json | undefined) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [])
  return {
    to: ids(d.to),
    from: typeof d.from === 'string' ? d.from : null,
    items: list(d.items ?? null, (i) =>
      typeof i.name === 'string' ? { name: i.name, quantity: typeof i.quantity === 'number' ? i.quantity : 1 } : null,
    ),
    copper: typeof d.copper === 'number' ? d.copper : 0,
    stash: d.stash === true,
  }
}

/** The latest log entries you may see, newest first. */
export async function listLogEvents(campaignId: string): Promise<LogEvent[]> {
  const { data, error } = await db()
    .from('log_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(LOG_LENGTH)
  if (error) throw fromDatabaseError(error)
  return data.map(rowToLogEvent)
}

/** Every quick note and scene change at a table, oldest first, for searching past sessions. */
export async function listSessionNotes(campaignId: string): Promise<LogEvent[]> {
  const { data, error } = await db()
    .from('log_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .in('kind', ['note', 'stage'])
    .order('created_at', { ascending: true })
    .limit(5000)
  if (error) throw fromDatabaseError(error)
  return data.map(rowToLogEvent)
}

/** The DM adds to the log: a quick note, damage dealt, a rest. */
export async function addLogEvent(campaignId: string, kind: LogKind, text: string, visible = false): Promise<LogEvent> {
  const { data, error } = await db()
    .from('log_events')
    .insert({ campaign_id: campaignId, kind, text: text.trim().slice(0, 500), visible })
    .select('*')
    .single()
  if (error) throw fromDatabaseError(error)
  return rowToLogEvent(data)
}
