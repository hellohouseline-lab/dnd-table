import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../rules/character.ts'
import { nextTurn, type HealthState } from '../rules/combat.ts'
import type { RollRequest } from '../rules/dice.ts'
import type { SrdMonster } from '../rules/srd/index.ts'
import {
  broadcastPointer,
  useCatchUp,
  usePointerBroadcasts,
  useTableChanges,
  type MapPointer,
  type RowChange,
} from './campaignChannel.ts'
import {
  addMonsters,
  endFight,
  getActiveFight,
  castSpell,
  beginBattle as beginBattleNow,
  setPlaced as setPlacedNow,
  sendMonsterAbility,
  type MonsterAbilityUse,
  offhandAttack,
  listEvents,
  listPrompts,
  rollConcentrationSave,
  featureInFight,
  opportunityAttack,
  passReaction,
  resolveAttack,
  rollDeathSave,
  rowToPrompt,
  rowToEvent,
  spendAction,
  undoEvent,
  listTokens,
  moveToken,
  placeTokens,
  removeCombatant,
  removeToken,
  rollInitiative,
  rowToCombatant,
  rowToEncounter,
  rowToToken,
  setMonsterHp,
  setTokenHidden,
  endTurn,
  startFight,
  updateCombatant,
  type Combatant,
  type CombatantSecret,
  type CombatEvent,
  type FightState,
  type ReactionPrompt,
  type SpellCast,
  type TurnAction,
  type NewToken,
  type Token,
  itemInFight,
  setCondition as putCondition,
  conditionSave as rollConditionSave,
  standUp as standUpNow,
  breakFree as breakFreeNow,
  talk as talkNow,
  joinFight,
  answerTalk as answerTalkNow,
  setStance as setStanceNow,
  setParley as setParleyNow,
} from './combat.ts'
import { messageFor } from './errors.ts'
import type { Roll } from './rolls.ts'
import type { FeatureCost } from '../rules/features.ts'
import type { BonusAttackKind } from '../rules/bonusActions.ts'
import type { Ability } from '../rules/abilities.ts'
import type { ClockChoice } from '../rules/conditionClocks.ts'
import { isOut, type Stance, type TalkAnswer, type TalkOutcome, type TalkSkill } from '../rules/talk.ts'

type Fight = NonNullable<FightState>

