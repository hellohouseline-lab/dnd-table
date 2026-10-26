import { cx } from './cx.ts'
import styles from './ReadAloud.module.css'

type ReadAloudProps = {
  text: string
  className?: string
  /** For the DM: takes it off the stage. */
  onClose?: () => void
}

/** A scene's read-aloud on parchment, on the stage for everyone when the DM shows it. */
export function ReadAloud({ text, className, onClose }: ReadAloudProps) {
  return (
    <section className={cx(styles.card, className)} aria-label="Read aloud">
      <div className={styles.text}>
        {text.split(/\n{2,}/).map((part, i) => (
          <p key={i}>{part}</p>
        ))}
      </div>
      {onClose && (
        <button type="button" className={styles.close} onClick={onClose}>
          Take it off the stage
        </button>
      )}
    </section>
  )
}
