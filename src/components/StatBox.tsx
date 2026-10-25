import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './StatBox.module.css'

type StatBoxProps = {
  label: string
  value: ReactNode
  /** 'dark' on panels, 'parchment' on parchment cards. */
  tone?: 'dark' | 'parchment'
  title?: string
}

/** A small labelled number, like the AC, SPEED, INIT. and PERCEP. boxes on the character plate. */
export function StatBox({ label, value, tone = 'dark', title }: StatBoxProps) {
  return (
    <div className={cx(styles.box, styles[tone])} title={title}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
    </div>
  )
}
