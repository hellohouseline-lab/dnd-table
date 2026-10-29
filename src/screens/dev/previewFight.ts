// Local development only: a stand-in for a fight in the design previews, with no database. Dice are
// thrown in the browser; attacks, actions, Undo, the turn record, opportunity attacks and death saves
// follow the server's rules (supabase/migrations/20261026050000_turn_loop.sql and
// 20261027030000_reactions_death_saves.sql) closely enough to try the screens.

import { useCallback, useRef, useState } from 'react'
import { localRoll } from '../../dice/localRoll.ts'
import { DEFAULT_DICE_STYLE } from '../../dice/style.ts'
import type { Combatant, CombatantSecret, CombatEvent, ReactionPrompt, Token, TurnAction } from '../../live/combat.ts'
import type { Roll } from '../../live/rolls.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { Character } from '../../rules/character.ts'
import { healthState, letteredNames, nextTurn, unknownNames } from '../../rules/combat.ts'
import { secureDraw } from '../../rules/dice.ts'
import { abilityModifier } from '../../rules/maths/core.ts'
import { takeDamage } from '../../rules/maths/hitPoints.ts'
import { adjustDamage, NO_DEFENCES } from '../../rules/damage.ts'
import { deathSave, hitWhileDown, opportunityThreats } from '../../rules/dying.ts'
import type { NewArea } from '../../live/areas.ts'
import type { Ability } from '../../rules/abilities.ts'
import { freeRoll, savingThrow, skillCheck } from '../../rules/rolls.ts'
import { makeClock, tickEnd, tickStart, type ConditionClock } from '../../rules/conditionClocks.ts'
import { USABLE } from '../../rules/items.ts'
import { concentrationDc, slotsLeft, spellSaveDc } from '../../rules/spells.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { canHear, isOut, type Stance } from '../../rules/talk.ts'
import { portraitForMonster } from '../../live/library.ts'
import {
  attackHits,
  attacksLeft,
  attacksPerAction,
  FRESH_TURN,
  threatReach,
  type TurnRecord,
} from '../../rules/turn.ts'

type Fight = NonNullable<FightControls['fight']>

let made = 0
const stamp = () => new Date(Date.now() + made++).toISOString()

function characterCombatant(character: Character, encounterId: string, initiative: number | null): Combatant {
  return {
    id: `fighter-${character.id}`,
    encounterId,
    campaignId: 'preview',
    kind: 'character',
    characterId: character.id,
    shownName: character.name,
    revealed: true,
    initiative,
    tiebreak: character.scores.dexterity,
    health: 'healthy',
    conditions: [],
    clocks: [],
    stance: 'fighting',
    art: null,
    speed: character.speed,
    reachFt: /glaive|halberd|lance|pike|whip/i.test(JSON.stringify(character.attacks)) ? 10 : 5,
    placed: false,
    turn: FRESH_TURN,
    createdAt: stamp(),
  }
}

/** A fight already going: the party against two goblins, round 1, with one player still to roll. */
export function sampleFight(characters: Character[]): Fight {
  const encounterId = 'preview-fight'
  const combatants: Combatant[] = characters.map((c, i) => characterCombatant(c, encounterId, i === 0 ? 18 : null))
  const secrets: CombatantSecret[] = []
  ;['Goblin A', 'Goblin B'].forEach((name, i) => {
    const id = `goblin-${i + 1}`
    combatants.push({
      id,
      encounterId,
      campaignId: 'preview',
      kind: 'monster',
      characterId: null,
      shownName: i === 0 ? name : `Unknown creature ${i + 1}`,
      revealed: i === 0,
      initiative: i === 0 ? 15 : 9,
      tiebreak: 14,
      health: i === 1 ? 'bloodied' : 'healthy',
      conditions: [],
      clocks: [],
      stance: 'fighting',
      art: 'goblin',
      speed: 30,
      reachFt: 5,
      placed: false,
      turn: FRESH_TURN,
      createdAt: stamp(),
    })
    secrets.push({ combatantId: id, name, monster: 'goblin', hp: i === 1 ? 3 : 7, maxHp: 7, ac: 15, ...NO_DEFENCES })
  })
  return {
    encounter: {
      id: encounterId,
      campaignId: 'preview',
      status: 'active',
      round: 1,
      currentId: combatants[0].id,
      placing: false,
      parley: false,
      startedAt: stamp(),
    },
    combatants,
    secrets,
  }
}

type PreviewOptions = {
  /** The party, for armour class and speed. */
  characters?: Character[]
  /** A character's hit points, conditions or death saves changed (an attack, a save, or Undo). */
  onCharacter?: (id: string, patch: Partial<CharacterState>) => void
  /** Chances to strike already open when the preview starts. */
  prompts?: ReactionPrompt[]
  /** A spell left an area on the map. */
  onArea?: (area: PreviewArea) => void
  /** What has already happened when the preview starts (a talk card waiting for the DM). */
  events?: CombatEvent[]
}

type CharacterState = Pick<
  Character,
  | 'currentHp'
  | 'tempHp'
  | 'conditions'
  | 'deathSaveSuccesses'
  | 'deathSaveFailures'
  | 'stable'
  | 'dead'
  | 'concentration'
  | 'concentrationDc'
  | 'spellcasting'
  | 'inventory'
  | 'effects'
>

const stateOf = (c: Character): CharacterState => ({
  currentHp: c.currentHp,
  tempHp: c.tempHp,
  conditions: c.conditions,
  deathSaveSuccesses: c.deathSaveSuccesses,
  deathSaveFailures: c.deathSaveFailures,
  stable: c.stable,
  dead: c.dead,
  concentration: c.concentration,
  concentrationDc: c.concentrationDc,
  spellcasting: c.spellcasting,
  inventory: c.inventory,
  effects: c.effects,
})

type Undo = {
  target:
    { characterId: string; before: CharacterState } | { secret: CombatantSecret; health: Combatant['health'] } | null
  /** The actor's turn as it was; none for the second and later targets of one spell. */
  actor: { id: string; turn: TurnRecord } | null
  /** A spell's caster: the slot and concentration as they were. */
  caster?: { characterId: string; before: CharacterState }
  /** Talk (C3b): monsters' stances and the parley as they were. */
  stances?: Record<string, Stance>
  parley?: boolean
}

