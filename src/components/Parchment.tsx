import { useId, type ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Parchment.module.css'

type ParchmentProps = {
  title?: string
  /** Adds the small gold flourishes in each corner, as on the roll prompt. */
  corners?: boolean
  children: ReactNode
  className?: string
}

/** The parchment card used for the story column, roll prompts, item cards and lower thirds. */
export function Parchment({ title, corners = false, children, className }: ParchmentProps) {
  const titleId = useId()
  return (
    <section
      className={cx(styles.parchment, corners && styles.withCorners, className)}
      aria-labelledby={title ? titleId : undefined}
    >
      {corners && (
        <>
          <Corner className={styles.topLeft} />
          <Corner className={styles.topRight} />
          <Corner className={styles.bottomLeft} />
          <Corner className={styles.bottomRight} />
        </>
      )}
      {title && (
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

function Corner({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={cx(styles.corner, className)}>
      <path d="M4 44V18C4 10 10 4 18 4h26" />
      <path d="M10 44V22c0-7 5-12 12-12h22" />
      <circle cx="20" cy="20" r="2.5" />
    </svg>
  )
}
