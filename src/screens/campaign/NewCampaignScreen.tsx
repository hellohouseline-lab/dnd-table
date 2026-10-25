import { useState, type FormEvent } from 'react'
import { href, navigate } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Panel } from '../../components/Panel.tsx'
import { SiteFooter } from '../../components/SiteFooter.tsx'
import { createCampaign } from '../../live/campaigns.ts'
import { messageFor } from '../../live/errors.ts'
import { CampaignFields, type CampaignForm } from './CampaignFields.tsx'
import styles from './NewCampaignScreen.module.css'

/** For the DM: name the campaign and the party, then go to its table to invite players. */
export function NewCampaignScreen() {
  const [form, setForm] = useState<CampaignForm>({ name: '', party_size: 4, starting_level: 1 })
  const [dmName, setDmName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const campaignId = await createCampaign({ ...form, dmName })
      navigate(`/c/${campaignId}`, { replace: true })
    } catch (caught) {
      setError(messageFor(caught))
      setSaving(false)
    }
  }

  return (
    <Page width="narrow">
      <PageHeader eyebrow="For the DM" title="Start a campaign" subtitle="You can change all of this later." />

      <Panel className={styles.panel}>
        <form className={styles.form} onSubmit={(event) => void create(event)}>
          <CampaignFields value={form} onChange={setForm} dmName={dmName} onDmNameChange={setDmName} />
          {error && <Notice tone="error">{error}</Notice>}
          <div className={styles.actions}>
            <button type="submit" className={buttonClassName('primary')} disabled={saving}>
              {saving ? 'Creating…' : 'Create the campaign'}
            </button>
            <ButtonLink href={href('/')} variant="quiet">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Panel>

      <SiteFooter />
    </Page>
  )
}
