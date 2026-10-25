import { cx } from './cx.ts'
import styles from './Button.module.css'

/**
 * 'primary' is the gold fill, 'outline' the gold border, 'ink' the dark button used on parchment.
 * 'quiet' and 'quietInk' look like links, for small secondary actions on dark and on parchment.
 */
export type ButtonVariant = 'primary' | 'outline' | 'ink' | 'quiet' | 'quietInk'

type ButtonOptions = { size?: 'normal' | 'small'; className?: string }

/** The button look, for plain <button>s and for ButtonLink. */
export function buttonClassName(variant: ButtonVariant, { size = 'normal', className }: ButtonOptions = {}): string {
  return cx(styles.button, styles[variant], size === 'small' && styles.small, className)
}
