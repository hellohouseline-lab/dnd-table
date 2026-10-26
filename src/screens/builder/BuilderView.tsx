import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { BuilderDraft } from '../../rules/build/draft.ts'
import { raceSummary } from '../../rules/build/draft.ts'
import {
  allSkills,
  backgroundSummary,
  classSummary,
  finalScores,
  scoresValid,
  startingHp,
} from '../../rules/build/steps.ts'
import { gearSummary } from '../../rules/build/gearStep.ts'
import type { SrdBackground, SrdClass, SrdEquipment, SrdFeature, SrdRaces, SrdSpell } from '../../rules/srd/index.ts'
import { GearStep } from './GearStep.tsx'
import { ReviewStep } from './ReviewStep.tsx'
import { SpellsStep } from './SpellsStep.tsx'
import { WhoStep } from './WhoStep.tsx'
import { assembleBuild } from '../../rules/build/assemble.ts'
import { spellPlan, spellsMissing } from '../../rules/build/spellsStep.ts'
import type { CharacterBuild } from '../../rules/character.ts'
import { BackgroundStep } from './BackgroundStep.tsx'
import styles from './Builder.module.css'
import { ClassStep } from './ClassStep.tsx'
import { RaceStep } from './RaceStep.tsx'
import { ScoresStep } from './ScoresStep.tsx'
import { STEPS } from './steps.ts'
import { Summary } from './Summary.tsx'

/** Every step is built. */
const BUILT = 9

type BuilderViewProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  races: SrdRaces | null
  classes: SrdClass[] | null
  features: Record<string, SrdFeature> | null
  backgrounds: SrdBackground[] | null
  equipment: SrdEquipment | null
  spells: SrdSpell[] | null
  /** Throws 4d6 six times on the server for the Roll the dice method. */
  onRoll: () => Promise<number[][] | null>
  /** The table's name, under the title. */
  campaignName?: string
  /** Back to the table. */
  exitHref: string
  /** The plain form, for anyone who'd rather type their sheet in. */
  formHref?: string | null
  /** Saves the finished character; resolves with a problem to show, or null. */
  onSave: (build: CharacterBuild) => Promise<string | null>
  /** Why it can't be saved here (the DM, or a player with a character already), or null. */
  cantSave: string | null
}

/**
 * The character builder (docs/C2_PLAN.md): the steps down the left, the choices in the middle, the
 * character taking shape on the right. Next moves on once a step is complete; any step already
 * reached can be opened again from the left.
 */
