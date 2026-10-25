import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Notice.module.css'

type NoticeProps = { tone?: 'info' | 'error' | 'success'; children: ReactNode }

/** A short message in a box: what went wrong, or that something worked. */
export function Notice({ tone = 'info', children }: NoticeProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx(styles.notice, styles[tone])}>
      {children}
    </div>
  )
}
