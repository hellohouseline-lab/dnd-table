// Local development only: a stand-in for the DM's roll requests in the design previews, with no
// database. Made-up players answer a request a moment after it's sent.

import { useCallback, useEffect, useRef, useState } from 'react'
import { localRoll } from '../../dice/localRoll.ts'
import { DEFAULT_DICE_STYLE, parseDiceStyle } from '../../dice/style.ts'
import type { AskedRoll } from '../../live/rollRequests.ts'
import type { Roll } from '../../live/rolls.ts'
import type { RequestControls } from '../../live/useRollRequest.ts'
import { findAskable, passes } from '../../rules/askable.ts'
import type { Character } from '../../rules/character.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { answerRoll } from '../../rules/rolls.ts'
import { sampleMembers } from './sampleData.ts'

let made = 0

/** A Constitution save asked of the given characters, with a secret DC of 15. */
export function previewRequest(characterIds: string[]): AskedRoll {
  const askable = findAskable('save:constitution')
  made += 1
  return {
    id: `preview-request-${made}`,
    campaignId: 'preview',
    kind: 'save',
    ability: 'constitution',
    skill: null,
    label: askable?.label ?? 'Constitution saving throw',
    plain: askable?.plain ?? '',
    characterIds,
    shownDc: null,
    outcomeShown: true,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
}

/** A made-up answer from a character's player, judged against the DC. */
export function previewAnswer(character: Character, request: AskedRoll, dc: number): Roll {
  const owner = sampleMembers.find((m) => m.user_id === character.ownerId)
  const roll = localRoll(answerRoll(character, request), {
    campaignId: 'preview',
    rollerId: character.ownerId,
    style: owner ? parseDiceStyle(owner.dice_style) : DEFAULT_DICE_STYLE,
  })
  void dc
  // Like the server, the answer waits for the DM's ruling.
  return { ...roll, passed: null, passedByDice: null }
}

/** Judges a preview throw that answers a request, as the server would. */
export function judgePreview(roll: Roll, request: RollRequest, dc: number): Roll {
  if (!request.requestId) return roll
  void dc
  return { ...roll, passed: null, passedByDice: null }
}

export function usePreviewAsking(
  characters: Character[],
  options: { start?: AskedRoll | null; startAnswers?: Roll[]; answerFor?: string[] } = {},
): RequestControls {
  const [request, setRequest] = useState<AskedRoll | null>(options.start ?? null)
  const [answers, setAnswers] = useState<Roll[]>(options.startAnswers ?? [])
  const [dc, setDc] = useState(15)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const putAnswer = useCallback((roll: Roll) => {
    setAnswers((now) =>
      now.some((r) => r.id === roll.id) ? now.map((r) => (r.id === roll.id ? roll : r)) : [...now, roll],
    )
  }, [])

  const ask = useCallback(
    async ({ askable, characterIds, dc: target, outcomeShown }: Parameters<RequestControls['ask']>[0]) => {
      const sent: AskedRoll = {
        ...previewRequest(characterIds),
        kind: askable.kind,
        ability: askable.ability,
        skill: askable.skill,
        label: askable.label,
        plain: askable.plain,
        shownDc: null,
        outcomeShown: outcomeShown ?? true,
      }
      setRequest(sent)
      setAnswers([])
      setDc(target)
      // The made-up players answer one after another.
      characters
        .filter((c) => characterIds.includes(c.id) && (options.answerFor ?? []).includes(c.id))
        .forEach((character, i) => {
          timers.current.push(setTimeout(() => putAnswer(previewAnswer(character, sent, target)), 1500 * (i + 1)))
        })
      return true
    },
    [characters, options.answerFor, putAnswer],
  )

  return {
    request,
    answers,
    dc: request ? dc : null,
    error: null,
    ask,
    override: (roll, passed) => putAnswer({ ...roll, passed, passedByDice: passes(roll.total, dc) }),
    accept: () =>
      setAnswers((now) =>
        now.map((roll) =>
          roll.passed === null && roll.requestId
            ? { ...roll, passed: passes(roll.total, dc), passedByDice: passes(roll.total, dc) }
            : roll,
        ),
      ),
    close: () => setRequest(null),
    putAnswer,
  }
}
