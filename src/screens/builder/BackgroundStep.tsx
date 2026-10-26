import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { LANGUAGES, togglePick, type BuilderDraft } from '../../rules/build/draft.ts'
import type { BackgroundSummary } from '../../rules/build/steps.ts'
import { SKILLS, type SrdBackground } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'
import { skillName } from './classWords.ts'

type BackgroundStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  backgrounds: SrdBackground[]
  summary: BackgroundSummary | null
  /** Skills from race and class, so a background can't give one twice. */
  already: string[]
  /** Languages known already, from the race. */
  languages: string[]
}

const BACKGROUND_WORDS: Record<string, string> = {
  acolyte: 'You grew up in a temple, serving a god. Priests of your faith will help you.',
  other: 'A soldier, a sailor, a noble, a street urchin? Name your past and pick two skills.',
}

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

/**
 * Step 3: who you were before adventuring. The SRD has one background, the Acolyte; "Your own"
 * lets the player name theirs and pick two skills and two languages, as the 2014 rules allow. A
 * skill you'd get twice is swapped for one of your choice.
 */
export function BackgroundStep({ draft, onDraft, backgrounds, summary, already, languages }: BackgroundStepProps) {
  const choices = [...backgrounds.map((b) => ({ index: b.index, name: b.name })), { index: 'other', name: 'Your own' }]
  const pickBackground = (index: string) =>
    draft.background === index
      ? undefined
      : onDraft({
          ...draft,
          background: index,
          backgroundSkillPicks: [],
          backgroundLanguagePicks: [],
          backgroundGearPicks: [],
        })

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>Who were you before?</h2>
        <p className={styles.stepLead}>
          Your background is your life before adventure. It gives you two more skills, languages or tools, and a little
          help in the world.
        </p>
      </div>

      <ul className={styles.raceGrid}>
        {choices.map((b) => {
          const picked = draft.background === b.index
          return (
            <li key={b.index}>
              <button
                type="button"
                className={cx(styles.raceCard, picked && styles.picked, b.index === 'other' && styles.raceOther)}
                aria-pressed={picked}
                onClick={() => pickBackground(b.index)}
              >
                <span className={styles.crest} aria-hidden="true">
                  <Icon name={b.index === 'other' ? 'journal' : 'sun'} size={24} />
                </span>
                <span className={styles.raceName}>{b.name}</span>
                <span className={styles.raceLine}>{BACKGROUND_WORDS[b.index] ?? ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className={styles.note}>
        The free rules have one background. Others from the Player&rsquo;s Handbook can be made with Your own.
      </p>

      {summary && (
        <div className={styles.detail}>
          {draft.background === 'other' && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Your background&rsquo;s name</span>
              <input
                value={draft.otherBackground}
                maxLength={40}
                placeholder="Soldier"
                onChange={(event) => onDraft({ ...draft, otherBackground: event.target.value })}
              />
            </label>
          )}

          {summary.skills.length > 0 && (
            <div className={styles.choice}>
              <h3 className={styles.choiceTitle}>Skills it gives</h3>
              <div className={styles.optionRow}>
                {summary.skills.map((s) => (
                  <span
                    key={s}
                    className={cx(styles.chip, styles.fixed, summary.doubled.includes(s) && styles.doubled)}
                  >
                    {skillName(s)}
                    {summary.doubled.includes(s) ? ' (you have it)' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {summary.skillPicks > 0 && (
            <div className={styles.choice}>
              <h3 className={styles.choiceTitle}>
                {draft.background === 'other'
                  ? `Pick 2 skills (${draft.backgroundSkillPicks.length} of 2)`
                  : `You have ${summary.doubled.map(skillName).join(' and ')} already: pick ${summary.skillPicks === 1 ? 'another skill' : `${summary.skillPicks} others`}`}
              </h3>
              <div className={styles.optionRow}>
                {SKILLS.filter((s) => !already.includes(s.index) && !summary.skills.includes(s.index)).map((s) => {
                  const on = draft.backgroundSkillPicks.includes(s.index)
                  return (
                    <button
                      key={s.index}
                      type="button"
                      className={cx(styles.chip, on && styles.picked)}
                      aria-pressed={on}
                      onClick={() =>
                        onDraft({
                          ...draft,
                          backgroundSkillPicks: togglePick(draft.backgroundSkillPicks, s.index, summary.skillPicks),
                        })
                      }
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {summary.languages > 0 && (
            <div className={styles.choice}>
              <h3 className={styles.choiceTitle}>
                Pick {summary.languages} languages ({draft.backgroundLanguagePicks.length} of {summary.languages})
              </h3>
              <div className={styles.optionRow}>
                {LANGUAGES.filter((l) => !languages.includes(l)).map((language) => {
                  const on = draft.backgroundLanguagePicks.includes(language)
                  return (
                    <button
                      key={language}
                      type="button"
                      className={cx(styles.chip, on && styles.picked)}
                      aria-pressed={on}
                      onClick={() =>
                        onDraft({
                          ...draft,
                          backgroundLanguagePicks: togglePick(
                            draft.backgroundLanguagePicks,
                            language,
                            summary.languages,
                          ),
                        })
                      }
                    >
                      {language}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {summary.feature && (
            <div className={styles.choice}>
              <h3 className={styles.choiceTitle}>Its feature</h3>
              <ul className={styles.traitList}>
                <li>
                  <details>
                    <summary>
                      <span className={styles.traitName}>{summary.feature.name}</span>
                      <span className={styles.traitLine}>{first(summary.feature.desc)}</span>
                    </summary>
                    <p>{summary.feature.desc}</p>
                  </details>
                </li>
              </ul>
            </div>
          )}
          <p className={styles.note}>Your personality, ideals, bonds and flaws come later, in Who they are.</p>
        </div>
      )}
    </div>
  )
}
