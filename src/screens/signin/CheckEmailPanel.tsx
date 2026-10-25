import { useState, type FormEvent } from 'react'
import { signInWithCode } from '../../app/authActions.ts'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { TextField } from '../../components/Field.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Panel } from '../../components/Panel.tsx'
import { messageFor } from '../../live/errors.ts'
import { isLoginCode, normaliseLoginCode } from '../../live/loginLinks.ts'
import styles from './SignInScreen.module.css'

type CheckEmailPanelProps = {
  email: string
  onDifferentEmail: () => void
}

/**
 * After the login email has gone: click its link on this device, or type its code here when the
 * email was opened somewhere else. Signing in swaps this screen for the one the person wanted.
 */
export function CheckEmailPanel({ email, onDifferentEmail }: CheckEmailPanelProps) {
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setChecking(true)
    setError(null)
    try {
      await signInWithCode(email, code)
    } catch (caught) {
      setError(messageFor(caught))
      setChecking(false)
    }
  }

  return (
    <Panel title="Check your email" className={styles.panel}>
      <p>
        We&rsquo;ve sent a login email to <strong>{email}</strong>. It can take a minute to arrive. If it doesn&rsquo;t,
        look in your spam folder.
      </p>
      <p>
        <strong>Reading it on this computer?</strong> Click the link in the email and you&rsquo;ll come straight back
        here, signed in.
      </p>
      <form className={styles.form} onSubmit={(event) => void signIn(event)}>
        <p>
          <strong>Reading it on your phone or another device?</strong> Type the code from the email here instead.
        </p>
        <TextField
          label="Code from the email"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={14}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          style={{ fontSize: 24, letterSpacing: '0.3em' }}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <button
          type="submit"
          className={buttonClassName('primary')}
          disabled={checking || !isLoginCode(normaliseLoginCode(code))}
        >
          {checking ? 'Checking…' : 'Sign in with the code'}
        </button>
      </form>
      <div>
        <button type="button" className={buttonClassName('quiet')} onClick={onDifferentEmail}>
          Use a different email
        </button>
      </div>
    </Panel>
  )
}