/** A spell's lasting area, or the DM's, for the preview's map. */
export type PreviewArea = NewArea & { characterId: string | null; concentration: boolean }

export type PreviewFightControls = FightControls & {
  /** The miniature of whoever's turn it is moved: count the feet. */
  walk: (combatantId: string, feet: number) => void
  /** A miniature moved on its creature's turn: anyone it left the reach of gets a chance to strike. */
  provoke: (moverId: string, from: Token, to: { x: number; y: number }, tokens: Token[]) => void
}

export function usePreviewFight(start: Fight | null = null, options: PreviewOptions = {}): PreviewFightControls {
  const [fight, setFight] = useState<Fight | null>(start)
  const [events, setEvents] = useState<CombatEvent[]>(options.events ?? [])
  const [prompts, setPrompts] = useState<ReactionPrompt[]>(options.prompts ?? [])
  const latest = useRef({ fight: start, events: options.events ?? [] })
  const undos = useRef(new Map<string, Undo>((options.events ?? []).map((e) => [e.id, { target: null, actor: null }])))
  const { characters = [], onCharacter } = options

  const set = useCallback((change: (f: Fight) => Fight) => {
    const now = latest.current.fight
    if (!now) return
    const next = change(now)
    latest.current.fight = next
    setFight(next)
  }, [])
  const update = (combatant: Combatant, changes: Partial<Combatant>) =>
    set((f) => ({ ...f, combatants: f.combatants.map((c) => (c.id === combatant.id ? { ...c, ...changes } : c)) }))
  const setTurn = (id: string, change: (turn: TurnRecord) => TurnRecord) =>
    set((f) => ({ ...f, combatants: f.combatants.map((c) => (c.id === id ? { ...c, turn: change(c.turn) } : c)) }))

  function post(event: Omit<CombatEvent, 'id' | 'seq' | 'createdAt' | 'undone' | 'encounterId' | 'round'>, undo: Undo) {
    const f = latest.current.fight
    if (!f) return
    made += 1
    const full: CombatEvent = {
      ...event,
      id: `event-${made}`,
      seq: made,
      createdAt: stamp(),
      undone: false,
      encounterId: f.encounter.id,
      round: f.encounter.round,
    }
    undos.current.set(full.id, undo)
    latest.current.events = [...latest.current.events, full]
    setEvents(latest.current.events)
  }

  const speedOf = (combatant: Combatant) =>
    characters.find((c) => c.id === combatant.characterId)?.speed ?? combatant.speed

  // Conditions that wear off (C3a), as the server's put_condition and tick_conditions.
  const conditionsOf = (combatant: Combatant) =>
    characters.find((c) => c.id === combatant.characterId)?.conditions ?? combatant.conditions
  function putCondition(combatant: Combatant, condition: string, on: boolean, clock: ConditionClock | null) {
    const now = latest.current.fight?.combatants.find((c) => c.id === combatant.id) ?? combatant
    const clocks = [...now.clocks.filter((c) => c.condition !== condition), ...(on && clock ? [clock] : [])]
    const before = conditionsOf(now)
    const conditions = on
      ? before.includes(condition)
        ? before
        : [...before, condition]
      : before.filter((c) => c !== condition)
    const character = characters.find((c) => c.id === now.characterId)
    if (character) {
      onCharacter?.(character.id, { conditions })
      update(now, { clocks })
    } else update(now, { clocks, conditions })
  }
  function conditionLine(combatant: Combatant, shown: CombatEvent['shown']) {
    const character = characters.find((c) => c.id === combatant.characterId)
    post(
      { kind: 'condition', actorId: combatant.id, targetId: combatant.id, rollId: null, shown },
      { target: character ? { characterId: character.id, before: stateOf(character) } : null, actor: null },
    )
  }
  // As a turn starts or ends: rounds come off, "until the end of its next turn" ends, saves each turn
  // are rolled for monsters and owed by players.
  function tick(combatantId: string | null, when: 'start' | 'end') {
    const me = latest.current.fight?.combatants.find((c) => c.id === combatantId)
    if (!me || me.clocks.length === 0) return
    const result = when === 'start' ? tickStart(me.clocks) : tickEnd(me.clocks)
    // The preview's monsters have no save bonuses: a plain d20.
    const kept = result.kept.flatMap((clock) => {
      if (!result.saves.includes(clock) || !clock.save) return [clock]
      if (me.kind === 'character') return [{ ...clock, owed: true }]
      const total = secureDraw(20)
      if (total >= (clock.save.dc ?? 10)) {
        result.ended.push(clock)
        conditionLine(me, { condition: clock.condition, ended: 'saved' })
        return []
      }
      conditionLine(me, { condition: clock.condition, still: true })
      return [clock]
    })
    update(me, { clocks: kept })
    for (const clock of result.ended) {
      putCondition({ ...me, clocks: kept }, clock.condition, false, null)
      if (!clock.save || when === 'start' || clock.endOfNextTurn)
        conditionLine(me, { condition: clock.condition, ended: 'time' })
    }
  }

  // An attack, as private.settle_attack: on your turn from your action, or as a reaction.
  // Damage after the target's defences, as private.apply_damage: temporary hit points first, a death
  // save failure for someone already down, and a concentration save for a caster still standing.
  function hurt(target: Combatant, amount: number, type: string, magical: boolean, critical: boolean) {
    const f = latest.current.fight
    const targetCharacter = characters.find((c) => c.id === target.characterId)
    const secret = f?.secrets.find((s) => s.combatantId === target.id)
    const defences = targetCharacter ?? secret ?? NO_DEFENCES
    const { amount: damage, adjust } = adjustDamage(amount, type, magical, defences)
    let undoTarget: Undo['target'] = null
    let down = false
    if (targetCharacter) {
      undoTarget = { characterId: targetCharacter.id, before: stateOf(targetCharacter) }
      const after = takeDamage(
        { current: targetCharacter.currentHp, max: targetCharacter.maxHp, temp: targetCharacter.tempHp },
        damage,
      )
      down = damage > 0 && after.current === 0
      const wasDown = targetCharacter.currentHp === 0
      const saves = {
        successes: targetCharacter.deathSaveSuccesses,
        failures: targetCharacter.deathSaveFailures,
        stable: targetCharacter.stable,
        dead: targetCharacter.dead,
      }
      const hurtSaves = wasDown && damage > 0 ? hitWhileDown(saves, critical) : saves
      const concentrating = targetCharacter.concentration !== null && after.current > 0 && damage > 0
      onCharacter?.(targetCharacter.id, {
        currentHp: after.current,
        tempHp: after.temp,
        conditions:
          down && !targetCharacter.conditions.includes('unconscious')
            ? [...targetCharacter.conditions, 'unconscious']
            : targetCharacter.conditions,
        deathSaveFailures: hurtSaves.failures,
        stable: hurtSaves.stable,
        dead: hurtSaves.dead,
        concentration: after.current === 0 ? null : targetCharacter.concentration,
        concentrationDc: concentrating
          ? Math.max(targetCharacter.concentrationDc ?? 0, concentrationDc(damage))
          : after.current === 0
            ? null
            : targetCharacter.concentrationDc,
      })
    } else if (secret) {
      undoTarget = { secret, health: target.health }
      const hp = Math.max(0, secret.hp - damage)
      down = damage > 0 && hp === 0
      set((fx) => ({
        ...fx,
        secrets: fx.secrets.map((s) => (s.combatantId === secret.combatantId ? { ...s, hp } : s)),
        combatants: fx.combatants.map((c) =>
          c.id === target.id ? { ...c, health: healthState(hp, secret.maxHp) } : c,
        ),
      }))
    }
    return { damage, adjust, down, undoTarget }
  }

  // An attack, as private.settle_attack: on your turn from your action, as a reaction, or (for a
  // spell, which has paid already) spending nothing.
  function settle(
    me: Combatant,
    target: Combatant,
    request: RollRequest,
    spend: 'action' | 'reaction' | 'none',
    spell: { name: string; slot: number; caster: Undo['caster'] } | null = null,
  ): Roll {
    const f = latest.current.fight
    if (!f) throw new Error('No fight')
    const roll = localRoll(request, { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE })
    const targetCharacter = characters.find((c) => c.id === target.characterId)
    const secret = f.secrets.find((s) => s.combatantId === target.id)
    const ac = targetCharacter?.armourClass ?? secret?.ac ?? 10
    const hit = attackHits(roll.natural ?? 0, roll.total, ac)
    const { damage, adjust, down, undoTarget } = hurt(
      target,
      hit ? (roll.damage?.total ?? 0) : 0,
      roll.damage?.type ?? '',
      Boolean(request.magical) || spell !== null,
      hit && roll.natural === 20,
    )
    if (spend !== 'none') {
      setTurn(me.id, (turn) =>
        spend === 'reaction'
          ? { ...turn, reactionUsed: true }
          : { ...turn, actionUsed: true, attacksMade: turn.attacksMade + 1 },
      )
    }
    post(
      {
        kind: spell ? 'spell' : 'attack',
        actorId: me.id,
        targetId: target.id,
        rollId: roll.id,
        shown: {
          // As on the server: a monster's real name stays out of the feed.
          label: me.kind === 'monster' ? (roll.label.split(': ')[1] ?? roll.label) : roll.label,
          hit,
          critical: hit && roll.natural === 20,
          damage,
          damageType: roll.damage?.type ?? '',
          adjust,
          total: me.kind === 'character' ? roll.total : null,
          down: hit && down,
          reaction: spend === 'reaction',
          ...(spell ? { spell: spell.name, slot: spell.slot, attack: true } : {}),
        },
      },
      { target: undoTarget, actor: { id: me.id, turn: me.turn }, caster: spell?.caster },
    )
    return { ...roll, passed: hit, passedByDice: hit }
  }

  // Undo, as undo_event: the newest thing that happened, put back.
  function undoNewest() {
    const newest = [...latest.current.events].reverse().find((e) => !e.undone)
    const saved = newest ? undos.current.get(newest.id) : undefined
    if (!newest || !saved) return
    if (saved.target && 'characterId' in saved.target) onCharacter?.(saved.target.characterId, saved.target.before)
    else if (saved.target) {
      const { secret, health } = saved.target
      set((f) => ({
        ...f,
        secrets: f.secrets.map((s) => (s.combatantId === secret.combatantId ? secret : s)),
        combatants: f.combatants.map((c) => (c.id === secret.combatantId ? { ...c, health } : c)),
      }))
    }
    const actor = saved.actor
    if (actor) setTurn(actor.id, (turn) => ({ ...actor.turn, feetMoved: turn.feetMoved }))
    if (saved.caster) {
      const { spellcasting, concentration } = saved.caster.before
      onCharacter?.(saved.caster.characterId, { spellcasting, concentration })
    }
    const { stances, parley } = saved
    if (stances) {
      set((f) => ({ ...f, combatants: f.combatants.map((c) => (stances[c.id] ? { ...c, stance: stances[c.id] } : c)) }))
    }
    if (parley !== undefined) set((f) => ({ ...f, encounter: { ...f.encounter, parley } }))
    latest.current.events = latest.current.events.map((e) => (e.id === newest.id ? { ...e, undone: true } : e))
    setEvents(latest.current.events)
  }

  // A caster's concentration ending ends the monsters' conditions tied to it (the server's trigger).
  const concentrating = (clock: ConditionClock) =>
    !clock.caster || characters.find((c) => c.id === clock.caster?.characterId)?.concentration === clock.caster.spell
  const held = (c: Combatant) => {
    const lost = c.kind === 'monster' ? c.clocks.filter((clock) => !concentrating(clock)).map((x) => x.condition) : []
    return lost.length === 0
      ? c
      : {
          ...c,
          conditions: c.conditions.filter((x) => !lost.includes(x)),
          clocks: c.clocks.filter((x) => !lost.includes(x.condition)),
        }
  }
  const shownFight = fight && { ...fight, combatants: fight.combatants.map(held) }

  // As end_turn: the next creature's turn.
  function advance() {
    if (latest.current.fight?.encounter.parley) return
    setPrompts([])
    tick(latest.current.fight?.encounter.currentId ?? null, 'end')
    // As end_turn: a monster that's running leaves as its turn comes round, and the turn passes on.
    for (let guard = 0; guard < 100; guard++) {
      set((f) => {
        const entries = f.combatants.map((c) => ({ ...c, out: isOut(c) }))
        const turn = nextTurn(entries, f.encounter.currentId, f.encounter.round)
        return { ...f, encounter: { ...f.encounter, currentId: turn.currentId, round: turn.round } }
      })
      const f = latest.current.fight
      const up = f?.combatants.find((c) => c.id === f.encounter.currentId)
      if (!up || up.stance !== 'running') break
      update(up, { stance: 'fled' })
      post(
        { kind: 'talk', actorId: up.id, targetId: up.id, rollId: null, shown: { stance: 'fled' } },
        { target: null, actor: null, stances: { [up.id]: 'running' } },
      )
    }
    set((f) => ({
      ...f,
      combatants: f.combatants.map((c) => (c.id === f.encounter.currentId ? { ...c, turn: FRESH_TURN } : c)),
    }))
    tick(latest.current.fight?.encounter.currentId ?? null, 'start')
  }

  // As begin_battle: placing ends, and the first turn starts if everyone has initiative.
  function beginBattle() {
    set((f) => ({ ...f, encounter: { ...f.encounter, placing: false } }))
    const f = latest.current.fight
    if (f && f.encounter.currentId === null && f.combatants.every((c) => c.initiative !== null)) advance()
  }

  return {
    fight: shownFight,
    status: 'ready',
    error: null,
    events,
    start: async (party) => {
      const encounterId = `preview-fight-${made}`
      const started: Fight = {
        encounter: {
          id: encounterId,
          campaignId: 'preview',
          status: 'active',
          round: 1,
          currentId: null,
          parley: false,
          placing: true,
          startedAt: stamp(),
        },
        combatants: party.map((c) => characterCombatant(c, encounterId, null)),
        secrets: [],
      }
      latest.current.fight = started
      setFight(started)
      return started
    },
    addCharacters: (party) =>
      set((f) => ({
        ...f,
        combatants: [
          ...f.combatants,
          ...party
            .filter((c) => !f.combatants.some((x) => x.characterId === c.id))
            .map((c) => characterCombatant(c, f.encounter.id, null)),
        ],
      })),
    addMonsters: async (monster, count, known = false) => {
      const now = latest.current.fight
      if (!now) return null
      const shown = unknownNames(
        now.combatants.map((c) => c.shownName),
        count,
      )
      const names = letteredNames(
        monster.name,
        now.secrets.map((s) => s.name),
        count,
      )
      const added: Combatant[] = shown.map((shownName, i) => ({
        id: `monster-${made++}`,
        encounterId: now.encounter.id,
        campaignId: 'preview',
        kind: 'monster',
        characterId: null,
        shownName: known ? names[i] : shownName,
        revealed: known,
        initiative: secureDraw(20) + abilityModifier(monster.scores.dexterity),
        tiebreak: monster.scores.dexterity,
        health: 'healthy',
        conditions: [],
        clocks: [],
        stance: 'fighting',
        art: portraitForMonster(monster.index)?.key ?? null,
        speed: monster.speed,
        reachFt: threatReach(monster.actions),
        placed: false,
        turn: FRESH_TURN,
        createdAt: stamp(),
      }))
      set((f) => ({
        ...f,
        combatants: [...f.combatants, ...added],
        secrets: [
          ...f.secrets,
          ...added.map((c, i) => ({
            combatantId: c.id,
            name: names[i],
            monster: monster.index,
            hp: monster.hp,
            maxHp: monster.hp,
            ac: monster.ac,
            resistances: monster.resistances,
            vulnerabilities: monster.vulnerabilities,
            immunities: monster.immunities,
          })),
        ],
      }))
      return { combatants: added, rolls: [] }
    },
    rollInitiative: async (combatant, request) => {
      update(combatant, { initiative: secureDraw(20) + request.modifier })
      return null
    },
    next: () => {
      // While placing the miniatures, Next turn is Start the battle.
      if (latest.current.fight?.encounter.placing) beginBattle()
      else advance()
    },
    beginBattle: () => beginBattle(),
    setPlaced: (combatant, placed) => update(combatant, { placed }),
    setMonsterHp: (secret, hp) =>
      set((f) => {
        const clamped = Math.max(0, Math.min(secret.maxHp, hp))
        return {
          ...f,
          secrets: f.secrets.map((s) => (s.combatantId === secret.combatantId ? { ...s, hp: clamped } : s)),
          combatants: f.combatants.map((c) =>
            c.id === secret.combatantId ? { ...c, health: healthState(clamped, secret.maxHp) } : c,
          ),
        }
      }),
    reveal: (combatant) =>
      set((f) => {
        const secret = f.secrets.find((s) => s.combatantId === combatant.id)
        return {
          ...f,
          combatants: f.combatants.map((c) =>
            c.id === combatant.id && secret ? { ...c, shownName: secret.name, revealed: true } : c,
          ),
        }
      }),
    setConditions: (combatant, conditions) =>
      update(combatant, { conditions, clocks: combatant.clocks.filter((c) => conditions.includes(c.condition)) }),
    remove: (combatant) => set((f) => ({ ...f, combatants: f.combatants.filter((c) => c.id !== combatant.id) })),
    end: () => {
      latest.current.fight = null
      setFight(null)
    },
    attack: async (attacker, target, request): Promise<Roll> => {
      const f = latest.current.fight
      const me = f?.combatants.find((c) => c.id === attacker.id)
      if (!f || !me) throw new Error('No fight')
      const character = characters.find((c) => c.id === me.characterId)
      const perAction = character ? attacksPerAction(character.className, character.level) : 1
      if (attacksLeft(me.turn, perAction) === 0 && me.kind === 'character') {
        throw new Error('You have used your action this turn.')
      }
      return settle(me, target, request, 'action')
    },
    prompts,
    strike: async (prompt, request) => {
      const f = latest.current.fight
      const me = f?.combatants.find((c) => c.id === prompt.combatantId)
      const target = f?.combatants.find((c) => c.id === prompt.provokerId)
      if (!me || !target) throw new Error('That chance has passed.')
      if (me.turn.reactionUsed && me.kind === 'character') throw new Error('You have used your reaction.')
      setPrompts((list) => list.filter((p) => p.id !== prompt.id))
      return settle(me, target, request, 'reaction')
    },
    letGo: (prompt) => setPrompts((list) => list.filter((p) => p.id !== prompt.id)),
    deathSave: async (combatant) => {
      const character = characters.find((c) => c.id === combatant.characterId)
      if (!character || character.currentHp > 0 || character.stable || character.dead) {
        throw new Error('Only someone dying makes death saves.')
      }
      const me = latest.current.fight?.combatants.find((c) => c.id === combatant.id)
      if (me?.turn.actionUsed) throw new Error('One death save a turn.')
      setTurn(combatant.id, (turn) => ({ ...turn, actionUsed: true }))
      const roll = localRoll(
        {
          label: 'Death saving throw',
          kind: 'save',
          characterId: character.id,
          dice: [{ sides: 20, count: 1 }],
          modifier: 0,
          parts: [],
          mode: 'normal',
          damage: null,
          secret: false,
          requestId: null,
        },
        { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
      )
      const before = stateOf(character)
      const after = deathSave(roll.natural ?? 10, {
        successes: character.deathSaveSuccesses,
        failures: character.deathSaveFailures,
        stable: character.stable,
        dead: character.dead,
      })
      onCharacter?.(character.id, {
        deathSaveSuccesses: after.successes,
        deathSaveFailures: after.failures,
        stable: after.stable,
        dead: after.dead,
        ...(after.result === 'awake'
          ? { currentHp: 1, conditions: character.conditions.filter((c) => c !== 'unconscious') }
          : {}),
      })
      post(
        {
          kind: 'death_save',
          actorId: combatant.id,
          targetId: combatant.id,
          rollId: roll.id,
          shown: {
            result: after.result,
            rolled: roll.natural ?? 0,
            successes: after.successes,
            failures: after.failures,
          },
        },
        { target: { characterId: character.id, before }, actor: { id: combatant.id, turn: combatant.turn } },
      )
      return { ...roll, passed: roll.total >= 10, passedByDice: roll.total >= 10 }
    },
    offhandAttack: async (attacker, target, request): Promise<Roll> => {
      const me = latest.current.fight?.combatants.find((c) => c.id === attacker.id)
      if (!me) throw new Error('No fight')
      if (me.turn.attacksMade === 0) throw new Error('Attack with your main weapon first.')
      if (me.turn.bonusUsed) throw new Error('You have used your bonus action this turn.')
      const roll = settle(me, target, request, 'none')
      setTurn(me.id, (turn) => ({ ...turn, bonusUsed: true }))
      return roll
    },
    act: (combatant, what: TurnAction) => {
      const me = latest.current.fight?.combatants.find((c) => c.id === combatant.id)
      if (!me) return
      const bonus = what === 'bonus' || what.startsWith('bonus_')
      const move = what.replace(/^bonus_/, '')
      setTurn(me.id, (turn) => ({
        ...turn,
        actionUsed: turn.actionUsed || (!bonus && what !== 'reaction'),
        bonusUsed: turn.bonusUsed || bonus,
        reactionUsed: turn.reactionUsed || what === 'reaction',
        extraFeet: turn.extraFeet + (move === 'dash' ? speedOf(me) : 0),
        disengaged: turn.disengaged || move === 'disengage',
        dodging: turn.dodging || move === 'dodge',
      }))
      post(
        { kind: 'action', actorId: me.id, targetId: null, rollId: null, shown: { what } },
        { target: null, actor: { id: me.id, turn: me.turn } },
      )
    },
    applyFeature: async (combatant, name, cost) => {
      const me = latest.current.fight?.combatants.find((c) => c.id === combatant.id)
      if (!me) throw new Error('No fight')
      if (cost === 'bonus' && me.turn.bonusUsed) throw new Error('You have used your bonus action this turn.')
      if (cost === 'action' && (me.turn.actionUsed || me.turn.attacksMade > 0)) {
        throw new Error('You have used your action this turn.')
      }
      if (cost === 'reaction' && me.turn.reactionUsed) throw new Error('You have used your reaction.')
      setTurn(me.id, (turn) => ({
        ...turn,
        actionUsed: cost === 'surge' ? false : turn.actionUsed || cost === 'action',
        attacksMade: cost === 'surge' ? 0 : turn.attacksMade,
        bonusUsed: turn.bonusUsed || cost === 'bonus',
        reactionUsed: turn.reactionUsed || cost === 'reaction',
      }))
      post(
        { kind: 'action', actorId: me.id, targetId: null, rollId: null, shown: { what: cost, feature: name } },
        { target: null, actor: { id: me.id, turn: me.turn } },
      )
      return latest.current.events[latest.current.events.length - 1]
    },
    // As public.use_item: the action, one out of the pack, and what the item does.
    applyItem: async (combatant, itemId, target, request) => {
      const me = latest.current.fight?.combatants.find((c) => c.id === combatant.id)
      if (!me) throw new Error('No fight')
      if (me.turn.actionUsed || me.turn.attacksMade > 0) throw new Error('You have used your action this turn.')
      const character = characters.find((c) => c.id === me.characterId)
      const item = character?.inventory.find((i) => i.id === itemId)
      const use = item?.item ? USABLE[item.item] : undefined
      if (!character || !item || !use) throw new Error('You don’t have that.')
      const other = target && target.id !== me.id ? target : null
      const targetCharacter = characters.find((c) => c.id === (other ?? me).characterId)
      const before = stateOf(character)
      let roll: Roll | null = null
      const shown: CombatEvent['shown'] = { what: 'item', item: item.name }
      if (use.kind === 'throw' && other && request) {
        roll = settle(me, other, { ...request, label: item.name }, 'none')
      } else if (use.kind === 'heal' && targetCharacter) {
        roll = localRoll(
          { ...freeRoll(use.dice ?? [], { modifier: use.bonus ?? 0, characterId: character.id }), label: item.name },
          { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
        )
        onCharacter?.(targetCharacter.id, {
          currentHp: Math.min(targetCharacter.maxHp, targetCharacter.currentHp + roll.total),
        })
        shown.heal = roll.total
      } else if (use.kind === 'stabilise' && targetCharacter) {
        if (targetCharacter.currentHp > 0) throw new Error('A healer’s kit steadies someone at 0 hit points.')
        onCharacter?.(targetCharacter.id, { stable: true })
        shown.stabilised = true
      } else if (use.kind === 'effect' && use.effect) {
        onCharacter?.(character.id, {
          effects: [...character.effects.filter((e) => e.key !== use.effect?.key), use.effect],
        })
      } else if (use.kind === 'other') {
        shown.scattered = true
      }
      onCharacter?.(character.id, {
        inventory: character.inventory.flatMap((i) => {
          if (i.id !== itemId) return [i]
          if (i.uses !== null) return i.uses > 1 ? [{ ...i, uses: i.uses - 1 }] : []
          return i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : []
        }),
      })
      setTurn(me.id, (turn) => ({ ...turn, actionUsed: true }))
      if (use.kind !== 'throw') {
        post(
          { kind: 'action', actorId: me.id, targetId: other?.id ?? null, rollId: roll?.id ?? null, shown },
          { target: { characterId: character.id, before }, actor: { id: me.id, turn: me.turn } },
        )
      }
      return roll
    },
    takeBack: async (event) => {
      const newest = [...latest.current.events].reverse().find((e) => !e.undone)
      if (newest?.id !== event.id) throw new Error('Undo the newer things first.')
      undoNewest()
    },
    undo: () => undoNewest(),
    cast: async (caster, spell, slot, targetIds, roll, area) => {
      const f = latest.current.fight
      const me = f?.combatants.find((c) => c.id === caster.id)
      const character = characters.find((c) => c.id === me?.characterId)
      if (!f || !me || !character) throw new Error('No fight')
      if (spell.cost !== 'reaction' && f.encounter.currentId !== me.id) throw new Error('It isn’t your turn.')
      if (spell.cost === 'action' && (me.turn.actionUsed || me.turn.attacksMade > 0)) {
        throw new Error('You have used your action this turn.')
      }
      if (spell.cost === 'bonus' && me.turn.bonusUsed) throw new Error('You have used your bonus action this turn.')
      if (spell.cost === 'reaction' && me.turn.reactionUsed) throw new Error('You have used your reaction.')
      if (slot > 0 && slotsLeft(character.spellcasting, slot) === 0) throw new Error(`No level ${slot} slots left.`)

      // As cast_spell: spend the turn and the slot, start concentrating, leave the area.
      const casterUndo = { characterId: character.id, before: stateOf(character) }
      const before = { ...me, turn: me.turn }
      setTurn(me.id, (turn) => ({
        ...turn,
        actionUsed: turn.actionUsed || spell.cost === 'action',
        bonusUsed: turn.bonusUsed || spell.cost === 'bonus',
        reactionUsed: turn.reactionUsed || spell.cost === 'reaction',
      }))
      onCharacter?.(character.id, {
        spellcasting: {
          ...character.spellcasting,
          slotsUsed: character.spellcasting.slotsUsed.map((used, i) => (i === slot - 1 ? used + 1 : used)),
        },
        ...(spell.concentration ? { concentration: spell.name, concentrationDc: null } : {}),
      })
      if (area) {
        options.onArea?.({ ...area, label: spell.name, characterId: character.id, concentration: spell.concentration })
      }
      const targets = targetIds.flatMap((id) => f.combatants.filter((c) => c.id === id))

      if (spell.kind === 'attack') {
        if (!targets[0] || !roll || !('kind' in roll)) throw new Error('Pick who the spell is for.')
        return settle(before, targets[0], { ...roll, label: spell.name }, 'none', {
          name: spell.name,
          slot,
          caster: casterUndo,
        })
      }
      if (['damage', 'heal'].includes(spell.kind) && targets.length === 0) throw new Error('Pick who the spell is for.')

      const effect =
        roll && !('kind' in roll) && roll.dice.length > 0
          ? localRoll(
              {
                label: `${spell.name} ${spell.kind === 'heal' ? 'healing' : 'damage'}`,
                kind: 'free',
                characterId: character.id,
                dice: roll.dice,
                modifier: roll.modifier,
                parts: [],
                mode: 'normal',
                damage: null,
                secret: false,
                requestId: null,
              },
              { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
            )
          : null
      const total = Math.max(0, effect?.total ?? 0)
      const dc = spell.kind === 'save' ? spellSaveDc(character) : null
      const actor = { id: me.id, turn: me.turn }
      if (targets.length === 0) {
        post(
          {
            kind: 'spell',
            actorId: me.id,
            targetId: null,
            rollId: effect?.id ?? null,
            shown: { spell: spell.name, slot, dc },
          },
          { target: null, actor, caster: casterUndo },
        )
      }
      targets.forEach((target, i) => {
        const targetCharacter = characters.find((c) => c.id === target.characterId)
        let saveTotal: number | null = null
        let passed: boolean | null = null
        let result: ReturnType<typeof hurt> | null = null
        let healed: Undo['target'] = null
        if (spell.kind === 'save' && spell.save) {
          const bonus = targetCharacter ? savingThrow(targetCharacter, spell.save as Ability).modifier : 0
          const rolled = secureDraw(20) + bonus
          passed = rolled >= (dc ?? 10)
          if (targetCharacter) saveTotal = rolled
          if (total > 0) {
            const amount = !passed ? total : spell.dcSuccess === 'half' ? Math.floor(total / 2) : 0
            result = hurt(target, amount, spell.damageType ?? '', true, false)
          }
        } else if (spell.kind === 'damage') {
          result = hurt(target, total, spell.damageType ?? '', true, false)
        } else if (spell.kind === 'heal' && targetCharacter && !targetCharacter.dead) {
          healed = { characterId: targetCharacter.id, before: stateOf(targetCharacter) }
          const currentHp = Math.min(targetCharacter.maxHp, targetCharacter.currentHp + total)
          onCharacter?.(targetCharacter.id, {
            currentHp,
            ...(targetCharacter.currentHp === 0 && currentHp > 0
              ? {
                  deathSaveSuccesses: 0,
                  deathSaveFailures: 0,
                  stable: false,
                  conditions: targetCharacter.conditions.filter((c) => c !== 'unconscious'),
                }
              : {}),
          })
        }
        post(
          {
            kind: 'spell',
            actorId: me.id,
            targetId: target.id,
            rollId: effect?.id ?? null,
            shown: {
              spell: spell.name,
              slot,
              save: passed === null ? null : passed ? 'passed' : 'failed',
              saveAbility: spell.save ?? null,
              dc,
              saveTotal,
              damage: result?.damage ?? null,
              damageType: result ? (spell.damageType ?? null) : null,
              adjust: result?.adjust ?? null,
              down: result?.down ?? false,
              heal: spell.kind === 'heal' ? total : null,
            },
          },
          {
            target: result?.undoTarget ?? healed,
            actor: i === 0 ? actor : null,
            caster: i === 0 ? casterUndo : undefined,
          },
        )
      })
      return effect
    },
    // As monster_ability: the damage behind the screen, each target's save, full, half or none.
    monsterAbility: async (monster, ability, targetIds, roll) => {
      const f = latest.current.fight
      const me = f?.combatants.find((c) => c.id === monster.id)
      if (!f || !me) throw new Error('No fight')
      const targets = targetIds.flatMap((id) => f.combatants.filter((c) => c.id === id))
      if (targets.length === 0) throw new Error('Pick who it catches.')
      setTurn(me.id, (turn) => ({
        ...turn,
        actionUsed: turn.actionUsed || ability.cost === 'action',
        bonusUsed: turn.bonusUsed || ability.cost === 'bonus',
        reactionUsed: turn.reactionUsed || ability.cost === 'reaction',
      }))
      const effect =
        roll && roll.dice.length > 0
          ? localRoll(
              {
                label: `${ability.name} damage`,
                kind: 'free',
                characterId: null,
                dice: roll.dice,
                modifier: roll.modifier,
                parts: [],
                mode: 'normal',
                damage: null,
                secret: true,
                requestId: null,
              },
              { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
            )
          : null
      const total = Math.max(0, effect?.total ?? 0)
      const actor = { id: me.id, turn: me.turn }
      targets.forEach((target, i) => {
        const targetCharacter = characters.find((c) => c.id === target.characterId)
        const bonus = targetCharacter ? savingThrow(targetCharacter, ability.save as Ability).modifier : 0
        const rolled = secureDraw(20) + bonus
        const passed = rolled >= ability.dc
        const amount = !passed ? total : ability.dcSuccess === 'half' ? Math.floor(total / 2) : 0
        const result = total > 0 ? hurt(target, amount, ability.damageType, false, false) : null
        post(
          {
            kind: 'spell',
            actorId: me.id,
            targetId: target.id,
            rollId: effect?.id ?? null,
            shown: {
              spell: ability.name,
              monster: true,
              save: passed ? 'passed' : 'failed',
              saveAbility: ability.save,
              saveTotal: targetCharacter ? rolled : null,
              damage: result?.damage ?? null,
              damageType: result ? ability.damageType : null,
              adjust: result?.adjust ?? null,
              down: result?.down ?? false,
            },
          },
          { target: result?.undoTarget ?? null, actor: i === 0 ? actor : null },
        )
      })
      return effect
    },
    concentrationSave: async (characterId) => {
      const character = characters.find((c) => c.id === characterId)
      if (!character?.concentration || character.concentrationDc === null) {
        throw new Error('There’s no concentration save to make.')
      }
      const request = savingThrow(character, 'constitution')
      const roll = localRoll(
        { ...request, label: `Constitution save: keep concentrating on ${character.concentration}` },
        { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
      )
      const kept = roll.total >= character.concentrationDc
      onCharacter?.(character.id, kept ? { concentrationDc: null } : { concentration: null, concentrationDc: null })
      const me = latest.current.fight?.combatants.find((c) => c.characterId === character.id)
      if (me) {
        post(
          {
            kind: 'concentration',
            actorId: me.id,
            targetId: me.id,
            rollId: roll.id,
            shown: { spell: character.concentration, dc: character.concentrationDc, total: roll.total, kept },
          },
          { target: { characterId: character.id, before: stateOf(character) }, actor: null },
        )
      }
      return { ...roll, passed: kept, passedByDice: kept }
    },
    setCondition: async (combatant, condition, on, choice, resist = null) => {
      const character = characters.find((c) => c.id === combatant.characterId)
      let roll: Roll | null = null
      let resisted = false
      if (on && resist) {
        const request = character ? savingThrow(character, resist.ability) : freeRoll([{ sides: 20, count: 1 }])
        roll = localRoll(
          { ...request, kind: 'save', label: `${resist.ability} save` },
          { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
        )
        resisted = roll.total >= resist.dc
      }
      const clock = on && choice ? makeClock(condition, choice) : null
      if (!resisted) putCondition(combatant, condition, on, clock)
      conditionLine(combatant, {
        condition,
        on,
        ...(resist ? { resisted, saveAbility: resist.ability } : {}),
        ...(clock?.rounds ? { rounds: clock.rounds } : {}),
        ...(clock?.endOfNextTurn ? { endOfNextTurn: true } : {}),
        ...(clock?.save ? { saveEachTurn: clock.save.ability } : {}),
        ...(clock?.caster ? { spell: clock.caster.spell } : {}),
      })
      return { resisted, roll }
    },
    conditionSave: async (combatant, condition) => {
      const character = characters.find((c) => c.id === combatant.characterId)
      const clock = combatant.clocks.find((c) => c.condition === condition && c.owed && c.save)
      if (!character || !clock?.save) throw new Error('There’s no save to make.')
      const roll = localRoll(
        { ...savingThrow(character, clock.save.ability), label: `Save to shake off ${condition}` },
        { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
      )
      const saved = roll.total >= (clock.save.dc ?? 10)
      if (saved) putCondition(combatant, condition, false, null)
      else update(combatant, { clocks: combatant.clocks.map((c) => (c === clock ? { ...c, owed: false } : c)) })
      conditionLine(combatant, { condition, saved, saveAbility: clock.save.ability, total: roll.total })
      return { ...roll, passed: saved, passedByDice: saved }
    },
    standUp: async (combatant) => {
      if (!conditionsOf(combatant).includes('prone')) throw new Error('You aren’t lying down.')
      const half = Math.ceil(speedOf(combatant) / 2)
      setTurn(combatant.id, (turn) => ({ ...turn, feetMoved: turn.feetMoved + half }))
      putCondition(combatant, 'prone', false, null)
      conditionLine(combatant, { condition: 'prone', stood: true, feet: half })
    },
    breakFree: async (combatant) => {
      const character = characters.find((c) => c.id === combatant.characterId)
      const holds = combatant.clocks.filter(
        (c) => ['grappled', 'restrained'].includes(c.condition) && c.escapeDc !== null,
      )
      if (!character || holds.length === 0) throw new Error('There’s nothing to break free from.')
      const dc = Math.max(...holds.map((c) => c.escapeDc ?? 0))
      const best = [skillCheck(character, 'athletics'), skillCheck(character, 'acrobatics')].sort(
        (a, b) => b.modifier - a.modifier,
      )[0]
      const roll = localRoll(
        { ...best, label: 'Break free (Athletics or Acrobatics)' },
        { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE },
      )
      const free = roll.total >= dc
      setTurn(combatant.id, (turn) => ({ ...turn, actionUsed: true }))
      if (free) for (const hold of holds) putCondition(combatant, hold.condition, false, null)
      conditionLine(combatant, { condition: 'grappled', brokeFree: free, total: roll.total })
      return { ...roll, passed: free, passedByDice: free }
    },
    talk: async (combatant, skill, targetIds, words, request) => {
      const f = latest.current.fight
      const me = f?.combatants.find((c) => c.id === combatant.id)
      if (!f || !me) throw new Error('That fight is over.')
      if (f.encounter.currentId !== me.id) throw new Error('It isn’t your turn.')
      if (me.turn.actionUsed || me.turn.attacksMade > 0) throw new Error('You have used your action this turn.')
      const targets = f.combatants.filter((c) => targetIds.includes(c.id) && canHear(c)).map((c) => c.id)
      if (targets.length === 0) throw new Error('Pick who you’re talking to.')
      const roll = localRoll(request, { campaignId: 'preview', rollerId: 'preview', style: DEFAULT_DICE_STYLE })
      setTurn(me.id, (turn) => ({ ...turn, actionUsed: true }))
      post(
        {
          kind: 'talk',
          actorId: me.id,
          targetId: targets.length === 1 ? targets[0] : null,
          rollId: null,
          shown: { talk: skill, targets, words: words.trim().slice(0, 200) || null, total: roll.total },
        },
        { target: null, actor: { id: me.id, turn: me.turn } },
      )
      return roll
    },
    answerTalk: (event, answer, outcome) => {
      const f = latest.current.fight
      if (!f) return
      const targets = f.combatants.filter((c) => event.shown.targets?.includes(c.id) && canHear(c))
      const stances = Object.fromEntries(targets.map((c) => [c.id, c.stance]))
      const result = answer === 'works' ? (outcome ?? 'words') : null
      if (result === 'surrender' || result === 'run') {
        const stance: Stance = result === 'surrender' ? 'surrendered' : 'running'
        set((g) => ({
          ...g,
          combatants: g.combatants.map((c) =>
            targets.some((t) => t.id === c.id) && (stance === 'surrendered' || c.stance === 'fighting')
              ? { ...c, stance }
              : c,
          ),
        }))
      }
      if (result === 'parley') set((g) => ({ ...g, encounter: { ...g.encounter, parley: true } }))
      post(
        {
          kind: 'talk',
          actorId: event.actorId,
          targetId: null,
          rollId: null,
          shown: { answerTo: event.id, answer, outcome: result, targets: targets.map((c) => c.id) },
        },
        { target: null, actor: null, stances, parley: f.encounter.parley },
      )
    },
    setStance: (combatant, stance) => {
      update(combatant, { stance })
      post(
        { kind: 'talk', actorId: combatant.id, targetId: combatant.id, rollId: null, shown: { stance } },
        { target: null, actor: null, stances: { [combatant.id]: combatant.stance } },
      )
    },
    setParley: (on) => {
      const f = latest.current.fight
      if (!f || f.encounter.parley === on) return
      set((g) => ({ ...g, encounter: { ...g.encounter, parley: on } }))
      post(
        { kind: 'talk', actorId: null, targetId: null, rollId: null, shown: { parley: on } },
        { target: null, actor: null, parley: f.encounter.parley },
      )
    },
    walk: (combatantId, feet) => setTurn(combatantId, (turn) => ({ ...turn, feetMoved: turn.feetMoved + feet })),
    provoke: (moverId, from, to, tokens) => {
      const f = latest.current.fight
      const mover = f?.combatants.find((c) => c.id === moverId)
      if (!f || !mover) return
      const threats = f.combatants.flatMap((c) => {
        const token = tokens.find((t) => (c.characterId ? t.characterId === c.characterId : t.combatantId === c.id))
        const character = characters.find((ch) => ch.id === c.characterId)
        if (!token || c.initiative === null) return []
        return [
          {
            id: c.id,
            side: c.kind,
            x: token.x,
            y: token.y,
            reachFt: c.reachFt,
            reactionUsed: c.turn.reactionUsed,
            down: character ? character.currentHp === 0 : c.health === 'down',
            conditions: character?.conditions ?? c.conditions,
          },
        ]
      })
      const chances = opportunityThreats({ side: mover.kind, disengaged: mover.turn.disengaged }, from, to, threats)
      setPrompts((list) => [
        ...list,
        ...chances
          .filter((id) => !list.some((p) => p.combatantId === id && p.provokerId === moverId))
          .map((id) => ({
            id: `prompt-${made++}`,
            encounterId: f.encounter.id,
            combatantId: id,
            provokerId: moverId,
            status: 'open' as const,
            createdAt: stamp(),
          })),
      ])
    },
  }
}
