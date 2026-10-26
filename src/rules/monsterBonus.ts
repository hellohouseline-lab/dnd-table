// A monster's bonus actions, read from its stat block (2014 SRD) so the DM can use them in one click:
// a goblin's Nimble Escape (Disengage or Hide), a spy's Cunning Action (Dash, Disengage or Hide),
// an orc's Aggressive (move its speed toward a foe), a lion's Pounce (a bite after a charging hit),
// a gnoll's Rampage (a bite after dropping someone), a clay golem's Haste (a slam).

import type { BonusMove } from './turn.ts'
import type { SrdMonster, SrdMonsterAction } from './srd/index.ts'

export type MonsterBonus = {
  name: string
  desc: string
  /** Dash, Disengage, Hide or Dodge it can take with the bonus action. Moving its speed counts as Dash. */
  moves: BonusMove[]
  /** An attack it makes with the bonus action ("Bite"), if any. */
  attack: string | null
  /** When it can: any turn, or only after something happened this turn. */
  when: 'any' | 'afterHit' | 'afterDrop'
}

/** Words that mean the trait is a bonus action, not just mentioning one. */
const IS_BONUS = /\b(?:as a bonus action|(?:use|take) a bonus action|bonus action to)\b/i

export function monsterBonusActions(monster: Pick<SrdMonster, 'traits' | 'actions'>): MonsterBonus[] {
  const entries: { name: string; desc: string }[] = [...monster.traits, ...monster.actions]
  return entries
    .filter((entry) => IS_BONUS.test(entry.desc))
    .map((entry) => {
      const desc = entry.desc
      const moves: BonusMove[] = []
      for (const move of ['dash', 'disengage', 'hide', 'dodge'] as const) {
        if (new RegExp(`\\b${move}\\b`, 'i').test(desc)) moves.push(move)
      }
      if (moves.length === 0 && /\bmove up to (?:its|half its) speed\b/i.test(desc) && !/\battack\b/i.test(desc)) {
        moves.push('dash')
      }
      const attack =
        monster.actions.find(
          (action) => action.name !== entry.name && new RegExp(`\\b${action.name}\\b`, 'i').test(desc),
        )?.name ?? null
      const when = /reduces a creature to 0 hit points/i.test(desc)
        ? 'afterDrop'
        : /\bhits it with\b/i.test(desc)
          ? 'afterHit'
          : 'any'
      return { name: entry.name, desc, moves, attack, when } satisfies MonsterBonus
    })
}

/** "only after it hits", for the button's note. */
export const WHEN_WORDS: Record<MonsterBonus['when'], string> = {
  any: '',
  afterHit: 'only after it charges and hits',
  afterDrop: 'only after it drops someone to 0 hit points',
}

/** A skill bonus for a monster: its own if it has one, otherwise the ability modifier. */
export function monsterSkill(
  monster: Pick<SrdMonster, 'skills' | 'scores'>,
  skill: string,
  ability: keyof SrdMonster['scores'],
): number {
  const own = monster.skills?.[skill]
  if (typeof own === 'number') return own
  return Math.floor((monster.scores[ability] - 10) / 2)
}

/** Reactions it has (a knight's Parry), each a button for the DM. */
export function monsterReactions(monster: Pick<SrdMonster, 'reactions'>): SrdMonsterAction[] {
  return monster.reactions
}
