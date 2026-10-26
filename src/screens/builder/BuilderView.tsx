import { cx } from '../../components/cx.ts'
import type { BuilderDraft } from '../../rules/build/draft.ts'
import { raceSummary } from '../../rules/build/draft.ts'
import type { SrdRaces, SrdSpell } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'
import { RaceStep } from './RaceStep.tsx'
import { STEPS, type StepKey } from './steps.ts'
import { Summary } from './Summary.tsx'

type BuilderViewProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  races: SrdRaces | null
  spells: SrdSpell[] | null
  /** The table's name, under the title. */
  campaignName?: string
  /** Back to the table. */
  exitHref: string
  /** The plain form, for anyone who'd rather type their sheet in. */
  formHref?: string | null
}

/**
 * The character builder (docs/C2_PLAN.md): the steps down the left, the choices in the middle, the
 * character taking shape on the right. Step 1, the race, is built first for Matt to try; the rest
 * follow in C2b to C2e.
 */
export function BuilderView({ draft, onDraft, races, spells, campaignName, exitHref, formHref }: BuilderViewProps) {
  const step: StepKey = 'race'
  const race = races ? raceSummary(draft, races) : null
  const raceDone = race !== null && race.missing.length === 0

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{campaignName ?? 'Your table'}</div>
          <h1 className={styles.title}>Make your character</h1>
        </div>
        <span className={styles.spacer} />
        {formHref && (
          <a className={styles.headerLink} href={formHref}>
            Type it in instead
          </a>
        )}
        <a className={styles.headerButton} href={exitHref}>
          Back to the table
        </a>
      </header>

      <div className={styles.body}>
        <nav className={styles.rail} aria-label="Steps">
          <ol>
            {STEPS.map((s, i) => {
              const done = s.key === 'race' && raceDone
              const here = s.key === step
              const ready = s.key === 'race'
              return (
                <li key={s.key}>
                  <span
                    className={cx(
                      styles.stepItem,
                      here && styles.stepHere,
                      done && styles.stepDone,
                      !ready && styles.stepLater,
                    )}
                    aria-current={here ? 'step' : undefined}
                  >
                    <span className={styles.stepNumber}>{done ? '✓' : i + 1}</span>
                    <span>
                      <span className={styles.stepName}>{s.name}</span>
                      <span className={styles.stepHint}>{ready ? s.hint : 'Coming next'}</span>
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </nav>

        <section className={styles.centre} aria-label="Choose your race">
          {races ? (
            <RaceStep draft={draft} onDraft={onDraft} races={races} spells={spells} />
          ) : (
            <p className={styles.loading}>Opening the book of peoples…</p>
          )}
          <div className={styles.footer}>
            <span className={styles.footerNote}>
              {race?.missing.length
                ? `Still to pick: ${race.missing.join('; ')}.`
                : raceDone
                  ? 'Race done. The class step comes next.'
                  : 'Pick a race to begin.'}
            </span>
            <button type="button" className={styles.next} disabled title="The next steps are being built">
              Next: Class
            </button>
          </div>
        </section>

        <Summary race={race} />
      </div>
    </main>
  )
}
