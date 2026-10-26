import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import type { RollMode } from '../../rules/dice.ts'
import styles from './CheckPanel.module.css'

type CheckPanelProps = {
  mode: RollMode
  onModeChange: (mode: RollMode) => void
  /** Throws a plain d20 for the DM, who says what it was for. */
  onRoll: () => void
  disabled?: boolean
}

const MODES: { mode: RollMode; label: string }[] = [
  { mode: 'advantage', label: 'Advantage' },
  { mode: 'normal', label: 'Normal' },
  { mode: 'disadvantage', label: 'Disadvantage' },
]

/**
 * The Checks set in the hand, outside a fight: when the DM says "roll for me", the player picks
 * advantage, normal or disadvantage and rolls a d20. They don't choose what it's for: the DM does,
 * which adds the right bonus, and may say whether it passed.
 */
export function CheckPanel({ mode, onModeChange, onRoll, disabled }: CheckPanelProps) {
  return (
    <section className={styles.panel} aria-label="Roll for the DM">
      <div className={styles.top}>
        <span className={styles.title}>Roll for the DM</span>
        <div className={styles.modes} role="group" aria-label="How to roll">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              className={cx(styles.mode, mode === m.mode && styles.modeOn, styles[m.mode])}
              aria-pressed={mode === m.mode}
              onClick={() => onModeChange(m.mode)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className={styles.roll} disabled={disabled} onClick={onRoll}>
        <Icon name="d20" size={22} />
        Roll a d20{mode !== 'normal' ? ` with ${mode}` : ''}
      </button>
      <p className={styles.note}>
        When the DM asks you to roll, roll here. The DM says what it&rsquo;s for, adds your bonus and tells you how it
        went.
      </p>
    </section>
  )
}
