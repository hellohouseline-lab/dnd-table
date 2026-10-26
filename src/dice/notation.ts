// Turns dice the server already threw into the 3D library's notation, which makes each die land on
// a given face: '2d20+1d8@14,7,3'. Dice of one kind are listed together. A d100 is thrown as two
// ten-sided dice, a tens die (00 to 90) and a units die (0 to 9), as at a real table.

import type { RolledDie } from '../rules/dice.ts'

type Face = { type: string; value: number }

/** The faces that show a die's value. The library counts the "00" tens face as 100 and "0" as 10. */
export function facesFor(die: Pick<RolledDie, 'sides' | 'value'>): Face[] {
  if (die.sides !== 100) return [{ type: `d${die.sides}`, value: die.value }]
  const tens = Math.floor((die.value % 100) / 10) * 10
  const units = die.value % 10
  return [
    { type: 'd100', value: tens === 0 ? 100 : tens },
    { type: 'd10', value: units === 0 ? 10 : units },
  ]
}

export function throwNotation(dice: Pick<RolledDie, 'sides' | 'value'>[]): string {
  const byType = new Map<string, number[]>()
  for (const face of dice.flatMap(facesFor)) {
    const values = byType.get(face.type) ?? []
    values.push(face.value)
    byType.set(face.type, values)
  }
  const sets = [...byType].map(([type, values]) => `${values.length}${type}`)
  const results = [...byType.values()].flat()
  return `${sets.join('+')}@${results.join(',')}`
}
