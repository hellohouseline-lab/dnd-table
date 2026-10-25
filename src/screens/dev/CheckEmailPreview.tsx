// Local development only: the "Check your email" step, which otherwise only appears after a real
// login email has been sent. The code box here talks to Supabase, so a made-up code just fails.
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { CheckEmailPanel } from '../signin/CheckEmailPanel.tsx'

export function CheckEmailPreview() {
  return (
    <Page width="narrow">
      <PageHeader eyebrow="Take your seat at the table" title="D&D Table" subtitle="A private table for one party · 2014 rules" />
      <CheckEmailPanel email="player@example.com" onDifferentEmail={() => {}} />
    </Page>
  )
}
