// Fights and battle-map tokens. The database decides who may do what: only the DM runs a fight and
// reads a monster's secrets; initiative is thrown by the server; players move only their own token.

import type { Character } from '../rules/character.ts'
import { healthState, letteredNames, monsterInitiative, unknownNames, type HealthState } from '../rules/combat.ts'
import type { RollRequest } from '../rules/dice.ts'
import type { SrdMonster } from '../rules/srd/index.ts'
import type { Tables } from './database.types.ts'
import { fromDatabaseError, fromServerRule, NOT_CONNECTED, TableError } from './errors.ts'
import { requestToJson, rowToRoll, type Roll } from './rolls.ts'
import { supabase } from './supabase.ts'

export type Encounter = {
  id: string
  campaignId: string
  status: 'active' | 'ended'
  round: number
  currentId: string | null
  startedAt: string
}

export type Combatant = {
  id: string
  encounterId: string
  campaignId: string
  kind: 'character' | 'monster'
  characterId: string | null
  /** What players see: "Unknown creature 1" until the DM reveals a monster. */
  shownName: string
  revealed: boolean
  initiative: number | null
  tiebreak: number
  health: HealthState
  conditions: string[]
  createdAt: string
}

/** A monster's real name and numbers, which only the DM can read. */
export type CombatantSecret = {
  combatantId: string
  name: string
  monster: string | null
  hp: number
  maxHp: number
  ac: number
}

export type Token = {
  id: string
  campaignId: string
  mapId: string
  characterId: string | null
  combatantId: string | null
  x: number
  y: number
  hidden: boolean
}

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

const HEALTH: HealthState[] = ['healthy', 'bloodied', 'near-death', 'down']

export function rowToEncounter(row: Tables<'encounters'>): Encounter {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status === 'active' ? 'active' : 'ended',
    round: row.round,
    currentId: row.current_id,
    startedAt: row.started_at,
  }
}

export function rowToCombatant(row: Tables<'combatants'>): Combatant {
  return {
    id: row.id,
    encounterId: row.encounter_id,
    campaignId: row.campaign_id,
    kind: row.kind === 'monster' ? 'monster' : 'character',
    characterId: row.character_id,
    shownName: row.shown_name,
    revealed: row.revealed,
    initiative: row.initiative,
    tiebreak: row.tiebreak,
    health: HEALTH.find((h) => h === row.health) ?? 'healthy',
    conditions: row.conditions,
    createdAt: row.created_at,
  }
}

function rowToSecret(row: Tables<'combatant_secrets'>): CombatantSecret {
  return {
    combatantId: row.combatant_id,
    name: row.name,
    monster: row.monster,
    hp: row.hp,
    maxHp: row.max_hp,
    ac: row.ac,
  }
}

export function rowToToken(row: Tables<'tokens'>): Token {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    mapId: row.map_id,
    characterId: row.character_id,
    combatantId: row.combatant_id,
    x: row.x,
    y: row.y,
    hidden: row.hidden,
  }
}

export type FightState = { encounter: Encounter; combatants: Combatant[]; secrets: CombatantSecret[] } | null

/** The fight going on at this table, if any. Secrets come back only for the DM. */
export async function getActiveFight(campaignId: string): Promise<FightState> {
  const { data, error } = await db()
    .from('encounters')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw fromDatabaseError(error)
  if (!data) return null
  const [combatants, secrets] = await Promise.all([
    db().from('combatants').select('*').eq('encounter_id', data.id),
    db().from('combatant_secrets').select('*').eq('campaign_id', campaignId),
  ])
  if (combatants.error) throw fromDatabaseError(combatants.error)
  if (secrets.error) throw fromDatabaseError(secrets.error)
  const ids = new Set(combatants.data.map((c) => c.id))
  return {
    encounter: rowToEncounter(data),
    combatants: combatants.data.map(rowToCombatant),
    secrets: secrets.data.filter((s) => ids.has(s.combatant_id)).map(rowToSecret),
  }
}

