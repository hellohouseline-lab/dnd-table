import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { ABILITY_NAME } from '../../rules/abilities.ts'
import { togglePick, type BuilderDraft, type RaceSummary } from '../../rules/build/draft.ts'
import { classSummary, withClassPicked } from '../../rules/build/steps.ts'
import type { SrdClass, SrdFeature } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'
import { CLASS_WORDS, skillName } from './classWords.ts'

type ClassStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  classes: SrdClass[]
  features: Record<string, SrdFeature>
  race: RaceSummary | null
}

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

/**
 * Step 2: what you do. The twelve classes as cards, then the picked one's hit die, saving throws,
 * level 1 features, skills to choose and anything a feature asks for (a fighting style, expertise,
 * a favoured enemy, a dragon ancestor).
 */
export function ClassStep({ draft, onDraft, classes, features, race }: ClassStepProps) {
  const cls = classes.find((c) => c.index === draft.className) ?? null
  const summary = cls ? classSummary(draft, cls, features, race) : null

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>What do you do?</h2>
        <p className={styles.stepLead}>
          Your class is how you adventure: fighting, sneaking, healing or casting spells. It sets your hit points, what
          you&rsquo;re trained in and the special things you can do.
        </p>
      </div>

      <ul className={styles.raceGrid}>
        {classes.map((c) => {
          const words = CLASS_WORDS[c.index]
          const picked = draft.className === c.index
          return (
            <li key={c.index}>
              <button
                type="button"
                className={cx(styles.raceCard, picked && styles.picked)}
                aria-pressed={picked}
                onClick={() => onDraft(withClassPicked(draft, c.index))}
              >
                <span className={styles.crest} aria-hidden="true">
                  {words ? <Icon name={words.icon} size={24} /> : c.name.charAt(0)}
                </span>
                <span className={styles.raceName}>{c.name}</span>
                <span className={styles.raceLine}>{words?.line}</span>
                <span className={styles.raceFacts}>
                  d{c.hitDie} hit die · {c.spellcastingAbility ? 'spells' : 'no spells'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {cls && summary && (
        <div className={styles.detail}>
          <p className={styles.plays}>
            <strong>How it plays:</strong> {CLASS_WORDS[cls.index]?.plays}
          </p>

          <div className={styles.choice}>
            <h3 className={styles.choiceTitle}>
              Pick {summary.skillChoices.choose} skills you&rsquo;re trained in (
              {draft.classSkillPicks.filter((s) => summary.skillChoices.from.includes(s)).length} of{' '}
              {summary.skillChoices.choose})
            </h3>
            <div className={styles.optionRow}>
              {summary.skillChoices.from.map((skill) => {
                const fromRace = race?.skills.includes(skill)
                const on = draft.classSkillPicks.includes(skill)
                return (
                  <button
                    key={skill}
                    type="button"
                    className={cx(styles.chip, on && styles.picked)}
                    aria-pressed={on}
                    disabled={fromRace}
                    title={fromRace ? 'You have this already from your race' : undefined}
                    onClick={() =>
                      onDraft({
                        ...draft,
                        classSkillPicks: togglePick(draft.classSkillPicks, skill, summary.skillChoices.choose),
                      })
                    }
                  >
                    {skillName(skill)}
                    {fromRace ? ' (have it)' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {summary.subclass && (
            <p className={styles.note}>
              {cls.name}s choose their path at level 1. The free rules have one:{' '}
              <strong>{summary.subclass.name}</strong>, so it&rsquo;s yours. Another from a book can be typed in later.
            </p>
          )}

          {summary.asks.map((ask) => (
            <div key={ask.feature} className={styles.choice}>
              <h3 className={styles.choiceTitle}>
                {ask.name}: pick {ask.choose === 1 ? 'one' : ask.choose} ({ask.picked.length} of {ask.choose})
              </h3>
              {ask.kind === 'skill' && <p className={styles.note}>Expertise doubles your training bonus with these.</p>}
              <div className={ask.kind === 'feature' ? styles.ancestryGrid : styles.optionRow}>
                {ask.options.map((option) => {
                  const on = ask.picked.includes(option.index)
                  const pick = () =>
                    onDraft({
                      ...draft,
                      featurePicks: {
                        ...draft.featurePicks,
                        [ask.feature]: togglePick(ask.picked, option.index, ask.choose),
                      },
                    })
                  return ask.kind === 'feature' ? (
                    <button
                      key={option.index}
                      type="button"
                      className={cx(styles.option, on && styles.picked)}
                      aria-pressed={on}
                      title={option.desc}
                      onClick={pick}
                    >
                      <span className={styles.optionName}>{option.name}</span>
                      <span className={styles.optionLine}>{first(option.desc)}</span>
                    </button>
                  ) : (
                    <button
                      key={option.index}
                      type="button"
                      className={cx(styles.chip, on && styles.picked)}
                      aria-pressed={on}
                      onClick={pick}
                    >
                      {ask.kind === 'skill' ? skillName(option.index) : option.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className={styles.choice}>
            <h3 className={styles.choiceTitle}>What a level 1 {cls.name.toLowerCase()} has</h3>
            <ul className={styles.traitList}>
              <li>
                <span className={styles.traitName}>Hit points</span>
                <span className={styles.traitLine}>
                  {cls.hitDie} + your Constitution modifier at level 1; a d{cls.hitDie} more each level
                </span>
              </li>
              <li>
                <span className={styles.traitName}>Saving throws</span>
                <span className={styles.traitLine}>{cls.saves.map((a) => ABILITY_NAME[a]).join(' and ')}</span>
              </li>
              <li>
                <span className={styles.traitName}>Trained with</span>
                <span className={styles.traitLine}>{cls.proficiencies.join(', ')}</span>
              </li>
              {summary.features
                .filter((f) => !summary.asks.some((a) => a.feature === f.index))
                .map((feature) => (
                  <li key={feature.index}>
                    <details>
                      <summary>
                        <span className={styles.traitName}>{feature.name}</span>
                        <span className={styles.traitLine}>{first(feature.desc)}</span>
                      </summary>
                      <p>{feature.desc}</p>
                    </details>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
