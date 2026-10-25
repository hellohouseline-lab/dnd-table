import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Parchment } from '../../components/Parchment.tsx'
import { ROADMAP, STATUS_LABEL } from './roadmap.ts'
import styles from './HomeScreen.module.css'

/** The holding page shown until sign-in arrives in milestone 1. */
export function HomeScreen() {
  return (
    <Page>
      <PageHeader
        eyebrow="The table is being built"
        title="D&D Table"
        subtitle="A private table for one party · 2014 rules"
        note="Nothing to sign in to yet. Your DM will send you a link when the table opens."
      />

      <div className={styles.columns}>
        <section className={styles.main} aria-labelledby="roadmap-heading">
          <h2 id="roadmap-heading" className={styles.sectionTitle}>
            How the build is going
          </h2>
          <Parchment corners>
            <ol className={styles.roadmap}>
              {ROADMAP.map((step) => (
                <li key={step.name} className={cx(styles.step, styles[step.status])}>
                  <span className={styles.marker} aria-hidden="true" />
                  <div>
                    <div className={styles.stepName}>{step.name}</div>
                    <div className={styles.stepDetail}>{step.detail}</div>
                  </div>
                  <span className={styles.status}>{STATUS_LABEL[step.status]}</span>
                </li>
              ))}
            </ol>
          </Parchment>
        </section>

        <aside className={styles.side}>
          <Panel title="What this is">
            <p>
              A table for our group to play Dungeons &amp; Dragons together online: live dice, rolls the DM asks
              for, battle maps, character sheets, music and sound, and an overlay for everyone&rsquo;s Twitch
              stream.
            </p>
          </Panel>
          <Panel title="Built on open rules">
            <p>The rules come from the free System Reference Document 5.1, for the 2014 edition of the game.</p>
            <a href={href('/credits')}>See the credits</a>
          </Panel>
        </aside>
      </div>

      <footer className={styles.footer}>
        <a href={href('/credits')}>Credits</a>
        <span aria-hidden="true">·</span>
        <span>An unofficial fan project, not made or endorsed by Wizards of the Coast.</span>
      </footer>
    </Page>
  )
}