/** The DM starts a fight with these characters; everyone is then asked for initiative. */
export async function startFight(campaignId: string, characters: Character[]): Promise<FightState> {
  const { data, error } = await db().from('encounters').insert({ campaign_id: campaignId }).select('*').single()
  if (error) throw error.code === '23505' ? new TableError('A fight is already going on.') : fromDatabaseError(error)
  const encounter = rowToEncounter(data)
  let combatants: Combatant[] = []
  if (characters.length > 0) {
    const added = await db()
      .from('combatants')
      .insert(
        characters.map((c) => ({
          encounter_id: encounter.id,
          campaign_id: campaignId,
          kind: 'character',
          character_id: c.id,
          shown_name: c.name.slice(0, 60),
          revealed: true,
          tiebreak: c.scores.dexterity,
        })),
      )
      .select('*')
    if (added.error) throw fromDatabaseError(added.error)
    combatants = added.data.map(rowToCombatant)
  }
  return { encounter, combatants, secrets: [] }
}

/**
 * The DM adds monsters of one kind: hidden as "Unknown creature" for players, lettered for the DM
 * ("Goblin A"), on their average hit points, each rolling initiative behind the screen.
 */
export async function addMonsters(
  encounter: Encounter,
  monster: SrdMonster,
  count: number,
  existing: { combatants: Combatant[]; secrets: CombatantSecret[] },
): Promise<{ combatants: Combatant[]; secrets: CombatantSecret[]; rolls: Roll[] }> {
  const shown = unknownNames(
    existing.combatants.map((c) => c.shownName),
    count,
  )
  const names = letteredNames(
    monster.name,
    existing.secrets.map((s) => s.name),
    count,
  )
  const added = await db()
    .from('combatants')
    .insert(
      shown.map((shownName) => ({
        encounter_id: encounter.id,
        campaign_id: encounter.campaignId,
        kind: 'monster',
        shown_name: shownName,
        tiebreak: monster.scores.dexterity,
      })),
    )
    .select('*')
  if (added.error) throw fromDatabaseError(added.error)
  const combatants = added.data
    .map(rowToCombatant)
    .sort((a, b) => a.shownName.localeCompare(b.shownName, 'en', { numeric: true }))
  const secretRows = combatants.map((c, i) => ({
    combatant_id: c.id,
    campaign_id: encounter.campaignId,
    name: names[i] ?? monster.name,
    monster: monster.index,
    hp: Math.max(1, monster.hp),
    max_hp: Math.max(1, monster.hp),
    ac: monster.ac,
  }))
  const secrets = await db().from('combatant_secrets').insert(secretRows).select('*')
  if (secrets.error) throw fromDatabaseError(secrets.error)

  const rolls: Roll[] = []
  for (const combatant of combatants) {
    const roll = await rollInitiative(combatant.id, monsterInitiative(monster))
    rolls.push(roll)
    combatant.initiative = roll.total
  }
  return { combatants, secrets: secrets.data.map(rowToSecret), rolls }
}

/** Throws initiative on the server and puts it in the turn order. */
export async function rollInitiative(combatantId: string, request: RollRequest): Promise<Roll> {
  const { data, error } = await db().rpc('roll_initiative', {
    p_combatant_id: combatantId,
    p_roll: requestToJson(request),
  })
  if (error) {
    if ((error.code === '22023' || error.code === '23505') && error.message) throw new TableError(`${error.message}.`)
    throw fromDatabaseError(error)
  }
  return rowToRoll(data)
}

/** Ends the turn: the next in the order goes (the server works it out). The DM, or whoever's turn it is. */
export async function endTurn(encounterId: string): Promise<Encounter> {
  const { data, error } = await db().rpc('end_turn', { p_encounter_id: encounterId })
  if (error) {
    if ((error.code === '22023' || error.code === '42501') && error.message) throw new TableError(`${error.message}.`)
    throw fromDatabaseError(error)
  }
  return rowToEncounter(data)
}

