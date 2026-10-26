// Dice: what a roll asks for, how thrown dice settle into a total, and advantage.
//
// The server throws the dice for real rolls (public.throw_dice in the database), so nobody can pick
// their own number. settleRoll here follows exactly the same rules: it explains any roll on screen,
// runs practice throws, and carries the unit tests.

export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const
export type DieSides = (typeof DIE_SIDES)[number]

/** Most dice in one throw, and of one kind, as the server allows. */
export const MAX_DICE = 40
export const MAX_OF_ONE_DIE = 20

export type DiceGroup = { sides: DieSides; count: number }
export type RollMode = 'normal' | 'advantage' | 'disadvantage'
export type RollKind = 'free' | 'check' | 'save' | 'attack' | 'initiative'

/** One piece of a bonus, for the log: { label: 'Wisdom', value: 1 }. */
export type RollPart = { label: string; value: number }

export type DamageRequest = { dice: DiceGroup[]; modifier: number; type: string }

/** What someone asks to roll. */
export type RollRequest = {
  label: string
  kind: RollKind
  characterId: string | null
  dice: DiceGroup[]
  modifier: number
  parts: RollPart[]
  mode: RollMode
  /** An attack's damage, thrown with it. */
  damage: DamageRequest | null
  /** Seen only by whoever rolled it and the DM. */
  secret: boolean
}

export type RolledDie = { sides: DieSides; value: number; dropped: boolean }
export type RolledDamage = { dice: RolledDie[]; modifier: number; total: number; type: string; critical: boolean }

/** What the dice came to. */
export type RollOutcome = {
  /** Every die in the order it was thrown; with advantage or disadvantage, one d20 is dropped. */
  dice: RolledDie[]
  total: number
  /** The d20 that counts, for natural 20 and natural 1 moments. Null unless the roll is one d20. */
  natural: number | null
  /** Null when there's no damage, or when a natural 1 missed. */
  damage: RolledDamage | null
}

export function isDieSides(n: number): n is DieSides {
  return (DIE_SIDES as readonly number[]).includes(n)
}

/**
 * Reads dice from text: '2d6' is two six-sided dice, 'd20' one twenty-sided die, '1d8+1d6' both.
 * Flat numbers ('+3') are left out: bonuses are worked out separately. Anything else gives [].
 */
export function parseDice(text: string): DiceGroup[] {
  const groups: DiceGroup[] = []
  for (const term of text.replace(/\s+/g, '').toLowerCase().split('+')) {
    const match = /^(\d*)d(\d+)$/.exec(term)
    if (!match) continue
    const count = match[1] === '' ? 1 : Number(match[1])
    const sides = Number(match[2])
    if (!isDieSides(sides) || count < 1) continue
    const same = groups.find((group) => group.sides === sides)
    if (same) same.count += count
    else groups.push({ sides, count })
  }
  return groups
}

/** [{6, 2}, {4, 1}] gives '2d6+1d4'. */
export function diceText(groups: DiceGroup[]): string {
  return groups.map((group) => `${group.count}d${group.sides}`).join('+')
}

export function countDice(groups: DiceGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0)
}

/** Advantage, disadvantage and naturals only apply to a roll of exactly one d20. */
export function isSingleD20(groups: DiceGroup[]): boolean {
  return groups.length === 1 && groups[0].sides === 20 && groups[0].count === 1
}

/** The sum of the dice that count. */
export function keptSum(dice: RolledDie[]): number {
  return dice.reduce((sum, die) => (die.dropped ? sum : sum + die.value), 0)
}

/** Throws one die: returns a whole number from 1 to `sides`. */
export type Draw = (sides: DieSides) => number

/**
 * Throws the dice for a roll and works out the result, by the same rules as the server:
 * - advantage throws a second d20 and keeps the higher; disadvantage keeps the lower;
 * - an attack's damage is thrown after the d20: a natural 20 doubles the damage dice (a critical
 *   hit), a natural 1 always misses so no damage is thrown, and damage never goes below 0.
 */
export function settleRoll(
  request: Pick<RollRequest, 'dice' | 'modifier' | 'mode' | 'damage'>,
  draw: Draw,
): RollOutcome {
  const single = isSingleD20(request.dice)
  const mode = single ? request.mode : 'normal'
  let dice = throwGroups(request.dice, 1, draw)

  if (mode !== 'normal') {
    const first = dice[0].value
    const second = draw(20)
    const keepFirst = mode === 'advantage' ? first >= second : first <= second
    dice = [
      { sides: 20, value: first, dropped: !keepFirst },
      { sides: 20, value: second, dropped: keepFirst },
    ]
  }

  const natural = single ? (dice.find((die) => !die.dropped)?.value ?? null) : null
  let damage: RolledDamage | null = null
  if (request.damage && natural !== 1) {
    const critical = natural === 20
    const damageDice = throwGroups(request.damage.dice, critical ? 2 : 1, draw)
    damage = {
      dice: damageDice,
      modifier: request.damage.modifier,
      total: Math.max(0, keptSum(damageDice) + request.damage.modifier),
      type: request.damage.type,
      critical,
    }
  }

  return { dice, total: keptSum(dice) + request.modifier, natural, damage }
}

function throwGroups(groups: DiceGroup[], times: number, draw: Draw): RolledDie[] {
  return groups.flatMap((group) =>
    Array.from({ length: group.count * times }, () => ({
      sides: group.sides,
      value: draw(group.sides),
      dropped: false,
    })),
  )
}

/** A fair die from the browser's secure random numbers, for practice throws. */
export const secureDraw: Draw = (sides) => {
  const span = 2 ** 32
  const fairBelow = span - (span % sides)
  const buffer = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    if (buffer[0] < fairBelow) return 1 + (buffer[0] % sides)
  }
}

/**
 * Advantage and disadvantage from any number of sources. If a roll has both, they cancel out and
 * it is a normal roll, however many of each there are.
 */
export function combineModes(modes: RollMode[]): RollMode {
  const advantage = modes.includes('advantage')
  const disadvantage = modes.includes('disadvantage')
  if (advantage === disadvantage) return 'normal'
  return advantage ? 'advantage' : 'disadvantage'
}

/** Checks a request against what the server accepts, in plain words. Null when it's fine. */
export function requestProblem(request: Pick<RollRequest, 'dice' | 'mode' | 'damage'>): string | null {
  if (request.dice.length === 0) return 'Pick at least one die.'
  const groups = [...request.dice, ...(request.damage?.dice ?? [])]
  if (groups.some((group) => group.count > MAX_OF_ONE_DIE)) return `Roll at most ${MAX_OF_ONE_DIE} of each die.`
  if (countDice(request.dice) > MAX_DICE) return `Roll at most ${MAX_DICE} dice at once.`
  // A critical hit doubles the damage dice, so there must be room for twice as many.
  if (request.damage && countDice(request.damage.dice) * 2 > MAX_DICE) {
    return `An attack's damage can have at most ${MAX_DICE / 2} dice.`
  }
  if (request.mode !== 'normal' && !isSingleD20(request.dice)) return 'Advantage and disadvantage need a single d20.'
  return null
}
