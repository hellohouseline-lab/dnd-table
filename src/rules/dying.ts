// Dropping to 0 hit points and opportunity attacks (2014 rules). The server applies them
// (supabase/migrations/20261027030000_reactions_death_saves.sql); these are the same rules for the
// screens and the previews.

/** Where a character at 0 hit points stands. */
export type DeathSaves = { successes: number; failures: number; stable: boolean; dead: boolean }

export type DeathSaveResult = 'success' | 'failure' | 'stable' | 'dead' | 'awake'

/**
 * A death save from the d20 as rolled: 10 or more succeeds; a 1 counts as two failures; a 20 brings
 * the character back with 1 hit point (and clears the count). Three successes make them stable,
 * three failures dead.
 */
export function deathSave(natural: number, before: DeathSaves): DeathSaves & { result: DeathSaveResult } {
  if (natural === 20) return { successes: 0, failures: 0, stable: false, dead: false, result: 'awake' }
  const successes = Math.min(3, before.successes + (natural >= 10 ? 1 : 0))
  const failures = Math.min(3, before.failures + (natural === 1 ? 2 : natural < 10 ? 1 : 0))
  const stable = successes >= 3
  const dead = failures >= 3
  const result: DeathSaveResult = dead ? 'dead' : stable ? 'stable' : natural >= 10 ? 'success' : 'failure'
  return { successes, failures, stable, dead, result }
}

/** Taking damage while at 0 hit points: a death save failure, or two from a critical hit. */
export function hitWhileDown(before: DeathSaves, critical: boolean): DeathSaves {
  const failures = Math.min(3, before.failures + (critical ? 2 : 1))
  return { ...before, failures, stable: false, dead: failures >= 3 }
}

/** Is this character dying: at 0 hit points, still rolling death saves? */
export function isDying(character: { currentHp: number; stable: boolean; dead: boolean }): boolean {
  return character.currentHp === 0 && !character.stable && !character.dead
}

/** Conditions that stop a creature taking reactions. */
const CANT_REACT = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']

/** A creature on the map that might strike someone moving away from it. */
export type Threat = {
  id: string
  side: 'character' | 'monster'
  x: number
  y: number
  /** How far it reaches: 5 feet, or 10 with a reach weapon. */
  reachFt: number
  reactionUsed: boolean
  /** At 0 hit points (a character) or down (a monster). */
  down: boolean
  conditions: string[]
}

const feet = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  5 * Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/**
 * Who gets an opportunity attack when a creature moves from one square to another: creatures on
 * the other side, able to react, that had it within reach before the move and don't after.
 * Disengaging prevents them all. Moving about inside someone's reach doesn't provoke.
 */
export function opportunityThreats(
  mover: { side: 'character' | 'monster'; disengaged: boolean },
  from: { x: number; y: number },
  to: { x: number; y: number },
  threats: Threat[],
): string[] {
  if (mover.disengaged) return []
  return threats
    .filter(
      (t) =>
        t.side !== mover.side &&
        !t.reactionUsed &&
        !t.down &&
        !t.conditions.some((c) => CANT_REACT.includes(c)) &&
        feet(t, from) <= t.reachFt &&
        feet(t, to) > t.reachFt,
    )
    .map((t) => t.id)
}
