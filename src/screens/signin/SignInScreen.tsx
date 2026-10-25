import { useState, type FormEvent } from 'react'
import { sendLoginLink } from '../../app/authActions.ts'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { TextField } from '../../components/Field.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Panel } from '../../components/Panel.tsx'
import { SiteFooter } from '../../components/SiteFooter.tsx'
import { messageFor } from '../../live/errors.ts'
import { CheckEmailPanel } from './CheckEmailPanel.tsx'
import styles from './SignInScreen.module.css'

type SignInScreenProps = {
  /** The screen to open after signing in. */
  next: string
  /** Why the last login link failed, if it did. */
  loginError: string | null
}

/** Shown in place of any signed-in screen until the person has signed in with an email link. */
export function SignInScreen({ next, loginError }: SignInScreenProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(loginError)
  const invited = next.startsWith('/join/')

  async function send(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      await sendLoginLink(email, next)
      setSentTo(email.trim())
    } catch (caught) {
      setError(messageFor(caught))
    } finally {
      setSending(false)
    }
  }

  return (
    <Page width="narrow">
      <PageHeader
        eyebrow={invited ? "You've been invited to a table" : 'Take your seat at the table'}
        title="D&D Table"
        subtitle="A private table for one party · 2014 rules"
      />

      {sentTo ? (
        <CheckEmailPanel email={sentTo} onDifferentEmail={() => setSentTo(null)} />
      ) : (
        <Panel title="Sign in" className={styles.panel}>
          <form className={styles.form} onSubmit={(event) => void send(event)}>
            <p>
              {invited ? 'Sign in first, then you can join the table. ' : ''}
              Type your email and we&rsquo;ll send you a link to sign in. No password needed.
            </p>
            {error && <Notice tone="error">{error}</Notice>}
            <TextField
              label="Your email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="submit" className={buttonClassName('primary')} disabled={sending}>
              {sending ? 'Sending…' : 'Send my login link'}
            </button>
          </form>
        </Panel>
      )}

      <SiteFooter />
    </Page>
  )
}
