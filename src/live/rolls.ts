// Throwing dice and reading the roll log. The server throws the dice (public.throw_dice), saves the
// roll and sends it to everyone at the table; secret rolls go only to the roller and the DM.

import { parseDiceStyle, type DiceStyle } from '../dice/style.ts'
import {
  isDieSides,
  type RollKind,
  type RollMode,
  type RollOutcome,
  type RollPart,
  type RollRequest,
  type RolledDamage,
  type RolledDie,
} from '../rules/dice.ts'
import type { Json, Tables } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type RollRow = Tables<'rolls'>

/** A roll as everyone at the table sees it. */
export type Roll = RollOutcome & {
  id: string
  campaignId: string
  rollerId: string
  characterId: string | null
  label: string
  kind: RollKind
  mode: RollMode
  modifier: number
  parts: RollPart[]
  secret: boolean
  style: DiceStyle
  createdAt: string
}

const LOG_LENGTH = 150

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : []
}

function asObject(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function parseDie(value: Json): RolledDie[] {
  const die = asObject(value)
  const sides = Number(die?.sides)
  if (!die || !isDieSides(sides)) return []
  return [{ sides, value: Number(die.value) || 1, dropped: die.dropped === true }]
}

function parseDamage(value: Json | null): RolledDamage | null {
  const damage = asObject(value ?? undefined)
  if (!damage) return null
  return {
    dice: asArray(damage.dice).flatMap(parseDie),
    modifier: Number(damage.modifier) || 0,
    total: Number(damage.total) || 0,
    type: typeof damage.type === 'string' ? damage.type : '',
    critical: damage.critical === true,
  }
}

function parsePart(value: Json): RollPart[] {
  const part = asObject(value)
  return part && typeof part.label === 'string' ? [{ label: part.label, value: Number(part.value) || 0 }] : []
}

const KINDS: RollKind[] = ['free', 'check', 'save', 'attack', 'initiative']
const MODES: RollMode[] = ['normal', 'advantage', 'disadvantage']

export function rowToRoll(row: RollRow): Roll {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    rollerId: row.roller_id,
    characterId: row.character_id,
    label: row.label,
    kind: KINDS.find((kind) => kind === row.kind) ?? 'free',
    mode: MODES.find((mode) => mode === row.mode) ?? 'normal',
    dice: asArray(row.dice).flatMap(parseDie),
    modifier: row.modifier,
    parts: asArray(row.parts).flatMap(parsePart),
    total: row.total,
    natural: row.natural_d20,
    damage: parseDamage(row.damage),
    secret: row.secret,
    style: parseDiceStyle(row.style),
    createdAt: row.created_at,
  }
}

/** What throw_dice expects. */
export function requestToJson(request: RollRequest): Json {
  return {
    label: request.label,
    kind: request.kind,
    character_id: request.characterId,
    dice: request.dice,
    modifier: request.modifier,
    parts: request.parts,
    mode: request.mode,
    damage: request.damage,
    secret: request.secret,
  }
}

/** Asks the server to throw the dice. Returns the roll, which everyone at the table also receives. */
export async function throwDice(campaignId: string, request: RollRequest): Promise<Roll> {
  const { data, error } = await db().rpc('throw_dice', { p_campaign_id: campaignId, p_roll: requestToJson(request) })
  if (error) throw rollError(error)
  return rowToRoll(data)
}

/** The latest rolls at this table, newest first. */
export async function listRolls(campaignId: string): Promise<Roll[]> {
  const { data, error } = await db()
    .from('rolls')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(LOG_LENGTH)
  if (error) throw fromDatabaseError(error)
  return data.map(rowToRoll)
}

/** Saves how your dice look at this table. */
export async function saveDiceStyle(campaignId: string, userId: string, style: DiceStyle): Promise<void> {
  const { error } = await db()
    .from('campaign_members')
    .update({ dice_style: style })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
  if (error) throw fromDatabaseError(error)
}

function rollError(error: { code?: string; message?: string }): TableError {
  // The server's own messages for a bad roll are already in plain words.
  if (error.code === '22023' && error.message) return new TableError(`${error.message}.`)
  return fromDatabaseError(error)
}
