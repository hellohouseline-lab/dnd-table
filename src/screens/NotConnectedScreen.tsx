import { Page } from '../components/Page.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { Panel } from '../components/Panel.tsx'
import { SiteFooter } from '../components/SiteFooter.tsx'

/** Shown if the site was built without its Supabase settings, so sign-in can't work. */
export function NotConnectedScreen() {
  return (
    <Page width="narrow">
      <PageHeader eyebrow="Not ready yet" title="The table isn't connected" />
      <Panel>
        <p>
          This copy of the table was built without its database settings, so nobody can sign in. On a developer&rsquo;s
          computer, copy <code>.env.example</code> to <code>.env.local</code> and fill it in. On the live site, check the
          two repository secrets in GitHub.
        </p>
      </Panel>
      <SiteFooter />
    </Page>
  )
}
