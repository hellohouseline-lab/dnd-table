// Plain words and status chips for the roll flow (screens 08, 03, 04 and 09).

import { aOrAn } from '../../components/words.ts'
import type { Member } from '../../live/campaigns.ts'
import type { AskedRoll } from '../../live/rollRequests.ts'
import type { Roll } from '../../live/rolls.ts'
import { namesText } from '../../rules/askable.ts'
import type { Character } from '../../rules/character.ts'

export type ChipTone = 'gold' | 'quiet' | 'pass' | 'fail'
export type CameraChip = { label: string; tone: ChipTone }

type ChipsInput = {
  request: AskedRoll | null
  answers: Roll[]
  members: Member[]
  characters: Character[]
  viewerId: string
}

/**
 * The chip on each camera tile while a roll is asked for, keyed by user id. Someone still to roll
 * sees "Rolled" for the others rather than their verdicts, so nobody is swayed (as in design 03).
 */
export function requestChips({
  request,
  answers,
  members,
  characters,
  viewerId,
}: ChipsInput): Record<string, CameraChip> {
  if (!request) return {}
  const chips: Record<string, CameraChip> = {}
  const viewerIsDm = members.some((m) => m.user_id === viewerId && m.role === 'dm')
  const viewerCharacter = characters.find((c) => c.ownerId === viewerId && request.characterIds.includes(c.id))
  const viewerStillToRoll = viewerCharacter && !answers.some((a) => a.characterId === viewerCharacter.id)
  const seeVerdicts = viewerIsDm || !viewerStillToRoll

  for (const characterId of request.characterIds) {
    const character = characters.find((c) => c.id === characterId)
    if (!character) continue
    const answer = answers.find((a) => a.characterId === characterId)
    if (!answer) {
      chips[character.ownerId] =
        character.ownerId === viewerId ? { label: 'Your roll', tone: 'gold' } : { label: 'Rolling', tone: 'quiet' }
    } else if (!seeVerdicts) {
      chips[character.ownerId] = { label: 'Rolled', tone: 'pass' }
    } else {
      chips[character.ownerId] = answer.passed ? { label: 'Passed', tone: 'pass' } : { label: 'Failed', tone: 'fail' }
    }
  }

  const dm = members.find((m) => m.role === 'dm')
  if (dm) chips[dm.user_id] = { label: allAnswered(request, answers) ? 'Results in' : 'Waiting', tone: 'quiet' }
  return chips
}

export function allAnswered(request: AskedRoll, answers: Roll[]): boolean {
  return request.characterIds.every((id) => answers.some((a) => a.characterId === id))
}

/** "Everyone makes a Constitution saving throw. 15 or more passes." in three parts, for bold text. */
export function askSentence(names: string[], everyone: boolean, label: string, dc: number) {
  const one = everyone || names.length === 1
  return {
    who: everyone ? 'Everyone' : namesText(names),
    verb: one ? 'makes' : 'make',
    check: aOrAn(label),
    target: `${dc} or more`,
  }
}

/** What the player's result card says underneath. On checks and saves, the total decides. */
export function resultSentence(roll: Pick<Roll, 'kind' | 'natural' | 'total' | 'passed' | 'passedByDice'>): string {
  const passed = roll.passed === true
  const what = roll.kind === 'save' ? 'save' : 'check'
  let words: string
  if (roll.natural === 20) {
    words = passed
      ? `A natural 20! The total still decides, and ${roll.total} is enough.`
      : `A natural 20, but on a ${what} the total still decides: ${roll.total} falls short.`
  } else if (roll.natural === 1) {
    words = passed
      ? `A natural 1, but the total still decides: ${roll.total} is enough.`
      : `A natural 1. The total still decides: ${roll.total} falls short.`
  } else {
    words = passed
      ? `${roll.total} is enough. Well done.`
      : `${roll.total} falls short. The DM decides what happens next.`
  }
  if (roll.passedByDice !== null && roll.passed !== roll.passedByDice) {
    words += passed ? ' The DM turned it into a pass.' : ' The DM turned it into a fail.'
  }
  return words
}

/** The failed answer that came closest, if it missed by 3 or less: worth a thought about overriding. */
export function closestMiss(answers: Roll[], dc: number | null): { roll: Roll; by: number } | null {
  if (dc === null) return null
  const misses = answers
    .filter((roll) => roll.passed === false && roll.passedByDice === false)
    .map((roll) => ({ roll, by: dc - roll.total }))
    .filter((miss) => miss.by > 0 && miss.by <= 3)
    .sort((a, b) => a.by - b.by)
  return misses[0] ?? null
}

/** The verb for putting a condition on someone: "Poison the ones who failed". */
export const CONDITION_VERBS: Record<string, string> = {
  blinded: 'Blind',
  charmed: 'Charm',
  deafened: 'Deafen',
  frightened: 'Frighten',
  grappled: 'Grapple',
  incapacitated: 'Incapacitate',
  invisible: 'Turn invisible',
  paralyzed: 'Paralyse',
  petrified: 'Petrify',
  poisoned: 'Poison',
  prone: 'Knock prone',
  restrained: 'Restrain',
  stunned: 'Stun',
  unconscious: 'Knock out',
}

/** The condition most likely to follow a failed roll of this kind, to save the DM a click. */
export function suggestedCondition(request: Pick<AskedRoll, 'kind' | 'ability'>): string {
  if (request.kind !== 'save') return 'prone'
  return (
    {
      strength: 'prone',
      dexterity: 'prone',
      constitution: 'poisoned',
      intelligence: 'charmed',
      wisdom: 'frightened',
      charisma: 'charmed',
    }[request.ability] ?? 'poisoned'
  )
}
