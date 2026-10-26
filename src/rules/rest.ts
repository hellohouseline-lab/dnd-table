// Short and long rests and spending hit dice (2014 Player's Handbook rules). Each returns the
// changes to make and a plain-words list of what changed, for the log.

import type { Character } from './character.ts'
import { clampLevel } from './maths/core.ts'

export type RestPatch = Partial<
  Pick<
    Character,
    | 'currentHp'
    | 'tempHp'
    | 'hitDiceUsed'
    | 'features'
    | 'spellcasting'
    | 'exhaustion'
    | 'deathSaveSuccesses'
    | 'deathSaveFailures'
  >
>

export type RestResult = { patch: RestPatch; changes: string[] }

type RestCharacter = Pick<
  Character,
  | 'level'
  | 'currentHp'
  | 'maxHp'
  | 'tempHp'
  | 'hitDiceUsed'
  | 'features'
  | 'spellcasting'
  | 'exhaustion'
  | 'deathSaveSuccesses'
  | 'deathSaveFailures'
>

function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * A short rest (an hour or so): features that recharge on a short rest come back. Hit dice are
 * spent one at a time with spendHitDie, as the player chooses.
 */
export function shortRest(character: RestCharacter): RestResult {
  const recharged = character.features.filter(
    (f) => f.recharge === 'short' && f.usesMax !== null && f.usesLeft < f.usesMax,
  )
  if (recharged.length === 0) return { patch: {}, changes: [] }
  return {
    patch: {
      features: character.features.map((f) =>
        recharged.includes(f) && f.usesMax !== null ? { ...f, usesLeft: f.usesMax } : f,
      ),
    },
    changes: [`${listNames(recharged.map((f) => f.name))} ${recharged.length === 1 ? 'is' : 'are'} ready again`],
  }
}

/**
 * A long rest (8 hours): all hit points back, temporary ones gone, half your hit dice back (at
 * least one), every spell slot and feature use back, one level of exhaustion gone, death saves reset.
 */
export function longRest(character: RestCharacter): RestResult {
  const changes: string[] = []
  const patch: RestPatch = {}

  if (character.currentHp < character.maxHp) {
    patch.currentHp = character.maxHp
    changes.push(`back to ${character.maxHp} hit points`)
  }
  if (character.tempHp > 0) patch.tempHp = 0

  const totalDice = clampLevel(character.level)
  const regained = Math.min(character.hitDiceUsed, Math.max(1, Math.floor(totalDice / 2)))
  if (regained > 0) {
    patch.hitDiceUsed = character.hitDiceUsed - regained
    changes.push(`${regained} hit ${regained === 1 ? 'die' : 'dice'} back`)
  }

  if (character.spellcasting.slotsUsed.some((used) => used > 0)) {
    patch.spellcasting = { ...character.spellcasting, slotsUsed: character.spellcasting.slotsUsed.map(() => 0) }
    changes.push('all spell slots back')
  }

  const spent = character.features.filter((f) => f.usesMax !== null && f.usesLeft < f.usesMax)
  if (spent.length > 0) {
    patch.features = character.features.map((f) => (f.usesMax !== null ? { ...f, usesLeft: f.usesMax } : f))
    changes.push(`${listNames(spent.map((f) => f.name))} ready again`)
  }

  if (character.exhaustion > 0) {
    patch.exhaustion = character.exhaustion - 1
    changes.push(`exhaustion down to ${character.exhaustion - 1}`)
  }
  if (character.deathSaveSuccesses > 0 || character.deathSaveFailures > 0) {
    patch.deathSaveSuccesses = 0
    patch.deathSaveFailures = 0
  }
  return { patch, changes }
}

/** Hit points from one hit die on a short rest: the roll plus the Constitution modifier, never below 0. */
export function hitDieHealing(roll: number, constitutionModifier: number): number {
  return Math.max(0, roll + constitutionModifier)
}
