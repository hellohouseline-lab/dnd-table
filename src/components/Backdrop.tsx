import { useEffect, type ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Backdrop.module.css'

type BackdropProps = {
  /** Closes the pop-up: a click on the dimmed space around it, Escape, or its ✕. */
  onClose: () => void
  /** The dimmed area, placed by the screen (it differs between screens). */
  className?: string
  children: ReactNode
}

/**
 * The dimmed space behind a pop-up. Clicking outside the pop-up, pressing Escape or the ✕ in its
 * corner closes it, so there's always a quick way out.
 */
export function Backdrop({ onClose, className, children }: BackdropProps) {
  useEffect(() => {
    const press = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [onClose])

  return (
    <div
      className={cx(styles.backdrop, className)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.holder}>
        {children}
        <button type="button" className={styles.close} aria-label="Close" title="Close (Esc)" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  )
}
