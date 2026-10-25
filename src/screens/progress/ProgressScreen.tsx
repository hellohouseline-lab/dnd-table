import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Parchment } from '../../components/Parchment.tsx'
import { SiteFooter } from '../../components/SiteFooter.tsx'
import columns from '../columns.module.css'
import { ROADMAP, STATUS_LABEL } from './roadmap.ts'
import styles from './ProgressScreen.module.css'

/** What works now and what's coming, milestone by milestone. Open to anyone, signed in or not. */
export function ProgressScreen() {
  return (
    <Page>
      <PageHeader
        eyebrow="Behind the scenes"
        title="Build progress"
        subtitle="What works now, and what's coming next"
      />

      <div className={columns.columns}>
        <section className={columns.main} aria-labelledby="roadmap-heading">
          <h2 id="roadmap-heading" className={columns.sectionTitle}>
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

        <aside className={columns.side}>
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

      <SiteFooter />
    </Page>
  )
}
