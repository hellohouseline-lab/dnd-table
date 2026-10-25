import { cx } from './cx.ts'
import styles from './Button.module.css'

/** 'primary' is the gold fill, 'outline' the gold border, 'ink' the dark button used on parchment. */
export type ButtonVariant = 'primary' | 'outline' | 'ink'

/** The button look, for plain <button>s and for ButtonLink. */
export function buttonClassName(variant: ButtonVariant, className?: string): string {
  return cx(styles.button, styles[variant], className)
}
