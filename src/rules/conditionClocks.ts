// Conditions that wear off (C3a, docs/C3_PLAN.md). A condition in a fight can carry a clock: rounds
// left, an end at the end of the creature's next turn, a save at the end of each of its turns, a
// caster whose concentration holds it, and the DC to break free. The server keeps the clocks
// (supabase/migrations/20261027290000_condition_clocks.sql); the same rules are here, with tests,
// for the screens and the previews.

import { ABILITY_NAME, type Ability } from './abilities.ts'
import type { SrdMonster, SrdSpell } from './srd/index.ts'

export type ConditionClock = {
  condition: string
  /** Rounds left, counted down as the creature's turn starts; null for no time limit. */
  rounds: number | null
  /** Ends at the end of the creature's next turn. */
  endOfNextTurn: boolean
  /** A save at the end of each of the creature's turns ends it. A secret DC stays with the DM. */
  save: { ability: Ability; dc: number | null; secret: boolean } | null
  /** Ends when this caster stops concentrating on this spell. */
  caster: { characterId: string; spell: string } | null
  /** The DC to break free with Athletics or Acrobatics (grappled, restrained). */
  escapeDc: number | null
  /** The creature's turn has started since it was put on, so "the end of its next turn" can come. */
  started: boolean
  /** A player's save is waiting to be rolled. */
  owed: boolean
}

/** How long, as chosen when a condition goes on. */
export type HowLong = { kind: 'removed' } | { kind: 'end-of-turn' } | { kind: 'rounds'; rounds: number }

export type ClockChoice = {
  howLong: HowLong
  save?: { ability: Ability; dc: number; secret: boolean } | null
  caster?: { characterId: string; spell: string } | null
  escapeDc?: number | null
}

/** The clock for a condition from what was chosen; null when it simply stays until taken off. */
export function makeClock(condition: string, choice: ClockChoice): ConditionClock | null {
  const clock: ConditionClock = {
    condition,
    rounds: choice.howLong.kind === 'rounds' ? Math.max(1, Math.min(100, Math.round(choice.howLong.rounds))) : null,
    endOfNextTurn: choice.howLong.kind === 'end-of-turn',
    save: choice.save ?? null,
    caster: choice.caster ?? null,
    escapeDc: choice.escapeDc ?? null,
    started: false,
    owed: false,
  }
  return clock.rounds === null && !clock.endOfNextTurn && !clock.save && !clock.caster && clock.escapeDc === null
    ? null
    : clock
}

/** "3 rounds · saves each turn (Wisdom DC 13) · while Elowen concentrates". Players never see a secret DC. */
export function clockWords(
  clock: ConditionClock,
  { forPlayers = false, casterName }: { forPlayers?: boolean; casterName?: string } = {},
): string {
  const bits: string[] = []
  if (clock.endOfNextTurn) bits.push(clock.started ? 'ends this turn' : 'until the end of its next turn')
  if (clock.rounds !== null) bits.push(clock.rounds === 1 ? '1 round' : `${clock.rounds} rounds`)
  if (clock.save) {
    // The DM's own screen gets a secret DC's number from clock_secrets, or says it's secret.
    // Players are never told a DC (Matt, 27 October).
    const dc = forPlayers ? '' : clock.save.dc === null ? ', secret DC' : ` DC ${clock.save.dc}`
    bits.push(`saves each turn (${ABILITY_NAME[clock.save.ability]}${dc})`)
  }
  if (clock.caster) bits.push(`while ${casterName ?? 'the caster'} concentrates`)
  if (clock.escapeDc !== null) bits.push(`break free DC ${clock.escapeDc}`)
  return bits.join(' · ')
}

export type Tick = { kept: ConditionClock[]; ended: ConditionClock[]; saves: ConditionClock[] }

/** As the creature's turn starts: its clocks have started, and rounds come off; at 0 they end. */
export function tickStart(clocks: ConditionClock[]): Tick {
  const kept: ConditionClock[] = []
  const ended: ConditionClock[] = []
  for (const clock of clocks) {
    const next = { ...clock, started: true, rounds: clock.rounds === null ? null : clock.rounds - 1 }
    if (next.rounds !== null && next.rounds <= 0) ended.push(next)
    else kept.push(next)
  }
  return { kept, ended, saves: [] }
}

/**
 * As the creature's turn ends: "until the end of its next turn" ends, if that turn has started, and
 * any save each turn is due (rolled by the server for a monster, owed by a player).
 */
