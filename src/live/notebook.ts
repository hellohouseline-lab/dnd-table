// The DM's notebook and the session log. The database lets only the DM read or write the notebook;
// the log is written by the DM's screens, and players see only entries marked visible.

import type { Json, Tables } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type NextStep = { id: string; text: string; done: boolean }
export type KeyItem = { id: string; name: string; holder: string }
export type Notebook = { whereWeAre: string; nextSteps: NextStep[]; keyItems: KeyItem[] }

export type LogKind = 'note' | 'damage' | 'heal' | 'rest' | 'condition' | 'stage'
export type LogEvent = {
  id: string
  campaignId: string
  kind: LogKind
  text: string
  visible: boolean
  createdAt: string
}

export const EMPTY_NOTEBOOK: Notebook = { whereWeAre: '', nextSteps: [], keyItems: [] }
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
        ? { id: String(item.id ?? crypto.randomUUID()), text: item.text, done: item.done === true }
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
  }
}

export async function getNotebook(campaignId: string): Promise<Notebook> {
  const { data, error } = await db().from('dm_notebooks').select('*').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data ? rowToNotebook(data) : EMPTY_NOTEBOOK
}

export async function saveNotebook(campaignId: string, notebook: Notebook): Promise<void> {
  const { error } = await db()
    .from('dm_notebooks')
    .upsert(
      {
        campaign_id: campaignId,
        where_we_are: notebook.whereWeAre.slice(0, 4000),
        next_steps: notebook.nextSteps,
        key_items: notebook.keyItems,
      },
      { onConflict: 'campaign_id' },
    )
  if (error) throw fromDatabaseError(error)
}

const KINDS: LogKind[] = ['note', 'damage', 'heal', 'rest', 'condition', 'stage']

export function rowToLogEvent(row: Tables<'log_events'>): LogEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: KINDS.find((kind) => kind === row.kind) ?? 'note',
    text: row.text,
    visible: row.visible,
    createdAt: row.created_at,
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