export type FightControls = {
  fight: Fight | null
  status: 'loading' | 'ready'
  error: string | null
  /** DM: starts a fight with these characters, with this battle map on stage (or none). */
  start: (characters: Character[], mapId: string | null) => Promise<Fight | null>
  /** DM: adds monsters of one kind, each rolling initiative behind the screen; `known` shows players their names. */
  addMonsters: (
    monster: SrdMonster,
    count: number,
    known?: boolean,
  ) => Promise<{ combatants: Combatant[]; rolls: Roll[] } | null>
  /** DM: adds characters to a fight that's already going; they roll initiative like everyone else. */
  addCharacters: (characters: Character[]) => void
  /** Rolls initiative for a combatant (players their own; the DM anyone). */
  rollInitiative: (combatant: Combatant, request: RollRequest) => Promise<Roll | null>
  next: () => void
  setMonsterHp: (secret: CombatantSecret, hp: number) => void
  reveal: (combatant: Combatant) => void
  setConditions: (combatant: Combatant, conditions: string[]) => void
  remove: (combatant: Combatant) => void
  end: () => void
  /** What has happened in this fight, oldest first. */
  events: CombatEvent[]
  /**
   * Settles an attack on the server against the target's armour class and takes the damage off.
   * Resolves with the roll, to be shown with the dice; throws in plain words if it's refused.
   */
  attack: (attacker: Combatant, target: Combatant, request: RollRequest) => Promise<Roll>
  /** Two-weapon fighting: the off-hand attack, for the bonus action. Throws in plain words if refused. */
  /** An attack with the bonus action: off hand by default, or a monk's strike or a frenzy. */
  offhandAttack: (attacker: Combatant, target: Combatant, request: RollRequest, kind?: BonusAttackKind) => Promise<Roll>
  /** Spends part of a turn: Dash, Disengage, Dodge, or the action, bonus action or reaction. */
  act: (combatant: Combatant, what: TurnAction) => void
  /** DM: takes back the newest thing that happened. */
  undo: () => void
  /** Chances to strike someone moving away (players see only their side's). */
  prompts: ReactionPrompt[]
  /** Takes a chance: an opportunity attack with the reaction. Throws in plain words if refused. */
  strike: (prompt: ReactionPrompt, request: RollRequest) => Promise<Roll>
  /** Lets a chance go. */
  letGo: (prompt: ReactionPrompt) => void
  /** Rolls a death save for a character at 0 hit points. Throws in plain words if it's refused. */
  deathSave: (combatant: Combatant) => Promise<Roll>
  /**
   * Casts a spell on the server against these targets (or everyone in its area), leaving a lasting
   * area on the map if given. Resolves with the roll to show with the dice (none for Bless); throws
   * in plain words if it's refused.
   */
  cast: (
    caster: Combatant,
    spell: SpellCast,
    slot: number,
    targetIds: string[],
    roll: Parameters<typeof castSpell>[4],
    area: Parameters<typeof castSpell>[5],
  ) => Promise<Roll | null>
  /**
   * The DM uses a monster's ability with a save on these targets (P1c). Resolves with its damage
   * roll, if it has one, to show with the dice; throws in plain words if it's refused.
   */
  monsterAbility: (
    monster: Combatant,
    ability: MonsterAbilityUse,
    targetIds: string[],
    roll: Parameters<typeof sendMonsterAbility>[3],
  ) => Promise<Roll | null>
  /** Placing the miniatures before the fight: ends it, and the first turn starts once everyone has initiative. */
  beginBattle: () => void
  /** I'm in place (or not yet), before the fight starts. */
  setPlaced: (combatant: Combatant, placed: boolean) => void
  /** The Constitution save to keep concentrating after taking damage. Throws in plain words if refused. */
  concentrationSave: (characterId: string) => Promise<Roll>
  /** Uses a feature (Rage): spends its part of the turn, named in the feed. Throws in plain words if refused. */
  applyFeature: (combatant: Combatant, name: string, cost: FeatureCost) => Promise<CombatEvent>
  /** Uses an item from the pack (a potion, a kit, a flask): the action, and one out of the inventory. */
  applyItem: (
    combatant: Combatant,
    itemId: string,
    target: Combatant | null,
    request: RollRequest | null,
  ) => Promise<Roll | null>
  /** Takes back one thing that happened: a player their own newest action, the DM anything newest first. */
  takeBack: (event: CombatEvent) => Promise<void>
  /**
   * DM: puts a condition on with how long it lasts (null: until taken off), or takes it off. With
   * `resist`, the creature first makes that save. Resolves with whether it was resisted; throws in
   * plain words if refused.
   */
  setCondition: (
    combatant: Combatant,
    condition: string,
    on: boolean,
    choice: ClockChoice | null,
    resist?: { ability: Ability; dc: number } | null,
  ) => Promise<{ resisted: boolean; roll: Roll | null }>
  /** A player's save each turn to shake off a condition. Throws in plain words if refused. */
  conditionSave: (combatant: Combatant, condition: string) => Promise<Roll>
  /** Stands up from prone for half your speed. Throws in plain words if refused. */
  standUp: (combatant: Combatant) => Promise<void>
  /** Breaks free of a grab or a web with your action. Throws in plain words if refused. */
  breakFree: (combatant: Combatant) => Promise<Roll>
  /** Persuade, Intimidate or Deceive with your action (C3b). Throws in plain words if refused. */
  talk: (
    combatant: Combatant,
    skill: TalkSkill,
    targetIds: string[],
    words: string,
    request: RollRequest,
  ) => Promise<Roll>
  /** DM: answers a talk card. */
  answerTalk: (event: CombatEvent, answer: TalkAnswer, outcome: TalkOutcome | null) => void
  /** DM: a monster surrenders, runs, or fights on. */
  setStance: (combatant: Combatant, stance: Stance) => void
  /** DM: calls a parley (the fight pauses) or goes back to the fight. */
  setParley: (on: boolean) => void
}

/** How long a burst of fight changes must be quiet before the whole fight is loaded again. */
const RELOAD_AFTER_MS = 300

function withRow<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

