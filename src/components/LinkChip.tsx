import { useLinkDown } from '../live/campaignChannel.ts'
import styles from './LinkChip.module.css'

/**
 * "Reconnecting…" at the top of a table's screens while its live connection is down, so nobody
 * thinks the game has frozen. The app catches up by itself when the connection returns.
 */
export function LinkChip({ campaignId, userId }: { campaignId: string; userId: string }) {
  const down = useLinkDown(campaignId, userId)
  if (!down) return null
  return (
    <div className={styles.chip} role="status">
      <span className={styles.dot} aria-hidden="true" />
      Reconnecting… What you see may be a little behind. It catches up by itself.
    </div>
  )
}
