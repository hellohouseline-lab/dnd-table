import type { AnchorHTMLAttributes } from 'react'
import { buttonClassName, type ButtonVariant } from './buttonClassName.ts'

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant }

/** A link that looks like a button, for moving between screens. */
export function ButtonLink({ variant = 'primary', className, ...rest }: ButtonLinkProps) {
  return <a className={buttonClassName(variant, className)} {...rest} />
}
