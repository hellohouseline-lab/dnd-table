// What a creature can strike with when someone moves out of its reach: an opportunity attack is
// one melee attack, made with the reaction.

import type { RollRequest } from '../../rules/dice.ts'
import { isAttack, monsterAttack } from '../../rules/combat.ts'
import { attackRoll } from '../../rules/rolls.ts'
import { findWeapon, type SrdMonster } from '../../rules/srd/index.ts'
import { attackMode, weaponReach } from '../../rules/turn.ts'
import type { FightRow } from './fightRows.ts'

export type Strike = {
  /** "Glaive", "Scimitar". */
  label: string
  /** The attack roll against this target, with advantage or disadvantage from the target's state. */
  build: (target: FightRow) => RollRequest
}

/** What about the target changes the roll: its conditions, and whether it's Dodging. */
export function targetState(target: FightRow) {
  return {
    conditions: target.character?.conditions ?? target.combatant.conditions,
    dodging: target.combatant.turn.dodging,
  }
}

/** The melee attacks this creature could make as an opportunity attack. */
export function strikesFor(row: FightRow, monsters: SrdMonster[] | null): Strike[] {
  const character = row.character
  if (character) {
    return character.attacks
      .filter((attack) => weaponReach(findWeapon(attack.weapon)).melee !== null)
      .map((attack) => ({
        label: attack.name || 'Attack',
        build: (target) => {
          const request = attackRoll(character, attack, { secret: false })
          return { ...request, mode: attackMode(request.mode, targetState(target), null) }
        },
      }))
  }
  const monster = row.secret?.monster ? monsters?.find((m) => m.index === row.secret?.monster) : undefined
  return (monster?.actions ?? [])
    .filter((action) => isAttack(action) && /melee/i.test(action.desc))
    .map((action) => ({
      label: action.name,
      build: (target) => {
        const request = monsterAttack(row.name, action)
        return { ...request, mode: attackMode(request.mode, targetState(target), null) }
      },
    }))
}
