// Fights and battle-map tokens. The database decides who may do what: only the DM runs a fight and
// reads a monster's secrets; initiative and attacks are thrown by the server; players move only their
// own token, on their turn, as far as their movement left.

import type { Character } from '../rules/character.ts'
import {
  healthState,
  letteredNames,
  monsterInitiative,
  monsterSaves,
  startingSquares,
  unknownNames,
  type HealthState,
} from '../rules/combat.ts'
import type { RollRequest } from '../rules/dice.ts'
import { threatReach, type TurnRecord } from '../rules/turn.ts'
import type { AreaTemplate } from '../rules/areas.ts'
import type { DiceGroup } from '../rules/dice.ts'
import type { SpellKind } from '../rules/spells.ts'
import type { FeatureCost } from '../rules/features.ts'
import { areaToJson, type AreaTone } from './areas.ts'
import type { Json } from './database.types.ts'
import type { Defences } from '../rules/damage.ts'
import type { SrdMonster } from '../rules/srd/index.ts'
import type { Tables } from './database.types.ts'
import { fromDatabaseError, fromServerRule, NOT_CONNECTED, TableError } from './errors.ts'
import { requestToJson, rowToRoll, type Roll } from './rolls.ts'
import { portraitForMonster } from './library.ts'
import { supabase } from './supabase.ts'
import type { BonusAttackKind } from '../rules/bonusActions.ts'
import { monsterTraitKeys, type ClockChoice, type ConditionClock } from '../rules/conditionClocks.ts'
import type { Ability } from '../rules/abilities.ts'
import type { Stance, TalkAnswer, TalkOutcome, TalkSkill } from '../rules/talk.ts'

export type Encounter = {
  id: string
  campaignId: string
  status: 'active' | 'ended'
  round: number
  currentId: string | null
  /** A parley: the fight is paused to talk, and Next turn waits (C3b). */
  parley: boolean
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
  /** How long each of its conditions lasts (C3a); a condition with no clock stays until taken off. */
  clocks: ConditionClock[]
  /** A monster's stance (C3b): fighting, surrendered, running away, or gone. */
  stance: Stance
  /** A monster's ready-made portrait (PRESET_PORTRAITS key), shown on its miniature; null for none. */
  art: string | null
  /** Walking speed in feet: a monster's own; a character's sheet has the one that counts. */
  speed: number
  /** How far it threatens for opportunity attacks: 5 feet, or more with a reach weapon. */
  reachFt: number
  /** What's used of this creature's turn, kept by the server and reset when its turn starts. */
  turn: TurnRecord
  createdAt: string
}

