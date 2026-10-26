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
import { savingThrow } from '../../rules/rolls.ts'
import { concentrationDc, slotsLeft, spellSaveDc } from '../../rules/spells.ts'
import type { RollRequest } from '../../rules/dice.ts'
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
    speed: character.speed,
    reachFt: /glaive|halberd|lance|pike|whip/i.test(JSON.stringify(character.attacks)) ? 10 : 5,
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
      speed: 30,
      reachFt: 5,
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
})

type Undo = {
  target:
    { characterId: string; before: CharacterState } | { secret: CombatantSecret; health: Combatant['health'] } | null
  /** The actor's turn as it was; none for the second and later targets of one spell. */
  actor: { id: string; turn: TurnRecord } | null
  /** A spell's caster: the slot and concentration as they were. */
  caster?: { characterId: string; before: CharacterState }
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
  const [events, setEvents] = useState<CombatEvent[]>([])
  const [prompts, setPrompts] = useState<ReactionPrompt[]>(options.prompts ?? [])
  const latest = useRef({ fight: start, events: [] as CombatEvent[] })
  const undos = useRef(new Map<string, Undo>())
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

  return {
    fight,
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
          startedAt: stamp(),
        },
        combatants: party.map((c) => characterCombatant(c, encounterId, null)),
        secrets: [],
      }
      latest.current.fight = started
      setFight(started)
      return started
    },
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
        speed: monster.speed,
        reachFt: threatReach(monster.actions),
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
      setPrompts([])
      set((f) => {
        const entries = f.combatants.map((c) => ({ ...c, out: c.kind === 'monster' && c.health === 'down' }))
        const turn = nextTurn(entries, f.encounter.currentId, f.encounter.round)
        return {
          ...f,
          encounter: { ...f.encounter, currentId: turn.currentId, round: turn.round },
          combatants: f.combatants.map((c) => (c.id === turn.currentId ? { ...c, turn: FRESH_TURN } : c)),
        }
      })
    },
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
    setConditions: (combatant, conditions) => update(combatant, { conditions }),
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
    act: (combatant, what: TurnAction) => {
      const me = latest.current.fight?.combatants.find((c) => c.id === combatant.id)
      if (!me) return
      setTurn(me.id, (turn) => ({
        ...turn,
        actionUsed: turn.actionUsed || ['action', 'dash', 'disengage', 'dodge'].includes(what),
        bonusUsed: turn.bonusUsed || what === 'bonus',
        reactionUsed: turn.reactionUsed || what === 'reaction',
        extraFeet: turn.extraFeet + (what === 'dash' ? speedOf(me) : 0),
        disengaged: turn.disengaged || what === 'disengage',
        dodging: turn.dodging || what === 'dodge',
      }))
      post(
        { kind: 'action', actorId: me.id, targetId: null, rollId: null, shown: { what } },
        { target: null, actor: { id: me.id, turn: me.turn } },
      )
    },
    undo: () => {
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
      latest.current.events = latest.current.events.map((e) => (e.id === newest.id ? { ...e, undone: true } : e))
      setEvents(latest.current.events)
    },
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
