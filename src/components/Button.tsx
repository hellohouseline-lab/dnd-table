import type { AnchorHTMLAttributes } from 'react'
import { buttonClassName, type ButtonVariant } from './buttonClassName.ts'

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: 'normal' | 'small'
}

/** A link that looks like a button, for moving between screens. */
export function ButtonLink({ variant = 'primary', size, className, ...rest }: ButtonLinkProps) {
  return <a className={buttonClassName(variant, { size, className })} {...rest} />
}
