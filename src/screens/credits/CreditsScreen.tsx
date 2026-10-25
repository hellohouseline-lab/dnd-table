import { href } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Parchment } from '../../components/Parchment.tsx'
import styles from './CreditsScreen.module.css'

const SRD_URL = 'https://dnd.wizards.com/resources/systems-reference-document'
const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/legalcode'

// Keep in step with CREDITS.md. Add each new source here when it first ships:
// 5e-database (rules data), dice-box themes, game-icons.net icons, Open5e content.
export function CreditsScreen() {
  return (
    <Page width="narrow">
      <PageHeader
        eyebrow="Credits"
        title="With thanks"
        subtitle="The open rules and free tools this table is built on."
      />

      <Parchment title="Game rules" corners>
        {/* The SRD 5.1 attribution statement, word for word as Wizards of the Coast asks. */}
        <p>
          This work includes material taken from the System Reference Document 5.1 (&ldquo;SRD 5.1&rdquo;) by
          Wizards of the Coast LLC and available at <a href={SRD_URL}>{SRD_URL}</a>. The SRD 5.1 is licensed
          under the Creative Commons Attribution 4.0 International License available at{' '}
          <a href={CC_BY_URL}>{CC_BY_URL}</a>.
        </p>
      </Parchment>

      <Panel title="Fonts">
        <ul className={styles.list}>
          <li>
            <strong>Cinzel</strong> and <strong>Cinzel Decorative</strong> by Natanael Gama
          </li>
          <li>
            <strong>EB Garamond</strong> by Georg Duffner and Octavio Pardo
          </li>
        </ul>
        <p>
          All three are free under the <a href="https://openfontlicense.org">SIL Open Font License 1.1</a>.
        </p>
      </Panel>

      <Panel title="Not official">
        <p>
          This is an unofficial fan project for one group of friends. It isn&rsquo;t made, endorsed or supported
          by Wizards of the Coast. Dungeons &amp; Dragons and D&amp;D are trademarks of Wizards of the Coast LLC.
        </p>
      </Panel>

      <div>
        <ButtonLink href={href('/')} variant="outline">
          Back to the table
        </ButtonLink>
      </div>
    </Page>
  )
}
