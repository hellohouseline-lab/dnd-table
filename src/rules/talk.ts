// Talk in a fight (C3b, docs/C3_PLAN.md section 2): Persuade, Intimidate or Deceive with your
// action, the DM's answer, monsters that surrender or run, and the DM's quiet morale nudge. Pure, so
// the screens, the preview and the tests agree with the server (supabase/migrations/…_talk_parley.sql).

import { namesText } from './askable.ts'
import type { SrdMonster } from './srd/index.ts'

export type TalkSkill = 'persuasion' | 'intimidation' | 'deception'

export const TALK_SKILLS: { skill: TalkSkill; verb: string; word: string; hint: string }[] = [
  { skill: 'persuasion', verb: 'Persuade', word: 'Persuasion', hint: 'Talk them round: honest words, a fair offer' },
  { skill: 'intimidation', verb: 'Intimidate', word: 'Intimidation', hint: 'Scare them: threats, a show of strength' },
  { skill: 'deception', verb: 'Deceive', word: 'Deception', hint: 'Trick them: a bluff, a lie, a false promise' },
]

export function talkSkill(skill: string | undefined): (typeof TALK_SKILLS)[number] | undefined {
  return TALK_SKILLS.find((t) => t.skill === skill)
}

/** Where a monster stands: in the fight, given up, on its way out, or gone. */
export type Stance = 'fighting' | 'surrendered' | 'running' | 'fled'

export const STANCE_WORDS: Record<Stance, string> = {
  fighting: 'Fighting',
  surrendered: 'Surrendered',
  running: 'Running away',
  fled: 'Ran away',
}

/** The DM's answer to a talk card, and what came of "It works". */
export type TalkAnswer = 'works' | 'partly' | 'fails'
export type TalkOutcome = 'surrender' | 'run' | 'parley' | 'words'

type InFight = { kind: 'character' | 'monster'; health: string; stance: Stance }

/** Out of the turn order: a monster that is down, has surrendered or has fled. */
export function isOut(combatant: InFight): boolean {
  return (
    combatant.kind === 'monster' &&
    (combatant.health === 'down' || combatant.stance === 'surrendered' || combatant.stance === 'fled')
  )
}

/** Still there to be talked to: a monster that is up and hasn't given up or gone. */
export function canHear(combatant: InFight): boolean {
  return (
    combatant.kind === 'monster' && combatant.health !== 'down' && ['fighting', 'running'].includes(combatant.stance)
  )
}

/**
 * A hint for the DM when a creature can't be talked round: mindless undead, and beasts, with an
 * Intelligence of 3 or less. Null when words might work. The DM can still choose any answer.
 */
export function deafHint(monster: Pick<SrdMonster, 'name' | 'type' | 'scores'>): string | null {
  const int = monster.scores.intelligence
  if (int > 3) return null
  const type = monster.type.toLowerCase()
  if (type.includes('undead')) return `${monster.name} doesn't listen (Intelligence ${int})`
  if (type.includes('beast'))
    return `${monster.name} can't follow words (Intelligence ${int}), though a scare might work`
  return null
}

type MoraleRow = {
  id: string
  name: string
  health: string
  stance: Stance
  /** Its challenge rating, to find the leader; null when it isn't from the monster list. */
  cr: number | null
  /** False for creatures that can't be talked round (deafHint), who never break. */
  listens: boolean
}

export type MoraleHint = { ids: string[]; text: string }

/**
 * The DM's quiet nudge (decision 82): a monster at a quarter of its hit points or less (near death)
 * might run or beg; so might the rest once their leader falls. The leader is the one with a higher
 * challenge rating than all the others. Only monsters still fighting, and that listen, are named.
 */
export function moraleHints(monsters: MoraleRow[]): MoraleHint[] {
  const hints: MoraleHint[] = []
  const shaky = (m: MoraleRow) => m.stance === 'fighting' && m.listens && m.health !== 'down'
  const rated = monsters.filter((m) => m.cr !== null)
  const top = Math.max(...rated.map((m) => m.cr ?? 0))
  const leaders = rated.filter((m) => m.cr === top)
  const leader = leaders.length === 1 && rated.length > 1 ? leaders[0] : null
  const fallen = leader !== null && (leader.health === 'down' || leader.stance !== 'fighting')
  if (fallen) {
    const rest = monsters.filter((m) => m.id !== leader.id && shaky(m))
    if (rest.length > 0) {
      hints.push({
        ids: rest.map((m) => m.id),
        text: `${leader.name} is out of the fight: ${namesText(rest.map((m) => m.name))} might run or beg`,
      })
    }
  }
  for (const monster of monsters) {
    if (!shaky(monster) || monster.health !== 'near-death') continue
    if (hints.some((h) => h.ids.includes(monster.id))) continue
    hints.push({ ids: [monster.id], text: `${monster.name} is nearly dead: it might run or beg` })
  }
  return hints
}
