import { cx } from './cx.ts'
import styles from './Pips.module.css'

type PipsProps = {
  /** What the pips count, for screen readers: "Second Wind uses". */
  label: string
  total: number
  /** How many are filled in. */
  filled: number
  /** Leave out to show the pips without letting them be clicked. */
  onChange?: (filled: number) => void
  tone?: 'gold' | 'pass' | 'fail'
}

/**
 * A row of circles for anything counted in uses: feature uses, spell slots, hit dice, death saves.
 * Clicking a filled circle empties it and those after it; clicking an empty one fills up to it.
 */
export function Pips({ label, total, filled, onChange, tone = 'gold' }: PipsProps) {
  if (total <= 0) return null
  return (
    <span className={styles.pips} role="group" aria-label={`${label}: ${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < filled
        const className = cx(styles.pip, styles[tone], on && styles.on)
        return onChange ? (
          <button
            key={i}
            type="button"
            className={className}
            aria-label={`${label} ${i + 1} of ${total}`}
            aria-pressed={on}
            onClick={() => onChange(on ? i : i + 1)}
          />
        ) : (
          <span key={i} className={className} />
        )
      })}
    </span>
  )
}