/** Something that happened in the fight, as everyone may see it (names are looked up on each screen). */
export type CombatEvent = {
  id: string
  encounterId: string
  round: number
  actorId: string | null
  targetId: string | null
  kind: 'attack' | 'action' | 'death_save' | 'spell' | 'concentration' | 'condition' | 'talk'
  rollId: string | null
  shown: {
    label?: string
    hit?: boolean
    critical?: boolean
    damage?: number | null
    damageType?: string | null
    /** A player's own attack total; null for a monster's, which stays behind the screen. */
    total?: number | null
    /** The target dropped to 0 hit points. */
    down?: boolean
    /** What the target's defences did to the damage. */
    adjust?: 'resisted' | 'vulnerable' | 'immune' | null
    /** For actions: 'dash', 'disengage', 'dodge', 'action', 'bonus' or 'reaction'. */
    what?: string
    /** An attack made with the reaction: an opportunity attack. */
    reaction?: boolean
    /** For death saves: what came of it, the die, and the count afterwards. */
    result?: 'success' | 'failure' | 'stable' | 'dead' | 'awake'
    rolled?: number
    successes?: number
    failures?: number
    /** For spells: its name and the slot it was cast with (0 for a cantrip). */
    spell?: string
    slot?: number
    /** A spell attack (hit, damage and so on as for an attack). */
    attack?: boolean
    /** A spell's saving throw: how it went, the ability and the DC. A monster's total is never sent. */
    save?: 'passed' | 'failed' | null
    saveAbility?: string | null
    dc?: number | null
    saveTotal?: number | null
    /** Hit points a healing spell gave back. */
    heal?: number | null
    /** For a concentration save: whether the spell held. */
    kept?: boolean
    /** For a feature used in a fight: its name ("Rage"). */
    feature?: string
    /** For an item used in a fight: its name, and what came of it. */
    item?: string
    stabilised?: boolean
    scattered?: boolean
    /** A zombie that refused to fall (Undead Fortitude). */
    fortitude?: boolean
    /** For a condition (C3a): which, put on or taken off, and what came of it. */
    condition?: string
    on?: boolean
    /** Resisted with a save first (a wolf's bite), or not. */
    resisted?: boolean
    rounds?: number
    endOfNextTurn?: boolean
    saveEachTurn?: string
    /** How it ended: its time ran out, a save each turn, or the caster's concentration. */
    ended?: 'time' | 'saved' | 'concentration'
    /** A monster's save each turn failed. */
    still?: boolean
    /** A player's save each turn: passed or not. */
    saved?: boolean
    stood?: boolean
    feet?: number
    brokeFree?: boolean
    /** Talk (C3b): the skill, who to, what they said (total as above). */
    talk?: TalkSkill
    targets?: string[]
    words?: string | null
    /** The DM's answer to a talk card, and what came of it. */
    answerTo?: string
    answer?: TalkAnswer
    outcome?: TalkOutcome | null
    /** A monster's stance set by hand, or running away as its turn came round. */
    stance?: Stance
    /** A parley called (true) or over (false). */
    parley?: boolean
  }
  undone: boolean
  seq: number
  createdAt: string
}

/**
 * A chance to react: someone moved out of this combatant's reach without Disengaging, so it may make
 * an opportunity attack. Players see their side's chances; a monster's are the DM's alone.
 */
export type ReactionPrompt = {
  id: string
  encounterId: string
  /** Who may strike. */
  combatantId: string
  /** Who moved away. */
  provokerId: string
  status: 'open' | 'taken' | 'passed'
  createdAt: string
}

/** A monster's real name and numbers, which only the DM can read. */
export type CombatantSecret = Defences & {
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
const STANCES: Stance[] = ['fighting', 'surrendered', 'running', 'fled']

export function rowToEncounter(row: Tables<'encounters'>): Encounter {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status === 'active' ? 'active' : 'ended',
    round: row.round,
    currentId: row.current_id,
    parley: row.parley,
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
    clocks: Array.isArray(row.condition_clocks) ? (row.condition_clocks as unknown as ConditionClock[]) : [],
    stance: STANCES.find((s) => s === row.stance) ?? 'fighting',
    art: row.art,
    speed: row.speed,
    reachFt: row.reach_ft,
    turn: {
      actionUsed: row.action_used,
      attacksMade: row.attacks_made,
      bonusUsed: row.bonus_used,
      reactionUsed: row.reaction_used,
      feetMoved: row.feet_moved,
      extraFeet: row.extra_feet,
      disengaged: row.disengaged,
      dodging: row.dodging,
    },
    createdAt: row.created_at,
  }
}

export function rowToEvent(row: Tables<'combat_events'>): CombatEvent {
  const shown = row.shown && typeof row.shown === 'object' && !Array.isArray(row.shown) ? row.shown : {}
  return {
    id: row.id,
    encounterId: row.encounter_id,
    round: row.round,
    actorId: row.actor_id,
    targetId: row.target_id,
    kind:
      row.kind === 'attack' ||
      row.kind === 'death_save' ||
      row.kind === 'spell' ||
      row.kind === 'concentration' ||
      row.kind === 'condition' ||
      row.kind === 'talk'
        ? row.kind
        : 'action',
    rollId: row.roll_id,
    shown: shown as CombatEvent['shown'],
    undone: row.undone,
    seq: Number(row.seq),
    createdAt: row.created_at,
  }
}

