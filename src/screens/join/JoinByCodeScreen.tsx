import { useEffect, useState, type FormEvent } from 'react'
import { href, navigate } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { TextField } from '../../components/Field.tsx'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Parchment } from '../../components/Parchment.tsx'
import { SiteFooter } from '../../components/SiteFooter.tsx'
import { joinCampaign, peekCampaign, type CampaignPeek } from '../../live/campaigns.ts'
import { messageFor } from '../../live/errors.ts'
import { isJoinCode, normaliseJoinCode } from '../../live/joinCode.ts'
import { useLoad } from '../../live/useLoad.ts'
import { describeParty } from '../campaign/describeParty.ts'
import styles from './JoinByCodeScreen.module.css'

/** Where an invite link or a typed code lands: shows which table it opens, then joins it. */
export function JoinByCodeScreen({ code: rawCode }: { code: string }) {
  const code = normaliseJoinCode(rawCode)
  const peek = useLoad(() => (isJoinCode(code) ? peekCampaign(code) : Promise.resolve(null)), [code])

  // Already at this table: go straight there.
  const alreadyAt = peek.status === 'ready' ? peek.data?.campaignId : null
  useEffect(() => {
    if (alreadyAt) navigate(`/c/${alreadyAt}`, { replace: true })
  }, [alreadyAt])

  if (peek.status === 'loading' || alreadyAt) return <LoadingScreen label="Finding the table…" />

  return (
    <Page width="narrow">
      <PageHeader eyebrow="You've been invited" title="Join a table" />
      {peek.status === 'error' && <Notice tone="error">{peek.message}</Notice>}
      {peek.status === 'ready' && peek.data && <JoinForm code={code} table={peek.data} />}
      {peek.status === 'ready' && !peek.data && <WrongCode code={code} />}
      <SiteFooter />
    </Page>
  )
}

function JoinForm({ code, table }: { code: string; table: CampaignPeek }) {
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join(event: FormEvent) {
    event.preventDefault()
    setJoining(true)
    setError(null)
    try {
      const campaignId = await joinCampaign(code, name)
      navigate(`/c/${campaignId}`, { replace: true })
    } catch (caught) {
      setError(messageFor(caught))
      setJoining(false)
    }
  }

  return (
    <Parchment corners className={styles.card}>
      <div className={styles.eyebrow}>This code opens</div>
      <h2 className={styles.tableName}>{table.name}</h2>
      <p className={styles.party}>{describeParty(table.partySize, table.dmName, table.startingLevel)}</p>
      <form className={styles.form} onSubmit={(event) => void join(event)}>
        <label className={styles.label} htmlFor="display-name">
          What should the table call you?
        </label>
        <input
          id="display-name"
          className={styles.input}
          aria-describedby="display-name-hint"
          autoComplete="nickname"
          placeholder="Your first name or nickname"
          required
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div id="display-name-hint" className={styles.hint}>
          Your character comes next. This is the name the DM and other players see for you.
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button type="submit" className={buttonClassName('ink')} disabled={joining}>
          {joining ? 'Joining…' : 'Join the table'}
        </button>
      </form>
    </Parchment>
  )
}

function WrongCode({ code }: { code: string }) {
  const [typed, setTyped] = useState('')

  function retry(event: FormEvent) {
    event.preventDefault()
    navigate(`/join/${normaliseJoinCode(typed)}`, { replace: true })
  }

  return (
    <Panel title={isJoinCode(code) ? "That code doesn't match a table" : "That doesn't look like a join code"}>
      <p>
        {isJoinCode(code)
          ? 'Check it with your DM. If they made a new code, the old one and its link stop working.'
          : 'Join codes are six letters and numbers, like K7QM2P.'}
      </p>
      <form className={styles.retry} onSubmit={retry}>
        <TextField
          label="Try another code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
        <button type="submit" className={buttonClassName('primary', { size: 'small' })}>
          Join
        </button>
      </form>
      <ButtonLink href={href('/')} variant="quiet">
        Back to your tables
      </ButtonLink>
    </Panel>
  )
}