export type CombatantPatch = Partial<Pick<Combatant, 'shownName' | 'revealed' | 'health' | 'conditions'>>

export async function updateCombatant(id: string, patch: CombatantPatch): Promise<void> {
  const { error } = await db()
    .from('combatants')
    .update({
      ...(patch.shownName !== undefined && { shown_name: patch.shownName.slice(0, 60) }),
      ...(patch.revealed !== undefined && { revealed: patch.revealed }),
      ...(patch.health !== undefined && { health: patch.health }),
      ...(patch.conditions !== undefined && { conditions: patch.conditions }),
    })
    .eq('id', id)
  if (error) throw fromDatabaseError(error)
}

/** The DM changes a monster's hit points; players learn only how hurt it looks. */
export async function setMonsterHp(secret: CombatantSecret, hp: number): Promise<void> {
  const clamped = Math.max(0, Math.min(secret.maxHp, Math.round(hp)))
  const { error } = await db().from('combatant_secrets').update({ hp: clamped }).eq('combatant_id', secret.combatantId)
  if (error) throw fromDatabaseError(error)
  await updateCombatant(secret.combatantId, { health: healthState(clamped, secret.maxHp) })
}

export async function removeCombatant(id: string): Promise<void> {
  const { error } = await db().from('combatants').delete().eq('id', id)
  if (error) throw fromDatabaseError(error)
}

/** Ends the fight: the turn order goes, and the monsters' tokens leave the map. */
export async function endFight(encounter: Encounter, combatants: Combatant[]): Promise<void> {
  const monsters = combatants.filter((c) => c.kind === 'monster').map((c) => c.id)
  if (monsters.length > 0) {
    const { error: tokenError } = await db().from('tokens').delete().in('combatant_id', monsters)
    if (tokenError) throw fromDatabaseError(tokenError)
  }
  const { error } = await db()
    .from('encounters')
    .update({ status: 'ended', ended_at: new Date().toISOString(), current_id: null })
    .eq('id', encounter.id)
  if (error) throw fromDatabaseError(error)
}

// ---------------------------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------------------------

/** The tokens on a map that you may see. */
export async function listTokens(campaignId: string, mapId: string): Promise<Token[]> {
  const { data, error } = await db().from('tokens').select('*').eq('campaign_id', campaignId).eq('map_id', mapId)
  if (error) throw fromDatabaseError(error)
  return data.map(rowToToken)
}

export type NewToken = { characterId?: string; combatantId?: string; x: number; y: number; hidden?: boolean }

/** The DM puts tokens on a map. */
export async function placeTokens(campaignId: string, mapId: string, tokens: NewToken[]): Promise<Token[]> {
  if (tokens.length === 0) return []
  const { data, error } = await db()
    .from('tokens')
    .insert(
      tokens.map((t) => ({
        campaign_id: campaignId,
        map_id: mapId,
        character_id: t.characterId ?? null,
        combatant_id: t.combatantId ?? null,
        x: t.x,
        y: t.y,
        hidden: t.hidden ?? false,
      })),
    )
    .select('*')
  if (error) throw fromDatabaseError(error)
  return data.map(rowToToken)
}

/**
 * Moves a miniature through the server, which keeps players to their own miniature and, in a
 * fight, to their turn and their movement left (it counts the feet walked).
 */
export async function moveToken(id: string, x: number, y: number): Promise<void> {
  const { error } = await db().rpc('move_token', {
    p_token_id: id,
    p_x: Math.max(0, Math.round(x)),
    p_y: Math.max(0, Math.round(y)),
  })
  if (error) throw fromServerRule(error)
}

export async function setTokenHidden(id: string, hidden: boolean): Promise<void> {
  const { error } = await db().from('tokens').update({ hidden }).eq('id', id)
  if (error) throw fromDatabaseError(error)
}

export async function removeToken(id: string): Promise<void> {
  const { error } = await db().from('tokens').delete().eq('id', id)
  if (error) throw fromDatabaseError(error)
}
