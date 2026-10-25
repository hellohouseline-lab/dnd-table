import { href } from '../app/router.ts'
import { ButtonLink } from '../components/Button.tsx'
import { Page } from '../components/Page.tsx'
import { PageHeader } from '../components/PageHeader.tsx'

/** Shown for any address after the "#" that isn't a screen. */
export function NotFoundScreen() {
  return (
    <Page width="narrow">
      <PageHeader eyebrow="No such room" title="Lost in the fog" subtitle="There's no page at this address." />
      <div style={{ textAlign: 'center' }}>
        <ButtonLink href={href('/')} variant="outline">
          Back to the table
        </ButtonLink>
      </div>
    </Page>
  )
}
