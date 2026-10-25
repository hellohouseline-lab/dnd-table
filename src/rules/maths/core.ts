// The basic sums every other number on the sheet is built from (2014 Player's Handbook rules).

/** Score 10 or 11 gives +0; every two points either side adds or takes away one. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/** +2 at levels 1 to 4, +3 at 5 to 8, +4 at 9 to 12, +5 at 13 to 16, +6 at 17 to 20. */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((clampLevel(level) - 1) / 4)
}

/** Shows a bonus the way the sheet does: +3, +0, −1 (with a true minus sign). */
export function formatBonus(bonus: number): string {
  return bonus < 0 ? `−${Math.abs(bonus)}` : `+${bonus}`
}

export function clampLevel(level: number): number {
  return Math.min(20, Math.max(1, Math.trunc(level) || 1))
}