export function rowToPrompt(row: Tables<'reaction_prompts'>): ReactionPrompt {
  return {
    id: row.id,
    encounterId: row.encounter_id,
    combatantId: row.combatant_id,
    provokerId: row.provoker_id,
    status: row.status === 'taken' || row.status === 'passed' ? row.status : 'open',
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
    resistances: row.resistances,
    vulnerabilities: row.vulnerabilities,
    immunities: row.immunities,
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

/**
 * The DM starts a fight with these characters, and puts this battle map on stage (or none), in one
 * go on the server; everyone is then asked for initiative. Returns the whole fight as it now stands.
 */
export async function startFight(
  campaignId: string,
  characters: Character[],
  mapId: string | null,
): Promise<FightState> {
  const { error } = await db().rpc('start_fight', {
    p_campaign_id: campaignId,
    p_character_ids: characters.map((c) => c.id),
    // No map leaves the stage as it is. (The generated types don't know the server takes null here.)
    p_map_id: mapId as string,
  })
  if (error) throw fromServerRule(error)
  return getActiveFight(campaignId)
}

/**
 * The DM adds monsters of one kind, lettered ("Goblin A"), on their average hit points, each rolling
 * initiative behind the screen. Unless `known`, players see each as "Unknown creature" until revealed.
 */
export async function addMonsters(
  encounter: Encounter,
  monster: SrdMonster,
  count: number,
  existing: { combatants: Combatant[]; secrets: CombatantSecret[] },
  known = false,
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
      shown.map((shownName, i) => ({
        encounter_id: encounter.id,
        campaign_id: encounter.campaignId,
        kind: 'monster',
        shown_name: known ? (names[i] ?? monster.name).slice(0, 60) : shownName,
        revealed: known,
        tiebreak: monster.scores.dexterity,
        speed: Math.max(0, Math.min(200, monster.speed)),
        reach_ft: threatReach(monster.actions),
        art: portraitForMonster(monster.index)?.key ?? null,
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
    resistances: monster.resistances ?? [],
    vulnerabilities: monster.vulnerabilities ?? [],
    immunities: monster.immunities ?? [],
    condition_immunities: monster.conditionImmunities ?? [],
    saves: monsterSaves(monster),
    traits: monsterTraitKeys(monster),
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
  if (error) throw fromServerRule(error)
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

/** Ends the fight: the turn order goes, every miniature leaves the map, and the map stays up as a picture. */
export async function endFight(encounter: Encounter): Promise<void> {
  const { error } = await db().rpc('end_fight', { p_encounter_id: encounter.id })
  if (error) throw fromServerRule(error)
}

// ---------------------------------------------------------------------------------------------
// The turn: attacks, actions and the feed
// ---------------------------------------------------------------------------------------------

/**
 * Settles an attack on the server: throws it, checks it against the target's armour class, takes
 * the damage off and posts it to the feed. `request` is the attack roll as built for the sheet.
 */
export async function resolveAttack(
  attackerId: string,
  targetId: string,
  request: RollRequest,
): Promise<{ roll: Roll; event: CombatEvent }> {
  const { data, error } = await db().rpc('resolve_attack', {
    p_attacker_id: attackerId,
    p_target_id: targetId,
    p_roll: requestToJson(request),
  })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; event: Tables<'combat_events'> }
  return { roll: rowToRoll(result.roll), event: rowToEvent(result.event) }
}

/** Takes a chance to strike someone moving away: an attack with the reaction. */
export async function opportunityAttack(
  promptId: string,
  request: RollRequest,
): Promise<{ roll: Roll; event: CombatEvent }> {
  const { data, error } = await db().rpc('opportunity_attack', {
    p_prompt_id: promptId,
    p_roll: requestToJson(request),
  })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; event: Tables<'combat_events'> }
  return { roll: rowToRoll(result.roll), event: rowToEvent(result.event) }
}

/** Lets a chance to strike go. */
export async function passReaction(promptId: string): Promise<void> {
  const { error } = await db().rpc('pass_reaction', { p_prompt_id: promptId })
  if (error) throw fromServerRule(error)
}

/** The chances to strike still open in a fight. */
export async function listPrompts(encounterId: string): Promise<ReactionPrompt[]> {
  const { data, error } = await db()
    .from('reaction_prompts')
    .select('*')
    .eq('encounter_id', encounterId)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
  if (error) throw fromDatabaseError(error)
  return data.map(rowToPrompt)
}

/** A spell as cast_spell needs it, from its SRD entry and the caster's sheet. */
export type SpellCast = {
  index: string | null
  name: string
  level: number
  cost: 'action' | 'bonus' | 'reaction'
  concentration: boolean
  kind: SpellKind
  save?: string
  dcSuccess?: 'half' | 'none'
  damageType?: string | null
}

/**
 * Casts a spell on the server: spends its slot and its part of the turn, then settles it against
 * the targets (or everyone in its area). `roll` is the attack roll for an attack spell, otherwise
 * the dice of what it does. A lasting `area` is left on the map on stage.
 */
export async function castSpell(
  combatantId: string,
  spell: SpellCast,
  slot: number,
  targetIds: string[],
  roll: RollRequest | { dice: DiceGroup[]; modifier: number } | null,
  area: (AreaTemplate & { tone: AreaTone }) | null,
): Promise<{ roll: Roll | null; events: CombatEvent[] }> {
  const { data, error } = await db().rpc('cast_spell', {
    p_combatant_id: combatantId,
    p_spell: spell as unknown as Json,
    p_slot_level: slot,
    p_target_ids: targetIds,
    p_roll: (roll === null ? {} : 'kind' in roll ? requestToJson(roll) : roll) as unknown as Json,
    p_area: (area ? areaToJson(area) : null) as unknown as Json,
  })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'> | null; events: Tables<'combat_events'>[] }
  return {
    roll: result.roll && result.roll.id ? rowToRoll(result.roll) : null,
    events: (result.events ?? []).map(rowToEvent),
  }
}

/** Rolls the Constitution save to keep concentrating, on the server; failing it ends the spell. */
export async function rollConcentrationSave(characterId: string): Promise<{ roll: Roll; kept: boolean }> {
  const { data, error } = await db().rpc('concentration_save', { p_character_id: characterId })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; kept: boolean }
  return { roll: rowToRoll(result.roll), kept: result.kept }
}

/** Rolls a death save for a character at 0 hit points, on the server. */
export async function rollDeathSave(combatantId: string): Promise<{ roll: Roll; event: CombatEvent }> {
  const { data, error } = await db().rpc('death_save', { p_combatant_id: combatantId })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; event: Tables<'combat_events'> }
  return { roll: rowToRoll(result.roll), event: rowToEvent(result.event) }
}

export type TurnAction =
  | 'action'
  | 'dash'
  | 'disengage'
  | 'dodge'
  | 'hide'
  | 'help'
  | 'search'
  | 'ready'
  | 'object'
  | 'bonus'
  | 'reaction'
  | 'bonus_dash'
  | 'bonus_disengage'
  | 'bonus_hide'
  | 'bonus_dodge'

/**
 * An attack with the bonus action: two-weapon fighting (the default), a monk's unarmed strike or
 * Flurry of Blows, or a berserker's frenzy. The server checks the rules for each.
 */
export async function offhandAttack(
  attackerId: string,
  targetId: string,
  request: RollRequest,
  kind: BonusAttackKind = 'offhand',
): Promise<{ roll: Roll; event: CombatEvent }> {
  const { data, error } = await db().rpc('bonus_attack', {
    p_attacker_id: attackerId,
    p_target_id: targetId,
    p_roll: requestToJson(request),
    p_kind: kind,
  })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; event: Tables<'combat_events'> }
  return { roll: rowToRoll(result.roll), event: rowToEvent(result.event) }
}

/** Spends part of a turn: Dash, Disengage, Dodge, or the action, bonus action or reaction for something else. */
export async function spendAction(combatantId: string, what: TurnAction): Promise<CombatEvent> {
  const { data, error } = await db().rpc('use_action', { p_combatant_id: combatantId, p_what: what })
  if (error) throw fromServerRule(error)
  return rowToEvent(data)
}

/** Uses a feature in a fight: spends its part of the turn and names it in the feed. */
export async function featureInFight(combatantId: string, name: string, cost: FeatureCost): Promise<CombatEvent> {
  const { data, error } = await db().rpc('use_feature', { p_combatant_id: combatantId, p_name: name, p_cost: cost })
  if (error) throw fromServerRule(error)
  return rowToEvent(data)
}

/**
 * Uses an item from the character's pack (a potion, a healer's kit, a flask to throw, antitoxin):
 * it takes the action, and one comes out of the inventory. A throw sends its attack roll.
 */
export async function itemInFight(
  combatantId: string,
  itemId: string,
  targetId: string | null,
  request: RollRequest | null,
): Promise<{ event: CombatEvent; roll: Roll | null }> {
  const { data, error } = await db().rpc('use_item', {
    p_combatant_id: combatantId,
    p_item_id: itemId,
    // Null when there's no target (drinking it yourself) or nothing to roll; the server allows both.
    p_target_id: targetId as string,
    p_roll: (request ? requestToJson(request) : null) as Json,
  })
  if (error) throw fromServerRule(error)
  const result = data as { event: Tables<'combat_events'>; roll: Tables<'rolls'> | null }
  return { event: rowToEvent(result.event), roll: result.roll ? rowToRoll(result.roll) : null }
}

/** Takes back the newest thing that happened (a player only their own action). */
export async function undoEvent(eventId: string): Promise<CombatEvent> {
  const { data, error } = await db().rpc('undo_event', { p_event_id: eventId })
  if (error) throw fromServerRule(error)
  return rowToEvent(data)
}

/** What has happened in a fight, oldest first. */
export async function listEvents(encounterId: string): Promise<CombatEvent[]> {
  const { data, error } = await db()
    .from('combat_events')
    .select('*')
    .eq('encounter_id', encounterId)
    .order('seq', { ascending: true })
  if (error) throw fromDatabaseError(error)
  return data.map(rowToEvent)
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
 * The DM puts everyone in a fight on the map: the party down the left (those not on it already)
 * and these monsters a few squares away.
 */
export async function placeFighters(
  campaignId: string,
  mapId: string,
  fighters: { characterIds: string[]; combatantIds: string[] },
): Promise<Token[]> {
  const onMap = await listTokens(campaignId, mapId)
  const party = fighters.characterIds.filter((id) => !onMap.some((t) => t.characterId === id))
  const foes = fighters.combatantIds.filter((id) => !onMap.some((t) => t.combatantId === id))
  const partySquares = startingSquares(onMap, party.length, 1)
  const foeSquares = startingSquares([...onMap, ...partySquares], foes.length, 7)
  return placeTokens(campaignId, mapId, [
    ...party.map((characterId, i) => ({ characterId, ...partySquares[i] })),
    ...foes.map((combatantId, i) => ({ combatantId, ...foeSquares[i] })),
  ])
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

// ---------------------------------------------------------------------------------------------
// Conditions that wear off (C3a)

/** The clock as the server takes it: rounds, the end of the next turn, a save, a caster, an escape DC. */
export function clockToJson(choice: ClockChoice): Json {
  return {
    rounds: choice.howLong.kind === 'rounds' ? choice.howLong.rounds : null,
    endOfNextTurn: choice.howLong.kind === 'end-of-turn',
    save: choice.save ?? null,
    caster: choice.caster ?? null,
    escapeDc: choice.escapeDc ?? null,
  }
}

/**
 * The DM puts a condition on (with how long it lasts, or null for "until I take it off") or takes it
 * off. With `resist`, the creature first makes that save, rolled by the server.
 */
export async function setCondition(
  combatantId: string,
  condition: string,
  on: boolean,
  choice: ClockChoice | null,
  resist: { ability: Ability; dc: number } | null = null,
): Promise<{ event: CombatEvent; resisted: boolean; roll: Roll | null }> {
  const { data, error } = await db().rpc('set_condition', {
    p_combatant_id: combatantId,
    p_condition: condition,
    p_on: on,
    p_clock: (choice ? clockToJson(choice) : null) as Json,
    p_resist: resist as Json,
  })
  if (error) throw fromServerRule(error)
  const result = data as { event: Tables<'combat_events'>; resisted: boolean; roll: Tables<'rolls'> | null }
  return {
    event: rowToEvent(result.event),
    resisted: result.resisted,
    roll: result.roll ? rowToRoll(result.roll) : null,
  }
}

/** A player's save each turn to shake off a condition, rolled by the server. */
export async function conditionSave(
  combatantId: string,
  condition: string,
): Promise<{ roll: Roll; saved: boolean; event: CombatEvent }> {
  const { data, error } = await db().rpc('condition_save', { p_combatant_id: combatantId, p_condition: condition })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; saved: boolean; event: Tables<'combat_events'> }
  return { roll: rowToRoll(result.roll), saved: result.saved, event: rowToEvent(result.event) }
}

/** Standing up from prone, for half your speed. */
export async function standUp(combatantId: string): Promise<CombatEvent> {
  const { data, error } = await db().rpc('stand_up', { p_combatant_id: combatantId })
  if (error) throw fromServerRule(error)
  return rowToEvent(data)
}

/** Breaking free of a grab or a web: the action, and Athletics or Acrobatics against the escape DC. */
export async function breakFree(combatantId: string): Promise<{ roll: Roll; free: boolean; event: CombatEvent }> {
  const { data, error } = await db().rpc('break_free', { p_combatant_id: combatantId })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; free: boolean; event: Tables<'combat_events'> }
  return { roll: rowToRoll(result.roll), free: result.free, event: rowToEvent(result.event) }
}

// Talk and parley (C3b)

/** Persuade, Intimidate or Deceive with your action: the server throws the check and posts the card. */
export async function talk(
  combatantId: string,
  skill: TalkSkill,
  targetIds: string[],
  words: string,
  request: RollRequest,
): Promise<{ roll: Roll; event: CombatEvent }> {
  const { data, error } = await db().rpc('talk', {
    p_combatant_id: combatantId,
    p_skill: skill,
    p_target_ids: targetIds,
    p_words: words,
    p_roll: requestToJson(request),
  })
  if (error) throw fromServerRule(error)
  const result = data as { roll: Tables<'rolls'>; event: Tables<'combat_events'> }
  return { roll: rowToRoll(result.roll), event: rowToEvent(result.event) }
}

/** The DM's answer to a talk card: It works (and what comes of it), Partly or It doesn't. */
export async function answerTalk(
  eventId: string,
  answer: TalkAnswer,
  outcome: TalkOutcome | null,
): Promise<CombatEvent> {
  const { data, error } = await db().rpc('answer_talk', {
    p_event_id: eventId,
    p_answer: answer,
    p_outcome: outcome as string,
  })
  if (error) throw fromServerRule(error)
  return rowToEvent(data)
}

/** The DM sets a monster's stance: it surrenders, runs, or fights on. */
export async function setStance(combatantId: string, stance: Stance): Promise<CombatEvent> {
  const { data, error } = await db().rpc('set_stance', { p_combatant_id: combatantId, p_stance: stance })
  if (error) throw fromServerRule(error)
  return rowToEvent(data)
}

/** The DM calls a parley (the fight pauses) or goes back to the fight. */
export async function setParley(encounterId: string, on: boolean): Promise<CombatEvent> {
  const { data, error } = await db().rpc('set_parley', { p_encounter_id: encounterId, p_on: on })
  if (error) throw fromServerRule(error)
  return rowToEvent(data)
}
