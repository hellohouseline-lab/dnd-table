import { useState, type FormEvent } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { href, navigate } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { TextField } from '../../components/Field.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Panel } from '../../components/Panel.tsx'
import { SiteFooter } from '../../components/SiteFooter.tsx'
import { listMyCampaigns } from '../../live/campaigns.ts'
import { normaliseJoinCode } from '../../live/joinCode.ts'
import { useLoad } from '../../live/useLoad.ts'
import columns from '../columns.module.css'
import styles from './TablesScreen.module.css'

/** Home once signed in: the campaigns you're at, joining with a code, and starting a campaign. */
export function TablesScreen() {
  const user = useSignedInUser()
  const campaigns = useLoad(() => listMyCampaigns(user.id), [user.id])
  const [code, setCode] = useState('')

  function join(event: FormEvent) {
    event.preventDefault()
    navigate(`/join/${normaliseJoinCode(code)}`)
  }

  return (
    <Page>
      <PageHeader eyebrow="Welcome to the table" title="Your tables" subtitle={`Signed in as ${user.email ?? 'you'}`} />

      <div className={columns.columns}>
        <section className={columns.main} aria-labelledby="campaigns-heading">
          <h2 id="campaigns-heading" className={columns.sectionTitle}>
            Your campaigns
          </h2>
          {campaigns.status === 'loading' && <p className={styles.quiet}>Finding your tables…</p>}
          {campaigns.status === 'error' && <Notice tone="error">{campaigns.message}</Notice>}
          {campaigns.status === 'ready' && campaigns.data.length === 0 && (
            <Panel>
              <p>
                You&rsquo;re not at any tables yet. If you&rsquo;re a player, ask your DM for the invite link or join
                code. If you&rsquo;re running the game, start a campaign.
              </p>
            </Panel>
          )}
          {campaigns.status === 'ready' && campaigns.data.length > 0 && (
            <ul className={styles.list}>
              {campaigns.data.map(({ campaign, role }) => (
                <li key={campaign.id}>
                  <a className={styles.card} href={href(`/c/${campaign.id}`)}>
                    <span className={styles.cardName}>{campaign.name}</span>
                    <span className={styles.cardRole}>{role === 'dm' ? "You're the DM" : "You're a player"}</span>
                    <span className={styles.cardOpen} aria-hidden="true">
                      Open the table
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className={columns.side}>
          <Panel title="Join a table">
            <form className={styles.form} onSubmit={join}>
              <TextField
                label="Join code"
                hint="Six letters and numbers, from your DM"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <button type="submit" className={buttonClassName('primary', { size: 'small' })}>
                Join
              </button>
            </form>
          </Panel>
          <Panel title="Running the game?">
            <p>Start a campaign, then invite your players with a link or a join code.</p>
            <ButtonLink href={href('/new')} variant="outline" size="small">
              Start a campaign
            </ButtonLink>
          </Panel>
        </aside>
      </div>

      <SiteFooter />
    </Page>
  )
}
