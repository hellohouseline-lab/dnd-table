import { ABILITIES, ABILITY_NAME, ABILITY_SHORT, type Ability } from '../../rules/abilities.ts'
import type { RaceSummary } from '../../rules/build/draft.ts'
import type { Scores } from '../../rules/build/scores.ts'
import { modifierText } from '../../rules/build/steps.ts'
import styles from './Builder.module.css'
import { skillName } from './classWords.ts'

type SummaryProps = {
  race: RaceSummary | null
  className: string | null
  subclass: string | null
  hitPoints: number | null
  saves: Ability[]
  skills: string[]
  background: string | null
  /** The final scores, racial bonuses included; null until placed. */
  scores: Scores | null
}

/**
 * The character taking shape, on the right: everything picked so far. Ability scores show the
 * race's bonuses until the scores step fills them in.
 */
export function Summary({ race, className, subclass, hitPoints, saves, skills, background, scores }: SummaryProps) {
  return (
    <aside className={styles.summary} aria-label="Your character so far">
      <div className={styles.summaryHead}>
        <span className={styles.portrait} aria-hidden="true">
          ?
        </span>
        <div>
          <div className={styles.summaryName}>A new adventurer</div>
          <div className={styles.summaryLine}>
            Level 1{race ? ` ${race.name}` : ''}
            {className ? ` ${className}` : <span className={styles.summaryLater}> · class to come</span>}
          </div>
          {(subclass || background) && (
            <div className={styles.summaryLater}>{[subclass, background].filter(Boolean).join(' · ')}</div>
          )}
        </div>
      </div>

      <div className={styles.summaryLabel}>Ability scores</div>
      <div className={styles.scoreGrid}>
        {ABILITIES.map((ability) => {
          const bonus = race?.bonuses[ability] ?? 0
          return (
            <div key={ability} className={styles.scoreBox} title={ABILITY_NAME[ability]}>
              <span className={styles.scoreShort}>{ABILITY_SHORT[ability]}</span>
              {scores ? (
                <>
                  <span className={styles.scoreValue}>{scores[ability]}</span>
                  <span className={styles.scoreBonus}>{modifierText(scores[ability])}</span>
                </>
              ) : (
                <>
                  <span className={styles.scoreValue}>–</span>
                  <span className={bonus ? styles.scoreBonus : styles.scoreNone}>
                    {bonus ? `+${bonus}` : 'no bonus'}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
      {!scores && (
        <p className={styles.summaryNote}>Your scores are set in step 4; the race&rsquo;s bonuses go on top.</p>
      )}

      <div className={styles.summaryFacts}>
        <div>
          <span className={styles.summaryLabel}>Hit points</span>
          <span className={styles.fact}>{hitPoints ?? '–'}</span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Speed</span>
          <span className={styles.fact}>{race ? `${race.speed} ft` : '–'}</span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Training bonus</span>
          <span className={styles.fact}>+2</span>
        </div>
      </div>

      {saves.length > 0 && (
        <>
          <div className={styles.summaryLabel}>Saving throws</div>
          <p className={styles.summaryText}>{saves.map((a) => ABILITY_NAME[a]).join(', ')}</p>
        </>
      )}
      {skills.length > 0 && (
        <>
          <div className={styles.summaryLabel}>Skills</div>
          <p className={styles.summaryText}>{skills.map(skillName).sort().join(', ')}</p>
        </>
      )}
      {race && (
        <>
          <div className={styles.summaryLabel}>Languages</div>
          <p className={styles.summaryText}>{race.languages.join(', ')}</p>
          {race.traits.length > 0 && (
            <>
              <div className={styles.summaryLabel}>Traits</div>
              <ul className={styles.summaryTraits}>
                {race.traits.map((t) => (
                  <li key={t.index} title={t.desc}>
                    {t.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </aside>
  )
}
