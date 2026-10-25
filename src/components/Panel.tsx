import { useId, type ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Panel.module.css'

type PanelProps = {
  title?: string
  children: ReactNode
  className?: string
}

/** The dark panel with a double gold rule, used for most boxes on dark screens and over the scene. */
export function Panel({ title, children, className }: PanelProps) {
  const titleId = useId()
  return (
    <section className={cx(styles.panel, className)} aria-labelledby={title ? titleId : undefined}>
      {title && (
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