export function BuilderView({
  draft,
  onDraft,
  races,
  classes,
  features,
  backgrounds,
  equipment,
  spells,
  onRoll,
  campaignName,
  exitHref,
  formHref,
  onSave,
  cantSave,
}: BuilderViewProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const race = races ? raceSummary(draft, races) : null
  const cls = classes?.find((c) => c.index === draft.className) ?? null
  const klass = cls && features ? classSummary(draft, cls, features, race) : null
  const already = [...(race?.skills ?? []), ...draft.classSkillPicks]
  const background = backgrounds ? backgroundSummary(draft, backgrounds, already) : null
  const scores = finalScores(draft, race)
  const backgroundData = backgrounds?.find((b) => b.index === draft.background) ?? null
  const gear = equipment ? gearSummary(draft, cls, backgroundData, equipment, scores) : null
  const plan = cls && spells ? spellPlan(cls, 1, klass?.subclass?.index ?? null, scores, spells) : null
  const data =
    races && classes && features && backgrounds && equipment && spells
      ? { races, classes, features, backgrounds, equipment, spells }
      : null
  const build = data ? assembleBuild(draft, data) : null

  const missing: (string[] | null)[] = [
    race ? race.missing : null,
    klass ? klass.missing : null,
    background ? background.missing : null,
    draft.scoreMethod ? (scoresValid(draft) ? [] : [scoreMissing(draft)]) : null,
    // Level: every character starts at level 1 until the DM sets a higher one (C2e).
    [],
    gear && cls ? gear.missing : null,
    plan ? spellsMissing(draft, plan) : null,
    draft.name.trim() ? [] : ['Give your character a name'],
  ]
  missing.push(missing.every((m) => m !== null && m.length === 0) ? [] : null)
  const done = missing.map((m) => m !== null && m.length === 0)
  // Steps that can be opened: every one up to the first not yet done.
  const firstOpen = done.findIndex((d) => !d)
  const reachable = (i: number) => i < BUILT && (firstOpen === -1 || i <= firstOpen)
  const here = missing[step]
  const nextStep = STEPS[step + 1]

  const loading = <p className={styles.loading}>Opening the book…</p>

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
              const isHere = i === step
              const isDone = done[i] ?? false
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    className={cx(
                      styles.stepItem,
                      isHere && styles.stepHere,
                      isDone && styles.stepDone,
                      i >= BUILT && styles.stepLater,
                    )}
                    aria-current={isHere ? 'step' : undefined}
                    disabled={!reachable(i)}
                    onClick={() => setStep(i)}
                  >
                    <span className={styles.stepNumber}>{isDone ? '✓' : i + 1}</span>
                    <span>
                      <span className={styles.stepName}>{s.name}</span>
                      <span className={styles.stepHint}>{i < BUILT ? s.hint : 'Coming next'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <section className={styles.centre} aria-label={STEPS[step].name}>
          {step === 0 && (races ? <RaceStep draft={draft} onDraft={onDraft} races={races} spells={spells} /> : loading)}
          {step === 1 &&
            (classes && features ? (
              <ClassStep draft={draft} onDraft={onDraft} classes={classes} features={features} race={race} />
            ) : (
              loading
            ))}
          {step === 2 &&
            (backgrounds ? (
              <BackgroundStep
                draft={draft}
                onDraft={onDraft}
                backgrounds={backgrounds}
                summary={background}
                already={already}
                languages={race?.languages ?? []}
              />
            ) : (
              loading
            ))}
          {step === 4 && (
            <div className={styles.step}>
              <div className={styles.stepIntro}>
                <h2 className={styles.stepTitle}>Your level</h2>
                <p className={styles.stepLead}>
                  You start at level 1. When your DM lets you level up after an adventure, you&rsquo;ll pick
                  what&rsquo;s new here, one card at a time: more hit points, new features and new spells.
                </p>
              </div>
            </div>
          )}
          {step === 5 &&
            (cls && equipment && gear ? (
              <GearStep
                draft={draft}
                onDraft={onDraft}
                cls={cls}
                background={backgroundData}
                equipment={equipment}
                summary={gear}
              />
            ) : (
              loading
            ))}
          {step === 6 &&
            (plan && cls ? <SpellsStep draft={draft} onDraft={onDraft} className={cls.name} plan={plan} /> : loading)}
          {step === 7 && (
            <WhoStep
              draft={draft}
              onDraft={onDraft}
              background={backgroundData}
              race={race ? { index: draft.race === 'other' ? null : draft.race, name: race.name } : null}
            />
          )}
          {step === 8 && (
            <ReviewStep
              build={build}
              missing={STEPS.slice(0, 8).map((s, i) => ({
                step: s.name,
                stepIndex: i,
                items: missing[i] ?? [`Open ${s.name}`],
              }))}
              onGoTo={setStep}
              cantSave={cantSave}
              saving={saving}
              saveError={saveError}
              onSave={() => {
                if (!build) return
                setSaving(true)
                setSaveError(null)
                void onSave(build).then((problem) => {
                  setSaving(false)
                  setSaveError(problem)
                })
              }}
            />
          )}
          {step === 3 && (
            <ScoresStep
              draft={draft}
              onDraft={onDraft}
              classIndex={draft.className}
              className={cls?.name ?? null}
              race={race}
              onRoll={onRoll}
            />
          )}

          <div className={styles.footer}>
            {step > 0 && (
              <button type="button" className={styles.back} onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <span className={styles.footerNote}>
              {step === 8
                ? 'Your whole character, ready to save.'
                : here === null
                  ? step === 3
                    ? 'Pick a way to make your scores.'
                    : step === 5 || step === 6
                      ? 'Pick a class first.'
                      : `Pick ${step === 0 ? 'a race' : step === 1 ? 'a class' : 'a background'} to begin.`
                  : here.length > 0
                    ? `Still to pick: ${here.join('; ')}.`
                    : `${STEPS[step].name} done.`}
            </span>
            {nextStep && (
              <button
                type="button"
                className={styles.next}
                disabled={!done[step] || step + 1 >= BUILT}
                title={step + 1 >= BUILT ? 'The next steps are being built' : undefined}
                onClick={() => setStep(step + 1)}
              >
                Next: {nextStep.name}
              </button>
            )}
          </div>
        </section>

        <Summary
          race={race}
          className={cls?.name ?? null}
          subclass={klass?.subclass?.name ?? null}
          hitPoints={cls && scores ? startingHp(cls, scores, race) : null}
          saves={cls?.saves ?? []}
          skills={allSkills(draft, race, background)}
          background={background?.name ?? null}
          scores={scores}
          armourClass={gear?.ac?.ac ?? null}
          attacks={gear?.attacks.map((a) => a.name) ?? []}
          languages={[...(race?.languages ?? []), ...draft.backgroundLanguagePicks]}
        />
      </div>
    </main>
  )
}

function scoreMissing(draft: BuilderDraft): string {
  if (draft.scoreMethod === 'roll' && !draft.rolled) return 'Roll your scores'
  if (draft.scoreMethod === 'pointbuy') return 'Spend no more than 27 points'
  return 'Place each score once'
}
