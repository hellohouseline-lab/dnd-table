import { signOut } from '../app/authActions.ts'
import { useAuth } from '../app/authContext.ts'
import { href, useHashPath } from '../app/router.ts'
import { ButtonLink } from './Button.tsx'
import { buttonClassName } from './buttonClassName.ts'
import styles from './AccountBar.module.css'

/**
 * Top right of every page-style screen once signed in: back to your tables, and Sign out.
 * Your email isn't shown here, so it can't end up on someone's stream.
 */
export function AccountBar() {
  const signedIn = useAuth().status === 'signedIn'
  const path = useHashPath()
  if (!signedIn) return null

  return (
    <nav className={styles.bar} aria-label="Your account">
      {path !== '/' && (
        <ButtonLink href={href('/')} variant="quiet">
          Your tables
        </ButtonLink>
      )}
      <button type="button" className={buttonClassName('outline', { size: 'small' })} onClick={() => void signOut()}>
        Sign out
      </button>
    </nav>
  )
}
