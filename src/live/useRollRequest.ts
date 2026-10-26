import { useCallback, useEffect, useRef, useState } from 'react'
import { useRequestChanges, useRollChanges, useRollInserts } from './campaignChannel.ts'
import { messageFor } from './errors.ts'
import {
  acceptDice,
  askForRoll,
  closeRequest,
  getOpenRequest,
  getSecretDc,
  listAnswers,
  overrideRoll,
  type AskedRoll,
  type AskInput,
} from './rollRequests.ts'
import type { Roll } from './rolls.ts'

/** The DM's open request for a roll and the answers so far, with what the DM can do about it. */
export type RequestControls = {
  request: AskedRoll | null
  answers: Roll[]
  /** For the DM, the DC; for players, the DC only if the DM showed it. */
  dc: number | null
  error: string | null
  /** DM: sends a request. Resolves true once it's sent. */
  ask: (input: AskInput) => Promise<boolean>
  /** DM: rules an answer a pass or a fail (answers wait for this before players see a verdict). */
  override: (roll: Roll, passed: boolean) => void
  /** DM: goes with the dice for every answer not yet ruled on. */
  accept: () => void
  /** DM: "Done, play on". */
  close: () => void
  /** An answer just thrown here, shown before it comes back on the live channel. */
  putAnswer: (roll: Roll) => void
}

function withAnswer(answers: Roll[], roll: Roll): Roll[] {
  return answers.some((r) => r.id === roll.id) ? answers.map((r) => (r.id === roll.id ? roll : r)) : [...answers, roll]
}

/** Follows the table's open request live: new requests, answers, the DM's changes and closing. */
export function useRollRequest(campaignId: string, userId: string, isDm: boolean): RequestControls {
  const [request, setRequest] = useState<AskedRoll | null>(null)
  // Answers and the DC belong to one request; anything kept for an older one is ignored.
  const [answerState, setAnswerState] = useState<{ requestId: string | null; list: Roll[] }>({
    requestId: null,
    list: [],
  })
  const [secret, setSecret] = useState<{ requestId: string; dc: number | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<string | null>(null)
  const requestId = request?.id ?? null
  const answers = answerState.requestId === requestId ? answerState.list : []
  const secretDc = secret && secret.requestId === requestId ? secret.dc : null

  useEffect(() => {
    current.current = requestId
  }, [requestId])

  useEffect(() => {
    let live = true
    getOpenRequest(campaignId).then(
      (open) => live && setRequest((now) => now ?? open),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    return () => {
      live = false
    }
  }, [campaignId])

  // A new request: fetch its answers so far, and the DC for the DM.
  useEffect(() => {
    if (!requestId) return
    let live = true
    listAnswers(requestId).then(
      (list) =>
        live &&
        setAnswerState((now) => ({
          requestId,
          list: list.reduce(withAnswer, now.requestId === requestId ? now.list : []),
        })),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    if (isDm) {
      getSecretDc(requestId).then(
        (dc) => live && setSecret({ requestId, dc }),
        (caught: unknown) => live && setError(messageFor(caught)),
      )
    }
    return () => {
      live = false
    }
  }, [requestId, isDm])

  const onRequest = useCallback((changed: AskedRoll) => {
    if (changed.status === 'open') setRequest(changed)
    else setRequest((now) => (now?.id === changed.id ? null : now))
  }, [])
  useRequestChanges(campaignId, userId, onRequest)

  const putAnswer = useCallback((roll: Roll) => {
    const id = roll.requestId
    if (!id || id !== current.current) return
    setAnswerState((now) => ({ requestId: id, list: withAnswer(now.requestId === id ? now.list : [], roll) }))
  }, [])
  useRollInserts(campaignId, userId, putAnswer)
  useRollChanges(campaignId, userId, putAnswer)

  const ask = useCallback(
    async (input: AskInput) => {
      setError(null)
      try {
        const sent = await askForRoll(campaignId, input)
        current.current = sent.id
        setRequest(sent)
        setSecret({ requestId: sent.id, dc: input.dc })
        return true
      } catch (caught) {
        setError(messageFor(caught))
        return false
      }
    },
    [campaignId],
  )

  const override = useCallback(
    (roll: Roll, passed: boolean) => {
      setError(null)
      putAnswer({ ...roll, passed })
      overrideRoll(roll.id, passed).then(putAnswer, (caught: unknown) => {
        putAnswer(roll)
        setError(messageFor(caught))
      })
    },
    [putAnswer],
  )

  const accept = useCallback(() => {
    if (!requestId) return
    setError(null)
    acceptDice(requestId).then(
      (ruled) => ruled.forEach(putAnswer),
      (caught: unknown) => setError(messageFor(caught)),
    )
  }, [requestId, putAnswer])

  const close = useCallback(() => {
    if (!requestId) return
    setError(null)
    setRequest(null)
    closeRequest(requestId).catch((caught: unknown) => setError(messageFor(caught)))
  }, [requestId])

  return {
    request,
    answers,
    dc: isDm ? (secretDc ?? request?.shownDc ?? null) : (request?.shownDc ?? null),
    error,
    ask,
    override,
    accept,
    close,
    putAnswer,
  }
}
