import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Page.module.css'

type PageProps = {
  /** 'wide' for two-column screens like Join, 'narrow' for reading pages like Credits. */
  width?: 'wide' | 'narrow'
  children: ReactNode
}

/** The centred, scrolling layout used by screens that aren't full-screen (Join, Credits). */
export function Page({ width = 'wide', children }: PageProps) {
  return (
    <main className={styles.page}>
      <div className={cx(styles.inner, styles[width])}>{children}</div>
    </main>
  )
}
