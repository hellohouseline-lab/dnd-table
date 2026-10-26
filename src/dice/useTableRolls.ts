import { useCallback, useRef, useState } from 'react'
import { useRollInserts } from '../live/campaignChannel.ts'
import { messageFor } from '../live/errors.ts'
import { throwDice as throwOnServer, type Roll } from '../live/rolls.ts'
import type { RollRequest } from '../rules/dice.ts'
import type { TrayThrow } from './diceTray.ts'

/** How long a result card stays up, and how many show at once. */
const SHOWN_MS = 8000
const MAX_SHOWN = 3

export type TableRolls = {
  /** Throws the dice on the server. Resolves with the roll, or null if it failed (see `error`). */
  roll: (request: RollRequest) => Promise<Roll | null>
  /** Throws some other way, such as an attack settled on the server, and shows it like any roll. */
  rollWith: (work: () => Promise<Roll>) => Promise<Roll | null>
  /** Throws and shows a roll made in this browser only, such as a practice throw. */
  showLocal: (roll: Roll) => void
  /** The result cards showing now, oldest first. */
  shown: Roll[]
  dismiss: (id: string) => void
  rolling: boolean
  error: string | null
}

type Options = {
  campaignId: string
  userId: string
  throwDice: (dice: TrayThrow) => Promise<void>
  /** How to throw: the server unless given another way (the dev previews throw in the browser). */
  thrower?: (request: RollRequest) => Promise<Roll>
  /** Called once a roll's dice have landed, as its result card shows. */
  onLanded?: (roll: Roll) => void
}

/**
 * Everyone's rolls at this table, as they happen: your own the moment the server answers, everyone
 * else's as they arrive. Each one is thrown in the dice tray, then its result card shows.
 */
export function useTableRolls({ campaignId, userId, throwDice, thrower, onLanded }: Options): TableRolls {
  const [shown, setShown] = useState<Roll[]>([])
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Your own rolls come back twice, from the server and on the live channel: show each once.
  const seen = useRef(new Set<string>())

  const dismiss = useCallback((id: string) => setShown((list) => list.filter((roll) => roll.id !== id)), [])

  const present = useCallback(
    (roll: Roll) => {
      if (seen.current.has(roll.id)) return
      seen.current.add(roll.id)
      void throwDice({ dice: [...roll.dice, ...(roll.damage?.dice ?? [])], style: roll.style }).then(() => {
        setShown((list) => [...list.filter((r) => r.id !== roll.id), roll].slice(-MAX_SHOWN))
        setTimeout(() => dismiss(roll.id), SHOWN_MS)
        onLanded?.(roll)
      })
    },
    [throwDice, dismiss, onLanded],
  )

  useRollInserts(campaignId, userId, present)

  const rollWith = useCallback(
    async (work: () => Promise<Roll>) => {
      setError(null)
      setRolling(true)
      try {
        const result = await work()
        present(result)
        return result
      } catch (caught) {
        setError(messageFor(caught))
        return null
      } finally {
        setRolling(false)
      }
    },
    [present],
  )

  const roll = useCallback(
    (request: RollRequest) => rollWith(() => (thrower ? thrower(request) : throwOnServer(campaignId, request))),
    [campaignId, thrower, rollWith],
  )

  return { roll, rollWith, showLocal: present, shown, dismiss, rolling, error }
}
