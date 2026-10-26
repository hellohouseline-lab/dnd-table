import { cx } from '../../components/cx.ts'
import { COST_WORDS } from '../../rules/features.ts'
import type { CardDetails } from './cardDetails.ts'
import styles from './CardPanel.module.css'

/**
 * What a card does, shown when you hover on it for a few seconds: its numbers in plain words, what it
 * costs from your turn, why it can't be played now (if so), and the full rules text.
 */
export function CardInfo({ details, why }: { details: CardDetails; why?: string | null }) {
  return (
    <section className={styles.panel} aria-label={`About ${details.title}`} role="tooltip">
      <div className={styles.kind}>{details.kind}</div>
      <h2 className={styles.title}>{details.title}</h2>
      <ul className={styles.lines}>
        {details.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className={cx(styles.cost, why && styles.costUsed)}>
        <span className={styles.dot} aria-hidden="true" />
        {COST_WORDS[details.cost]}
        {why ? `: ${why}` : ''}
      </div>
      {details.more && (
        <div className={styles.rules}>
          {details.more.split('\n\n').map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
      )}
    </section>
  )
}

/** After using a feature: what happened, with Undo for a while. */
export function UndoChip({ text, onUndo, onClose }: { text: string; onUndo: () => void; onClose: () => void }) {
  return (
    <div className={styles.undo} role="status">
      <span>{text}</span>
      <button type="button" className={styles.again} onClick={onUndo}>
        Undo
      </button>
      <button type="button" className={styles.closeSmall} aria-label="Close" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
