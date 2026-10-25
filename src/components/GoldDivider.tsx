import { cx } from './cx.ts'
import styles from './GoldDivider.module.css'

type GoldDividerProps = {
  /** 'gold' for dark screens, 'ink' for parchment. */
  tone?: 'gold' | 'ink'
  width?: number | string
}

/** A thin rule with a diamond in the middle, used under headings. */
export function GoldDivider({ tone = 'gold', width = 360 }: GoldDividerProps) {
  return (
    <div className={cx(styles.divider, tone === 'ink' && styles.ink)} style={{ width }} aria-hidden="true">
      <span className={styles.line} />
      <span className={styles.diamond} />
      <span className={styles.line} />
    </div>
  )
}
