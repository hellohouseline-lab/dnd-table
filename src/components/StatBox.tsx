import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './StatBox.module.css'

type StatBoxProps = {
  label: string
  value: ReactNode
  /** 'dark' on panels, 'parchment' on parchment cards. */
  tone?: 'dark' | 'parchment'
  title?: string
  /** Makes the box a button, such as Init. to roll initiative. */
  onClick?: () => void
  disabled?: boolean
}

/** A small labelled number, like the AC, SPEED, INIT. and PERCEP. boxes on the character plate. */
export function StatBox({ label, value, tone = 'dark', title, onClick, disabled }: StatBoxProps) {
  const inside = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        className={cx(styles.box, styles[tone], styles.button)}
        title={title}
        onClick={onClick}
        disabled={disabled}
      >
        {inside}
      </button>
    )
  }
  return (
    <div className={cx(styles.box, styles[tone])} title={title}>
      {inside}
    </div>
  )
}
