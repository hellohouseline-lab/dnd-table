import { useCallback, useEffect, useState } from 'react'
import { useRollChanges, useRollInserts } from './campaignChannel.ts'
import { messageFor } from './errors.ts'
import { listRolls, nameRoll, type Roll } from './rolls.ts'

type Naming = Parameters<typeof nameRoll>[1]
type Judged = Parameters<typeof nameRoll>[2]

export type RollsForDmControls = {
  /** Plain d20s players rolled for the DM, oldest first, waiting to be named. */
  rolls: Roll[]
  /** Says what a roll was, and maybe judges it; with no naming, lets it go. */
  settle: (roll: Roll, naming: Naming, judged?: Judged) => void
  error: string | null
}

/** The DM's queue of rolls for the DM, kept up to date live. */
export function useRollsForDm(campaignId: string, userId: string): RollsForDmControls {
  const [rolls, setRolls] = useState<Roll[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listRolls(campaignId).then(
      (list) => live && setRolls(list.filter((r) => r.forDm).reverse()),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    return () => {
      live = false
    }
  }, [campaignId])

  const onInsert = useCallback((roll: Roll) => {
    if (roll.forDm) setRolls((now) => (now.some((r) => r.id === roll.id) ? now : [...now, roll]))
  }, [])
  const onChange = useCallback((roll: Roll) => {
    if (!roll.forDm) setRolls((now) => now.filter((r) => r.id !== roll.id))
  }, [])
  useRollInserts(campaignId, userId, onInsert)
  useRollChanges(campaignId, userId, onChange)

  const settle = useCallback((roll: Roll, naming: Naming, judged: Judged = null) => {
    setError(null)
    setRolls((now) => now.filter((r) => r.id !== roll.id))
    nameRoll(roll.id, naming, judged).catch((caught: unknown) => {
      setRolls((now) => [...now, roll])
      setError(messageFor(caught))
    })
  }, [])

  return { rolls, settle, error }
}
