import { useCallback, useState } from 'react'
import { useRollInserts } from './campaignChannel.ts'
import { listRolls, type Roll } from './rolls.ts'
import { useLoad } from './useLoad.ts'

export type RollLogState = { status: 'loading' | 'ready' | 'error'; rolls: Roll[]; message?: string }

/** The table's latest rolls, newest first, with new ones added as they're thrown. */
export function useRollLog(campaignId: string, userId: string): RollLogState {
  const loaded = useLoad(() => listRolls(campaignId), [campaignId])
  const [fresh, setFresh] = useState<Roll[]>([])

  const add = useCallback((roll: Roll) => {
    setFresh((list) => (list.some((r) => r.id === roll.id) ? list : [roll, ...list]))
  }, [])
  useRollInserts(campaignId, userId, add)

  if (loaded.status === 'error') return { status: 'error', rolls: fresh, message: loaded.message }
  if (loaded.status === 'loading') return { status: 'loading', rolls: fresh }
  const older = loaded.data.filter((roll) => !fresh.some((r) => r.id === roll.id))
  return { status: 'ready', rolls: [...fresh, ...older] }
}
