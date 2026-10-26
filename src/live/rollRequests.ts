// The DM's requests for a roll and the answers to them. The database decides who may do what: only
// the DM asks, overrides and closes; only the DM can read a secret DC; each character answers once.

import { isAbility, type Ability } from '../rules/abilities.ts'
import type { Askable, AskKind } from '../rules/askable.ts'
import type { Tables } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { rowToRoll, type Roll } from './rolls.ts'
import { supabase } from './supabase.ts'

export type RollRequestRow = Tables<'roll_requests'>

/** A request for a roll, as everyone at the table sees it. */
export type AskedRoll = {
  id: string
  campaignId: string
  kind: AskKind
  ability: Ability
  skill: string | null
  label: string
  plain: string
  characterIds: string[]
  /** The DC, if the DM chose to tell players; null when it's secret. */
  shownDc: number | null
  status: 'open' | 'closed'
  createdAt: string
}

export type AskInput = { askable: Askable; characterIds: string[]; dc: number; dcShown: boolean }

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

export function rowToAsked(row: RollRequestRow): AskedRoll {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: row.kind === 'skill' || row.kind === 'save' ? row.kind : 'ability',
    ability: isAbility(row.ability) ? row.ability : 'strength',
    skill: row.skill,
    label: row.label,
    plain: row.plain,
    characterIds: row.character_ids,
    shownDc: row.shown_dc,
    status: row.status === 'open' ? 'open' : 'closed',
    createdAt: row.created_at,
  }
}

/** Sends the DM's request to the players. Any request still open is closed first. */
export async function askForRoll(campaignId: string, input: AskInput): Promise<AskedRoll> {
  const { askable } = input
  const { data, error } = await db().rpc('ask_for_roll', {
    p_campaign_id: campaignId,
    p_request: {
      kind: askable.kind,
      ability: askable.ability,
      skill: askable.skill,
      label: askable.label,
      plain: askable.plain,
      character_ids: input.characterIds,
      dc: input.dc,
      dc_shown: input.dcShown,
    },
  })
  if (error) throw requestError(error)
  return rowToAsked(data)
}

/** The request waiting for answers at this table, if there is one. */
export async function getOpenRequest(campaignId: string): Promise<AskedRoll | null> {
  const { data, error } = await db()
    .from('roll_requests')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'open')
    .maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data ? rowToAsked(data) : null
}

/** Everyone's answers to a request so far. */
export async function listAnswers(requestId: string): Promise<Roll[]> {
  const { data, error } = await db().from('rolls').select('*').eq('request_id', requestId).order('created_at')
  if (error) throw fromDatabaseError(error)
  return data.map(rowToRoll)
}

/** The DC, for the DM. Players get null: the database never lets them read it. */
export async function getSecretDc(requestId: string): Promise<number | null> {
  const { data, error } = await db().from('roll_request_secrets').select('dc').eq('request_id', requestId).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data?.dc ?? null
}

/** The DM turns a pass into a fail, or back. */
export async function overrideRoll(rollId: string, passed: boolean): Promise<Roll> {
  const { data, error } = await db().rpc('override_roll', { p_roll_id: rollId, p_passed: passed })
  if (error) throw requestError(error)
  return rowToRoll(data)
}

/** The DM goes with the dice for every answer not yet ruled on. */
export async function acceptDice(requestId: string): Promise<Roll[]> {
  const { data, error } = await db().rpc('accept_dice', { p_request_id: requestId })
  if (error) throw requestError(error)
  return (data ?? []).map(rowToRoll)
}

/** "Done, play on": closes the request, and everyone's prompt goes away. */
export async function closeRequest(requestId: string): Promise<void> {
  const { error } = await db().rpc('close_roll_request', { p_request_id: requestId })
  if (error) throw requestError(error)
}

function requestError(error: { code?: string; message?: string }): TableError {
  // The server's own messages for a request it refused are already in plain words.
  if ((error.code === '22023' || error.code === '23505') && error.message) return new TableError(`${error.message}.`)
  return fromDatabaseError(error)
}