export function tickEnd(clocks: ConditionClock[]): Tick {
  const kept: ConditionClock[] = []
  const ended: ConditionClock[] = []
  const saves: ConditionClock[] = []
  for (const clock of clocks) {
    if (clock.endOfNextTurn && clock.started) ended.push(clock)
    else {
      kept.push(clock)
      if (clock.save && clock.started) saves.push(clock)
    }
  }
  return { kept, ended, saves }
}

/** When a fight ends, a minute passes: anything timed to a minute or less, or saved off, ends. */
export function afterTheFight(clocks: ConditionClock[]): Tick {
  const ended = clocks.filter((c) => c.endOfNextTurn || c.save !== null || (c.rounds !== null && c.rounds <= 10))
  return { kept: clocks.filter((c) => !ended.includes(c)), ended, saves: [] }
}

/** Whether a creature can try to break free from this condition. */
export function canBreakFree(clock: ConditionClock | undefined): boolean {
  return !!clock && clock.escapeDc !== null && ['grappled', 'restrained'].includes(clock.condition)
}

// ---------------------------------------------------------------------------------------------
// What causes conditions: spells and monster attacks, offered as one click (decision 78)

export type ConditionCause = {
  /** The conditions it puts on (Hideous Laughter: prone and incapacitated). */
  conditions: string[]
  /** "Apply Paralysed" on the button. */
  label: string
  rounds: number | null
  endOfNextTurn?: boolean
  /** The target repeats this save at the end of each of its turns (the DC is the spell's or the attack's). */
  saveEachTurn: Ability | null
  /** Tied to the caster's concentration. */
  concentration: boolean
  /** Breaking free is a check against the spell's or attack's DC. */
  escape: boolean
  /** A save the target makes first to avoid it (a wolf's bite: Strength DC 11), rolled by the server. */
  resist: { ability: Ability; dc: number } | null
  /** A DC the attack sets for breaking free, saving each turn or resisting. */
  dc: number | null
}

const cause = (c: Partial<ConditionCause> & Pick<ConditionCause, 'conditions'>): ConditionCause => ({
  label: `Apply ${c.conditions.map((x) => CONDITION_WORD[x] ?? x).join(' and ')}`,
  rounds: null,
  saveEachTurn: null,
  concentration: false,
  escape: false,
  resist: null,
  dc: null,
  ...c,
})

/** The condition's name as players read it (British spelling). */
export const CONDITION_WORD: Record<string, string> = {
  blinded: 'Blinded',
  charmed: 'Charmed',
  deafened: 'Deafened',
  frightened: 'Frightened',
  grappled: 'Grappled',
  incapacitated: 'Incapacitated',
  invisible: 'Invisible',
  paralyzed: 'Paralysed',
  petrified: 'Petrified',
  poisoned: 'Poisoned',
  prone: 'Prone',
  restrained: 'Restrained',
  stunned: 'Stunned',
  unconscious: 'Unconscious',
}

/** Common free-rules spells that put a condition on whoever fails the save. */
export const SPELL_CAUSES: Record<string, ConditionCause> = {
  'hold-person': cause({ conditions: ['paralyzed'], rounds: 10, saveEachTurn: 'wisdom', concentration: true }),
  command: cause({ conditions: ['prone'], label: 'Apply Prone (grovel)' }),
  entangle: cause({ conditions: ['restrained'], rounds: 10, concentration: true, escape: true }),
  'hideous-laughter': cause({
    conditions: ['prone', 'incapacitated'],
    rounds: 10,
    saveEachTurn: 'wisdom',
    concentration: true,
  }),
  'charm-person': cause({ conditions: ['charmed'] }),
  fear: cause({ conditions: ['frightened'], rounds: 10, saveEachTurn: 'wisdom', concentration: true }),
  'blindness-deafness': cause({ conditions: ['blinded'], rounds: 10, saveEachTurn: 'constitution' }),
  'color-spray': cause({ conditions: ['blinded'], endOfNextTurn: true }),
  web: cause({ conditions: ['restrained'], rounds: 600, concentration: true, escape: true }),
  sleep: cause({ conditions: ['unconscious'], rounds: 10 }),
}

/** The cause for a spell by its name as the feed has it ("Hold Person", "Blindness/Deafness"). */
export function spellCauseByName(name: string): ConditionCause | null {
  return (
    SPELL_CAUSES[
      name
        .toLowerCase()
        .replace(/[^a-z]+/g, '-')
        .replace(/^-|-$/g, '')
    ] ?? null
  )
}

