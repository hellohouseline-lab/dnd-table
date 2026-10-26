import { useCallback, useEffect, useState } from 'react'
import type { Combatant, Token } from '../../live/combat.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { Roll } from '../../live/rolls.ts'
import type { AttackEntry } from '../../rules/character.ts'
import { feetBetween, monsterAttack } from '../../rules/combat.ts'
import { attackRoll } from '../../rules/rolls.ts'
import { combineModes, type RollRequest } from '../../rules/dice.ts'
import { findWeapon, type SrdMonsterAction } from '../../rules/srd/index.ts'
import { actionReach, attackMode, inReach, weaponReach, type Reach } from '../../rules/turn.ts'
import type { FightRow } from './fightRows.ts'

type Aim = {
  label: string
  attacker: Combatant
  reach: Reach
  /** The attack roll against this target, with advantage or disadvantage from the target's state. */
  build: (target: FightRow, feet: number | null) => RollRequest
}

/** While an attack is waiting for its target: what it is, and how to pick one. */
export type Aiming = { label: string; attackerId: string; onPick: (target: FightRow) => void } | null

function tokenOf(tokens: Token[], combatant: Combatant): Token | undefined {
  return tokens.find((t) => (combatant.characterId ? t.characterId === combatant.characterId : t.combatantId === combatant.id))
}

/**
 * The DM's two-click attack: pick a monster's action (or a character's weapon, acting for them),
 * then its target, on the map or in the turn order. The server rolls, checks armour class and
 * takes the damage off; the roll comes back to be thrown with the dice. Escape puts it away.
 */
export function useAiming(
  attack: FightControls['attack'],
  rollWith: (work: () => Promise<Roll>) => Promise<Roll | null>,
  tokens: Token[] = [],
) {
  const [aim, setAim] = useState<Aim | null>(null)

  useEffect(() => {
    if (!aim) return
    const cancel = (event: KeyboardEvent) => event.key === 'Escape' && setAim(null)
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [aim])

  const aimMonster = useCallback((row: FightRow, action: SrdMonsterAction) => {
    setAim({
      label: `${row.name}: ${action.name}`,
      attacker: row.combatant,
      reach: actionReach(action.desc),
      build: (target, feet) => {
        const request = monsterAttack(row.name, action)
        return { ...request, mode: attackMode(request.mode, targetState(target), feet) }
      },
    })
  }, [])

  const aimCharacter = useCallback((row: FightRow, weapon: AttackEntry) => {
    const character = row.character
    if (!character) return
    setAim({
      label: `${character.name}: ${weapon.name || 'Attack'}`,
      attacker: row.combatant,
      reach: weaponReach(findWeapon(weapon.weapon)),
      build: (target, feet) => {
        const request = attackRoll(character, weapon)
        return { ...request, mode: attackMode(request.mode, targetState(target), feet) }
      },
    })
  }, [])

  const pick = useCallback(
    (target: FightRow) => {
      if (!aim) return
      const from = tokenOf(tokens, aim.attacker)
      const to = tokenOf(tokens, target.combatant)
      const feet = from && to ? feetBetween(from, to) : null
      const range = feet === null ? null : inReach(aim.reach, feet)
      if (range && !range.allowed && !window.confirm(`${range.why}. Attack anyway?`)) return
      const built = aim.build(target, feet)
      const request = range?.disadvantage ? { ...built, mode: combineModes([built.mode, 'disadvantage']) } : built
      const attacker = aim.attacker
      setAim(null)
      void rollWith(() => attack(attacker, target.combatant, request))
    },
    [aim, attack, rollWith, tokens],
  )

  const aiming: Aiming = aim ? { label: aim.label, attackerId: aim.attacker.id, onPick: pick } : null
  return { aiming, aimMonster, aimCharacter, cancel: () => setAim(null) }
}

/** What about the target changes the roll: its conditions, and whether it's Dodging. */
function targetState(target: FightRow) {
  return { conditions: target.character?.conditions ?? target.combatant.conditions, dodging: target.combatant.turn.dodging }
}
