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
// game-icons.net icons, Open5e content.
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
          This work includes material taken from the System Reference Document 5.1 (&ldquo;SRD 5.1&rdquo;) by Wizards of
          the Coast LLC and available at <a href={SRD_URL}>{SRD_URL}</a>. The SRD 5.1 is licensed under the Creative
          Commons Attribution 4.0 International License available at <a href={CC_BY_URL}>{CC_BY_URL}</a>.
        </p>
        <p>
          The rules data was prepared by the <a href="https://github.com/5e-bits/5e-srd-api">5e-database project</a> by
          5e-bits, shared under the MIT License. Only its 2014 SRD 5.1 data is used.
        </p>
      </Parchment>

      <Panel title="Dice">
        <p>
          The 3D dice are thrown by <a href="https://github.com/3d-dice/dice-box-threejs">dice-box-threejs</a> from the
          3D Dice project by Frank Ali, based on Major Victory&rsquo;s 3D Dice Roller and Teall Dice, running on{' '}
          <a href="https://threejs.org">three.js</a> and <a href="https://github.com/pmndrs/cannon-es">cannon-es</a>.
          All three are free under the MIT License. The metal and stone finishes are drawn by this table&rsquo;s own
          code.
        </p>
      </Panel>

      <Panel title="Battle maps">
        <p>
          Battle maps are drawn with <a href="https://konvajs.org">Konva</a> and react-konva by Anton Lavrenov, free
          under the MIT License. The maps themselves are the DM&rsquo;s own.
        </p>
      </Panel>

      <Panel title="Pictures">
        <p>
          The painted places and the ready-made portraits that come with the table were made by Matt, this table&rsquo;s
          DM, with <a href="https://higgsfield.ai">Higgsfield</a>, for this table.
        </p>
      </Panel>

      <Panel title="Voice and cameras">
        <p>
          Everyone&rsquo;s voice and camera travel through <a href="https://vdo.ninja">VDO.Ninja</a> by Steve Seguin, a
          free and open-source service shown inside the table. None of its code is part of this site.
        </p>
      </Panel>

      <Panel title="Sound">
        <p>
          Music, ambience and sound effects play through <a href="https://howlerjs.com">Howler.js</a> by James Simpson
          and GoldFire Studios, free under the MIT License. The sounds themselves are the DM&rsquo;s own, licensed for
          streaming.
        </p>
      </Panel>

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
          This is an unofficial fan project for one group of friends. It isn&rsquo;t made, endorsed or supported by
          Wizards of the Coast. Dungeons &amp; Dragons and D&amp;D are trademarks of Wizards of the Coast LLC.
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