/** The fight at this table, kept up to date live, with what the DM can do. */
export function useFight(campaignId: string, userId: string): FightControls {
  const [fight, setFight] = useState<Fight | null>(null)
  const [events, setEvents] = useState<CombatEvent[]>([])
  const [prompts, setPrompts] = useState<ReactionPrompt[]>([])
  const [status, setStatus] = useState<FightControls['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const current = useRef<Fight | null>(null)

  useEffect(() => {
    current.current = fight
  }, [fight])

  // Only the newest load counts, so a slow one can't put back an older fight.
  const loads = useRef(0)
  const reload = useCallback(() => {
    loads.current += 1
    const load = loads.current
    getActiveFight(campaignId).then(
      (loaded) => {
        if (load !== loads.current) return
        current.current = loaded
        setFight(loaded)
        setStatus('ready')
        if (!loaded) {
          setEvents([])
          setPrompts([])
        } else {
          listEvents(loaded.encounter.id).then(
            (list) => load === loads.current && setEvents(list),
            () => undefined,
          )
          listPrompts(loaded.encounter.id).then(
            (list) => load === loads.current && setPrompts(list),
            () => undefined,
          )
        }
      },
      (caught: unknown) => {
        if (load !== loads.current) return
        setError(messageFor(caught))
        setStatus('ready')
      },
    )
  }, [campaignId])

  useEffect(reload, [reload])
  useCatchUp(campaignId, userId, reload)

  // A fight arrives as a burst of changes: the fight, then everyone in it, then each monster and its
  // initiative. Rather than piece that together (and drop whatever arrives while a load is under way),
  // load the whole fight once the burst settles. That also brings the DM's other screen each new
  // monster's real name, which isn't sent live.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reloadSoon = useCallback(() => {
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(reload, RELOAD_AFTER_MS)
  }, [reload])
  useEffect(() => () => clearTimeout(reloadTimer.current), [])

  const onEncounter = useCallback(
    (change: RowChange<'encounters'>) => {
      if (change.type === 'delete') return
      const encounter = rowToEncounter(change.row)
      if (current.current?.encounter.id !== encounter.id) {
        if (encounter.status !== 'ended') reloadSoon()
      } else if (encounter.status === 'ended') {
        current.current = null
        setFight(null)
      } else {
        setFight((now) => (now && now.encounter.id === encounter.id ? { ...now, encounter } : now))
      }
    },
    [reloadSoon],
  )
  useTableChanges(campaignId, userId, 'encounters', onEncounter)

  const onCombatant = useCallback(
    (change: RowChange<'combatants'>) => {
      if (change.type === 'delete') {
        setFight((now) => (now ? { ...now, combatants: now.combatants.filter((c) => c.id !== change.id) } : now))
        return
      }
      const combatant = rowToCombatant(change.row)
      const now = current.current
      if (!now || now.encounter.id !== combatant.encounterId) {
        reloadSoon()
        return
      }
      if (combatant.kind === 'monster' && !now.combatants.some((c) => c.id === combatant.id)) reloadSoon()
      setFight((latest) =>
        latest && latest.encounter.id === combatant.encounterId
          ? { ...latest, combatants: withRow(latest.combatants, combatant) }
          : latest,
      )
    },
    [reloadSoon],
  )
  useTableChanges(campaignId, userId, 'combatants', onCombatant)

  // The feed. Each event changed someone's hit points or turn too (and, for the DM, a monster's
  // secret hit points, which aren't sent live), so the whole fight is loaded again once things settle.
  const onEvent = useCallback(
    (change: RowChange<'combat_events'>) => {
      if (change.type === 'delete') return
      const event = rowToEvent(change.row)
      if (current.current?.encounter.id !== event.encounterId) return
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reloadSoon()
    },
    [reloadSoon],
  )
  useTableChanges(campaignId, userId, 'combat_events', onEvent)

  // Chances to strike arrive as someone moves away, and close when taken, let go or the turn ends.
  const onPrompt = useCallback((change: RowChange<'reaction_prompts'>) => {
    if (change.type === 'delete') {
      setPrompts((list) => list.filter((p) => p.id !== change.id))
      return
    }
    const prompt = rowToPrompt(change.row)
    if (current.current?.encounter.id !== prompt.encounterId) return
    setPrompts((list) => (prompt.status === 'open' ? withRow(list, prompt) : list.filter((p) => p.id !== prompt.id)))
  }, [])
  useTableChanges(campaignId, userId, 'reaction_prompts', onPrompt)

  const attempt = useCallback(async <T>(work: () => Promise<T>): Promise<T | null> => {
    setError(null)
    try {
      return await work()
    } catch (caught) {
      setError(messageFor(caught))
      return null
    }
  }, [])

  // Changes the fight on screen at once. The ref changes straight away too, so actions taken one
  // after another (starting a fight, then adding monsters) each see the last one's result.
  const patchLocal = useCallback((patch: (fight: Fight) => Fight) => {
    if (current.current) current.current = patch(current.current)
    setFight((now) => (now ? patch(now) : now))
  }, [])

  const start = useCallback(
    async (characters: Character[], mapId: string | null) => {
      const started = await attempt(() => startFight(campaignId, characters, mapId))
      if (started) {
        current.current = started
        setFight(started)
        setEvents([])
      }
      return started
    },
    [attempt, campaignId],
  )

  const addMonstersTo = useCallback(
    async (monster: SrdMonster, count: number, known = false) => {
      const now = current.current
      if (!now) return null
      const added = await attempt(() => addMonsters(now.encounter, monster, count, now, known))
      if (added) {
        patchLocal((f) => ({
          ...f,
          combatants: added.combatants.reduce(withRow, f.combatants),
          secrets: [...f.secrets, ...added.secrets],
        }))
      }
      return added
    },
    [attempt, patchLocal],
  )

  const addCharacters = useCallback(
    (characters: Character[]) => {
      const now = current.current
      if (!now || characters.length === 0) return
      void attempt(() =>
        joinFight(
          now.encounter.id,
          characters.map((c) => c.id),
        ),
      ).then(() => reload())
    },
    [attempt, reload],
  )

  const rollFor = useCallback(
    async (combatant: Combatant, request: RollRequest) => {
      const roll = await attempt(() => rollInitiative(combatant.id, request))
      if (roll) {
        patchLocal((f) => ({
          ...f,
          combatants: f.combatants.map((c) => (c.id === combatant.id ? { ...c, initiative: roll.total } : c)),
        }))
      }
      return roll
    },
    [attempt, patchLocal],
  )

  // Moves on at once on screen; the server has the final word on whose turn it is.
  // Start the battle: placing ends, and the first turn starts if everyone has initiative.
  const beginBattle = useCallback(() => {
    const now = current.current
    if (!now) return
    patchLocal((f) => ({ ...f, encounter: { ...f.encounter, placing: false } }))
    void attempt(async () => {
      const encounter = await beginBattleNow(now.encounter.id)
      patchLocal((f) => (f.encounter.id === encounter.id ? { ...f, encounter } : f))
      return true
    }).then(() => reload())
  }, [attempt, patchLocal, reload])

  const setPlaced = useCallback(
    (combatant: Combatant, placed: boolean) => {
      patchLocal((f) => ({
        ...f,
        combatants: f.combatants.map((c) => (c.id === combatant.id ? { ...c, placed } : c)),
      }))
      void attempt(async () => {
        await setPlacedNow(combatant.id, placed)
        return true
      }).then((done) => {
        if (!done) reload()
      })
    },
    [attempt, patchLocal, reload],
  )

  const next = useCallback(() => {
    const now = current.current
    if (!now) return
    // While placing the miniatures, Next turn is Start the battle.
    if (now.encounter.placing) {
      beginBattle()
      return
    }
    const entries = now.combatants.map((c) => ({ ...c, out: isOut(c) }))
    const turn = nextTurn(entries, now.encounter.currentId, now.encounter.round)
    // In a parley the server refuses, and says why.
    if (!now.encounter.parley) {
      patchLocal((f) => ({ ...f, encounter: { ...f.encounter, currentId: turn.currentId, round: turn.round } }))
    }
    void attempt(async () => {
      const encounter = await endTurn(now.encounter.id)
      patchLocal((f) => (f.encounter.id === encounter.id ? { ...f, encounter } : f))
      return true
    }).then((ended) => {
      // Refused (it wasn't your turn after all): show whose turn the server says it is.
      if (!ended) reload()
    })
  }, [attempt, beginBattle, patchLocal, reload])

  const setHp = useCallback(
    (secret: CombatantSecret, hp: number) => {
      const clamped = Math.max(0, Math.min(secret.maxHp, hp))
      patchLocal((f) => ({
        ...f,
        secrets: f.secrets.map((s) => (s.combatantId === secret.combatantId ? { ...s, hp: clamped } : s)),
      }))
      void attempt(() => setMonsterHp(secret, clamped))
    },
    [attempt, patchLocal],
  )

  const update = useCallback(
    (combatant: Combatant, patch: Partial<Combatant>) => {
      patchLocal((f) => ({
        ...f,
        combatants: f.combatants.map((c) => (c.id === combatant.id ? { ...c, ...patch } : c)),
      }))
      void attempt(() => updateCombatant(combatant.id, patch))
    },
    [attempt, patchLocal],
  )

  const reveal = useCallback(
    (combatant: Combatant) => {
      const secret = current.current?.secrets.find((s) => s.combatantId === combatant.id)
      if (secret) update(combatant, { shownName: secret.name, revealed: true })
    },
    [update],
  )

  const setConditions = useCallback(
    (combatant: Combatant, conditions: string[]) => update(combatant, { conditions }),
    [update],
  )

  const remove = useCallback(
    (combatant: Combatant) => {
      patchLocal((f) => ({ ...f, combatants: f.combatants.filter((c) => c.id !== combatant.id) }))
      void attempt(() => removeCombatant(combatant.id))
    },
    [attempt, patchLocal],
  )

  const end = useCallback(() => {
    const now = current.current
    if (!now) return
    setFight(null)
    void attempt(() => endFight(now.encounter))
  }, [attempt])

  const attack = useCallback(
    async (attacker: Combatant, target: Combatant, request: RollRequest) => {
      setError(null)
      const { roll, event } = await resolveAttack(attacker.id, target.id, request)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const offhand = useCallback(
    async (attacker: Combatant, target: Combatant, request: RollRequest, kind?: BonusAttackKind) => {
      setError(null)
      const { roll, event } = await offhandAttack(attacker.id, target.id, request, kind)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const act = useCallback(
    (combatant: Combatant, what: TurnAction) => {
      void attempt(() => spendAction(combatant.id, what)).then((event) => {
        if (event) setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
        reload()
      })
    },
    [attempt, reload],
  )

  const strike = useCallback(
    async (prompt: ReactionPrompt, request: RollRequest) => {
      setError(null)
      const { roll, event } = await opportunityAttack(prompt.id, request)
      setPrompts((list) => list.filter((p) => p.id !== prompt.id))
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const letGo = useCallback(
    (prompt: ReactionPrompt) => {
      setPrompts((list) => list.filter((p) => p.id !== prompt.id))
      void attempt(() => passReaction(prompt.id)).then((done) => {
        if (done === null) reload()
      })
    },
    [attempt, reload],
  )

  const deathSave = useCallback(
    async (combatant: Combatant) => {
      setError(null)
      const { roll, event } = await rollDeathSave(combatant.id)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const cast = useCallback(
    async (
      caster: Combatant,
      spell: SpellCast,
      slot: number,
      targetIds: string[],
      roll: Parameters<typeof castSpell>[4],
      area: Parameters<typeof castSpell>[5],
    ) => {
      setError(null)
      const result = await castSpell(caster.id, spell, slot, targetIds, roll, area)
      setEvents((list) => result.events.reduce(withRow, list).sort((a, b) => a.seq - b.seq))
      reload()
      return result.roll
    },
    [reload],
  )

  const monsterAbility = useCallback(
    async (
      monster: Combatant,
      ability: MonsterAbilityUse,
      targetIds: string[],
      roll: Parameters<typeof sendMonsterAbility>[3],
    ) => {
      setError(null)
      const result = await sendMonsterAbility(monster.id, ability, targetIds, roll)
      setEvents((list) => result.events.reduce(withRow, list).sort((a, b) => a.seq - b.seq))
      reload()
      return result.roll
    },
    [reload],
  )

  const concentrationSave = useCallback(async (characterId: string) => {
    setError(null)
    const { roll } = await rollConcentrationSave(characterId)
    return roll
  }, [])

  const applyFeature = useCallback(
    async (combatant: Combatant, name: string, cost: FeatureCost) => {
      setError(null)
      const event = await featureInFight(combatant.id, name, cost)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return event
    },
    [reload],
  )

  const applyItem = useCallback(
    async (combatant: Combatant, itemId: string, target: Combatant | null, request: RollRequest | null) => {
      setError(null)
      const { event, roll } = await itemInFight(combatant.id, itemId, target?.id ?? null, request)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const takeBack = useCallback(
    async (event: CombatEvent) => {
      setError(null)
      await undoEvent(event.id)
      reload()
    },
    [reload],
  )

  const setCondition = useCallback(
    async (
      combatant: Combatant,
      condition: string,
      on: boolean,
      choice: ClockChoice | null,
      resist: { ability: Ability; dc: number } | null = null,
    ) => {
      setError(null)
      const result = await putCondition(combatant.id, condition, on, choice, resist)
      setEvents((list) => withRow(list, result.event).sort((a, b) => a.seq - b.seq))
      reload()
      return { resisted: result.resisted, roll: result.roll }
    },
    [reload],
  )

  const conditionSave = useCallback(
    async (combatant: Combatant, condition: string) => {
      setError(null)
      const { roll, event } = await rollConditionSave(combatant.id, condition)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const standUp = useCallback(
    async (combatant: Combatant) => {
      setError(null)
      const event = await standUpNow(combatant.id)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
    },
    [reload],
  )

  const breakFree = useCallback(
    async (combatant: Combatant) => {
      setError(null)
      const { roll, event } = await breakFreeNow(combatant.id)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const talk = useCallback(
    async (combatant: Combatant, skill: TalkSkill, targetIds: string[], words: string, request: RollRequest) => {
      setError(null)
      const { roll, event } = await talkNow(combatant.id, skill, targetIds, words, request)
      setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
      reload()
      return roll
    },
    [reload],
  )

  const answerTalk = useCallback(
    (event: CombatEvent, answer: TalkAnswer, outcome: TalkOutcome | null) => {
      void attempt(async () => {
        const answered = await answerTalkNow(event.id, answer, outcome)
        setEvents((list) => withRow(list, answered).sort((a, b) => a.seq - b.seq))
        return true
      }).then(() => reload())
    },
    [attempt, reload],
  )

  const setStance = useCallback(
    (combatant: Combatant, stance: Stance) => {
      patchLocal((f) => ({ ...f, combatants: f.combatants.map((c) => (c.id === combatant.id ? { ...c, stance } : c)) }))
      void attempt(async () => {
        const event = await setStanceNow(combatant.id, stance)
        setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
        return true
      }).then(() => reload())
    },
    [attempt, patchLocal, reload],
  )

  const setParley = useCallback(
    (on: boolean) => {
      const now = current.current
      if (!now) return
      patchLocal((f) => ({ ...f, encounter: { ...f.encounter, parley: on } }))
      void attempt(async () => {
        const event = await setParleyNow(now.encounter.id, on)
        setEvents((list) => withRow(list, event).sort((a, b) => a.seq - b.seq))
        return true
      }).then(() => reload())
    },
    [attempt, patchLocal, reload],
  )

  const undo = useCallback(() => {
    const newest = [...events].reverse().find((e) => !e.undone)
    if (!newest) return
    void attempt(() => undoEvent(newest.id)).then(() => reload())
  }, [attempt, events, reload])

  return {
    fight,
    status,
    error,
    events,
    attack,
    offhandAttack: offhand,
    act,
    undo,
    prompts,
    strike,
    letGo,
    deathSave,
    cast,
    monsterAbility,
    beginBattle,
    setPlaced,
    concentrationSave,
    applyFeature,
    applyItem,
    takeBack,
    setCondition,
    conditionSave,
    standUp,
    breakFree,
    talk,
    answerTalk,
    setStance,
    setParley,
    start,
    addMonsters: addMonstersTo,
    addCharacters,
    rollInitiative: rollFor,
    next,
    setMonsterHp: setHp,
    reveal,
    setConditions,
    remove,
    end,
  }
}

/** A word for how a combatant looks: from a monster's health, or a character's real hit points. */
export type { HealthState }

export type TokenControls = {
  tokens: Token[]
  move: (token: Token, x: number, y: number) => void
  place: (tokens: NewToken[]) => Promise<void>
  setHidden: (token: Token, hidden: boolean) => void
  remove: (token: Token) => void
  error: string | null
}

/** The tokens on one battle map, kept up to date live. */
export function useTokens(campaignId: string, userId: string, mapId: string | null): TokenControls {
  const [loaded, setLoaded] = useState<{ mapId: string; tokens: Token[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tokens = loaded && loaded.mapId === mapId ? loaded.tokens : []

  const load = useCallback(() => {
    if (!mapId) return
    let live = true
    listTokens(campaignId, mapId).then(
      (list) => live && setLoaded({ mapId, tokens: list }),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    return () => {
      live = false
    }
  }, [campaignId, mapId])
  useEffect(load, [load])
  useCatchUp(campaignId, userId, load)

  const set = useCallback(
    (change: (tokens: Token[]) => Token[]) =>
      setLoaded((now) => (now && now.mapId === mapId ? { ...now, tokens: change(now.tokens) } : now)),
    [mapId],
  )

  const onChange = useCallback(
    (change: RowChange<'tokens'>) => {
      if (change.type === 'delete') set((list) => list.filter((t) => t.id !== change.id))
      else {
        const token = rowToToken(change.row)
        if (token.mapId === mapId) set((list) => withRow(list, token))
      }
    },
    [mapId, set],
  )
  useTableChanges(campaignId, userId, 'tokens', onChange)

  const attempt = (work: () => Promise<unknown>) => {
    setError(null)
    work().catch((caught: unknown) => {
      setError(messageFor(caught))
      // Refused (too far, or not your turn): put the miniatures back where the server has them.
      load()
    })
  }

  return {
    tokens,
    error,
    move: (token, x, y) => {
      set((list) => list.map((t) => (t.id === token.id ? { ...t, x, y } : t)))
      attempt(() => moveToken(token.id, x, y))
    },
    place: async (list) => {
      if (!mapId) return
      try {
        const placed = await placeTokens(campaignId, mapId, list)
        set((now) => placed.reduce(withRow, now))
      } catch (caught) {
        setError(messageFor(caught))
      }
    },
    setHidden: (token, hidden) => {
      set((list) => list.map((t) => (t.id === token.id ? { ...t, hidden } : t)))
      attempt(() => setTokenHidden(token.id, hidden))
    },
    remove: (token) => {
      set((list) => list.filter((t) => t.id !== token.id))
      attempt(() => removeToken(token.id))
    },
  }
}

export type Pointer = MapPointer & { at: number }

const HAND_EVERY_MS = 250
const HAND_FADES_MS = 3000
const PING_FADES_MS = 2500

/** Everyone's hands over the map and their pings, sent at most four times a second while moving. */
export function useMapPointers(campaignId: string, me: { userId: string; name: string }) {
  const [hands, setHands] = useState<Pointer[]>([])
  const [pings, setPings] = useState<(Pointer & { id: number })[]>([])
  const lastSent = useRef(0)
  const pingCount = useRef(0)

  const onPointer = useCallback((kind: 'hand' | 'ping', pointer: MapPointer) => {
    const at = Date.now()
    if (kind === 'hand') setHands((now) => [...now.filter((h) => h.userId !== pointer.userId), { ...pointer, at }])
    else {
      pingCount.current += 1
      const id = pingCount.current
      setPings((now) => [...now, { ...pointer, at, id }])
      setTimeout(() => setPings((now) => now.filter((p) => p.id !== id)), PING_FADES_MS)
    }
  }, [])
  usePointerBroadcasts(campaignId, me.userId, onPointer)

  // Hands that stop moving fade away.
  useEffect(() => {
    const timer = setInterval(() => setHands((now) => now.filter((h) => Date.now() - h.at < HAND_FADES_MS)), 1000)
    return () => clearInterval(timer)
  }, [])

  const sendHand = useCallback(
    (x: number, y: number) => {
      const now = Date.now()
      if (now - lastSent.current < HAND_EVERY_MS) return
      lastSent.current = now
      broadcastPointer(campaignId, 'hand', { ...me, x, y })
    },
    [campaignId, me],
  )

  const sendPing = useCallback(
    (x: number, y: number) => {
      broadcastPointer(campaignId, 'ping', { ...me, x, y })
      onPointer('ping', { ...me, x, y })
    },
    [campaignId, me, onPointer],
  )

  return { hands: hands.filter((h) => h.userId !== me.userId), pings, sendHand, sendPing }
}
