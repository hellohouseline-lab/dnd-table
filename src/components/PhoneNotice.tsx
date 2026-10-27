import { useEffect, useState } from 'react'
import { buttonClassName } from './buttonClassName.ts'
import { Parchment } from './Parchment.tsx'
import styles from './PhoneNotice.module.css'

const SMALL = '(max-width: 899px)'
const DISMISSED = 'phone-notice-dismissed'

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED) === 'yes'
  } catch {
    return false
  }
}

/** On a phone, the table and DM screens say they're made for a computer, and let you carry on anyway. */
export function PhoneNotice() {
  const [small, setSmall] = useState(() => window.matchMedia?.(SMALL).matches ?? false)
  const [dismissed, setDismissed] = useState(readDismissed)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const query = window.matchMedia?.(SMALL)
    if (!query) return
    const change = () => setSmall(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  if (!small || dismissed) return null

  function carryOn() {
    try {
      sessionStorage.setItem(DISMISSED, 'yes')
    } catch {
      // Private browsing: it just shows again next time.
    }
    setDismissed(true)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Best on a computer">
      <Parchment title="Best on a computer" corners className={styles.card}>
        <p>This table is made for a bigger screen, so on a phone it gets squashed and hard to use.</p>
        <p>To play, open this page on a laptop or computer and sign in with the same email.</p>
        <div className={styles.buttons}>
          <button type="button" className={buttonClassName('ink')} onClick={() => void copyLink()}>
            {copied ? 'Link copied' : 'Copy this link'}
          </button>
          <button type="button" className={buttonClassName('quietInk')} onClick={carryOn}>
            Carry on anyway
          </button>
        </div>
      </Parchment>
    </div>
  )
}
