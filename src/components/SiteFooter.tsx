import { useAuth } from '../app/authContext.ts'
import { href } from '../app/router.ts'
import styles from './SiteFooter.module.css'

/** Links at the bottom of every page-style screen. Sign out lives in the AccountBar at the top. */
export function SiteFooter() {
  const signedIn = useAuth().status === 'signedIn'
  return (
    <footer className={styles.footer}>
      <nav className={styles.links} aria-label="More">
        {signedIn && <a href={href('/')}>Your tables</a>}
        <a href={href('/progress')}>Build progress</a>
        <a href={href('/credits')}>Credits</a>
      </nav>
      <p className={styles.note}>An unofficial fan project, not made or endorsed by Wizards of the Coast.</p>
    </footer>
  )
}
