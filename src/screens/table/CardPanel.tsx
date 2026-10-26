import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { COST_WORDS } from '../../rules/features.ts'
import type { CardDetails } from './cardDetails.ts'
import styles from './CardPanel.module.css'

/**
 * What a card does, shown when you hover on it for a few seconds: a parchment card with the title on
 * a banner, four boxes of numbers, what it does as bullet points, and its school and level (or kind)
 * at the foot. Why it can't be played now, if so, is stamped at the bottom.
 */
export function CardInfo({ details, why }: { details: CardDetails; why?: string | null }) {
  return (
    <section
      className={cx(styles.card, styles[details.kind], details.cost === 'bonus' && styles.bonusCost)}
      aria-label={`About ${details.title}`}
      role="tooltip"
    >
      <div className={styles.banner}>
        <span className={styles.medallion}>
          <Icon name={details.icon} size={22} />
        </span>
        <h2 className={styles.title}>{details.title}</h2>
        {details.concentration && <span className={styles.concTag}>Concentration</span>}
      </div>
      {details.stats.length > 0 && (
        <dl className={styles.stats}>
          {details.stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className={styles.bullets}>
        {details.bullets.map((bullet, i) => (
          <li key={`${i}-${bullet.slice(0, 24)}`}>{bullet}</li>
        ))}
      </ul>
      <div className={cx(styles.takes, why && styles.takesNot)}>
        <span className={styles.dot} aria-hidden="true" />
        {COST_WORDS[details.cost]}
        {why ? `: ${why}` : ''}
      </div>
      <div className={styles.foot}>
        <span>{details.footer[0]}</span>
        {details.footer[1] && <span>{details.footer[1]}</span>}
      </div>
    </section>
  )
}

/** After using a feature: what happened, with Undo for a while. Without onUndo, just a notice. */
export function UndoChip({ text, onUndo, onClose }: { text: string; onUndo?: () => void; onClose: () => void }) {
  return (
    <div className={styles.undo} role="status">
      <span>{text}</span>
      {onUndo && (
        <button type="button" className={styles.again} onClick={onUndo}>
          Undo
        </button>
      )}
      <button type="button" className={styles.closeSmall} aria-label="Close" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
