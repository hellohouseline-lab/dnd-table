import type { ReactNode } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { COST_WORDS } from '../../rules/features.ts'
import type { CardDetails } from './cardDetails.ts'
import styles from './CardPanel.module.css'

type CardPanelProps = {
  details: CardDetails
  /** Whether that part of your turn is free now; or why not ("Wait for your turn"). */
  ready: true | string
  /** What to do next: "Click who to attack, on the map or in the turn order". */
  step?: string | null
  /** What's been picked: "Goblin A (15 ft away)". */
  chosen?: string | null
  /** Something that changes the roll: "Disadvantage: beyond normal range". */
  note?: string | null
  /** The button that does it: "Roll the attack", "Cast Fireball", "Rage!". */
  action?: { label: string; onClick: () => void; disabled?: boolean } | null
  /** Pick a different target, or put the area somewhere else. */
  onAgain?: (() => void) | null
  onClose: () => void
  rolling?: boolean
  /** Anything else for this card, such as the spell slot to use. */
  children?: ReactNode
}

/**
 * The side panel a card opens (docs/TABLE_TOOLS_PLAN.md section 1): what it does in plain words,
 * what it costs from your turn, what to do next, and the button that does it. Nothing is rolled
 * until that button is pressed.
 */
export function CardPanel({
  details,
  ready,
  step,
  chosen,
  note,
  action,
  onAgain,
  onClose,
  rolling,
  children,
}: CardPanelProps) {
  return (
    <section className={styles.panel} aria-label={details.title}>
      <div className={styles.head}>
        <div>
          <div className={styles.kind}>{details.kind}</div>
          <h2 className={styles.title}>{details.title}</h2>
        </div>
        <button type="button" className={styles.close} aria-label="Close" title="Close (Esc)" onClick={onClose}>
          ×
        </button>
      </div>
      <ul className={styles.lines}>
        {details.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className={cx(styles.cost, ready !== true && styles.costUsed)}>
        <span className={styles.dot} aria-hidden="true" />
        {COST_WORDS[details.cost]}: {ready === true ? 'ready' : ready}
      </div>
      {children}
      {chosen && (
        <div className={styles.chosen}>
          <span>{chosen}</span>
          {onAgain && (
            <button type="button" className={styles.again} onClick={onAgain}>
              Change
            </button>
          )}
        </div>
      )}
      {note && <p className={styles.note}>{note}</p>}
      {step && !chosen && <p className={styles.step}>{step}</p>}
      {action && (
        <button type="button" className={styles.action} disabled={action.disabled || rolling} onClick={action.onClick}>
          <Icon name="d20" size={18} />
          {action.label}
        </button>
      )}
      {details.more && (
        <details className={styles.more}>
          <summary>The full rules</summary>
          {details.more.split('\n\n').map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </details>
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