/** The cause for a spell, by its index, if it's one the table knows. */
export function spellCause(spell: Pick<SrdSpell, 'index'> | string): ConditionCause | null {
  return SPELL_CAUSES[typeof spell === 'string' ? spell : spell.index] ?? null
}

const ABILITIES = Object.keys(ABILITY_NAME) as Ability[]
const abilityFrom = (word: string): Ability | null => ABILITIES.find((a) => a === word.toLowerCase()) ?? null

/**
 * The condition a monster's attack causes on a hit, read from its free-rules wording: "grappled
 * (escape DC 11)" (and restrained while grappled), "a DC 11 Strength saving throw or be knocked
 * prone", "a DC 10 Constitution saving throw or be paralyzed for 1 minute" (repeating the save at
 * the end of each turn), or "restrained by webbing ... a DC 12 Strength check". Anything else: null.
 */
export function attackCause(desc: string): ConditionCause | null {
  const text = desc.replace(/\s+/g, ' ')
  const grapple = /\bgrappled \(escape DC (\d+)\)/i.exec(text)
  if (grapple) {
    const restrained = /until this grapple ends, the (?:target|creature) is restrained/i.test(text)
    return cause({
      conditions: restrained ? ['grappled', 'restrained'] : ['grappled'],
      escape: true,
      dc: Number(grapple[1]),
    })
  }
  const prone = /DC (\d+) (\w+) saving throw or be knocked prone/i.exec(text)
  if (prone && abilityFrom(prone[2])) {
    return cause({ conditions: ['prone'], resist: { ability: abilityFrom(prone[2])!, dc: Number(prone[1]) } })
  }
  const lasting =
    /DC (\d+) (\w+) saving throw or be (poisoned|paralyzed|frightened|blinded|charmed|stunned) for 1 (minute|hour)/i.exec(
      text,
    )
  if (lasting && abilityFrom(lasting[2])) {
    const ability = abilityFrom(lasting[2])!
    const minute = lasting[4].toLowerCase() === 'minute'
    const repeats = /repeat the saving throw at the end of each of its turns/i.test(text)
    return cause({
      conditions: [lasting[3].toLowerCase()],
      rounds: minute ? 10 : null,
      saveEachTurn: repeats ? ability : null,
      resist: { ability, dc: Number(lasting[1]) },
      dc: Number(lasting[1]),
    })
  }
  const webbing = /restrained by webbing.*?DC (\d+) Strength check/i.exec(text)
  if (webbing) return cause({ conditions: ['restrained'], escape: true, dc: Number(webbing[1]) })
  return null
}

/** The monster's attack by name, and what it causes, if anything. */
export function monsterAttackCause(monster: Pick<SrdMonster, 'actions'>, attackName: string): ConditionCause | null {
  const action = monster.actions.find((a) => a.name.toLowerCase() === attackName.toLowerCase())
  return action ? attackCause(action.desc ?? '') : null
}

/** The clock a cause puts on, with the DC (the caster's spell DC, or the attack's own) filled in. */
export function causeClock(
  c: ConditionCause,
  condition: string,
  { dc, caster }: { dc: number | null; caster?: { characterId: string; spell: string } | null },
): ClockChoice {
  const theDc = c.dc ?? dc
  return {
    howLong: c.endOfNextTurn
      ? { kind: 'end-of-turn' }
      : c.rounds !== null
        ? { kind: 'rounds', rounds: c.rounds }
        : { kind: 'removed' },
    save: c.saveEachTurn && theDc !== null ? { ability: c.saveEachTurn, dc: theDc, secret: false } : null,
    caster: c.concentration && caster ? caster : null,
    escapeDc: c.escape && theDc !== null && ['grappled', 'restrained'].includes(condition) ? theDc : null,
  }
}

// ---------------------------------------------------------------------------------------------
// Undead Fortitude (decision 79)

/** Monster traits the server acts on by itself: Undead Fortitude, for now. */
export function monsterTraitKeys(monster: Pick<SrdMonster, 'traits'>): string[] {
  return (monster.traits ?? []).some((t) => t.name.toLowerCase() === 'undead fortitude') ? ['undead-fortitude'] : []
}

/**
 * Whether Undead Fortitude can save it: damage that drops it to 0, which wasn't radiant or a
 * critical hit. The save is Constitution against 5 plus the damage.
 */
export function fortitudeDc(damage: number, type: string | null, critical: boolean): number | null {
  if (damage <= 0 || critical || (type ?? '').toLowerCase() === 'radiant') return null
  return 5 + damage
}
