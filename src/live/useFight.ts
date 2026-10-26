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
} from './combat.ts'
import { messageFor } from './errors.ts'
import type { Roll } from './rolls.ts'
import type { FeatureCost } from '../rules/features.ts'

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
  /** The Constitution save to keep concentrating after taking damage. Throws in plain words if refused. */
  concentrationSave: (characterId: string) => Promise<Roll>
  /** Uses a feature (Rage): spends its part of the turn, named in the feed. Throws in plain words if refused. */
  applyFeature: (combatant: Combatant, name: string, cost: FeatureCost) => Promise<CombatEvent>
  /** Takes back one thing that happened: a player their own newest action, the DM anything newest first. */
  takeBack: (event: CombatEvent) => Promise<void>
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
  const next = useCallback(() => {
    const now = current.current
    if (!now) return
    const entries = now.combatants.map((c) => ({ ...c, out: c.kind === 'monster' && c.health === 'down' }))
    const turn = nextTurn(entries, now.encounter.currentId, now.encounter.round)
    patchLocal((f) => ({ ...f, encounter: { ...f.encounter, currentId: turn.currentId, round: turn.round } }))
    void attempt(async () => {
      const encounter = await endTurn(now.encounter.id)
      patchLocal((f) => (f.encounter.id === encounter.id ? { ...f, encounter } : f))
      return true
    }).then((ended) => {
      // Refused (it wasn't your turn after all): show whose turn the server says it is.
      if (!ended) reload()
    })
  }, [attempt, patchLocal, reload])

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

  const takeBack = useCallback(
    async (event: CombatEvent) => {
      setError(null)
      await undoEvent(event.id)
      reload()
    },
    [reload],
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
    act,
    undo,
    prompts,
    strike,
    letGo,
    deathSave,
    cast,
    concentrationSave,
    applyFeature,
    takeBack,
    start,
    addMonsters: addMonstersTo,
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
