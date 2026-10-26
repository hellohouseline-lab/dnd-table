import { ABILITIES, ABILITY_SHORT } from '../../rules/abilities.ts'
import type { RaceSummary } from '../../rules/build/draft.ts'
import styles from './Builder.module.css'

/**
 * The character taking shape, on the right: what's been picked so far. Ability scores show the
 * race's bonuses until the scores step fills them in.
 */
export function Summary({ race }: { race: RaceSummary | null }) {
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
            <span className={styles.summaryLater}> · class to come</span>
          </div>
        </div>
      </div>

      <div className={styles.summaryLabel}>Ability scores</div>
      <div className={styles.scoreGrid}>
        {ABILITIES.map((ability) => {
          const bonus = race?.bonuses[ability] ?? 0
          return (
            <div key={ability} className={styles.scoreBox}>
              <span className={styles.scoreShort}>{ABILITY_SHORT[ability]}</span>
              <span className={styles.scoreValue}>–</span>
              <span className={bonus ? styles.scoreBonus : styles.scoreNone}>{bonus ? `+${bonus}` : 'no bonus'}</span>
            </div>
          )
        })}
      </div>
      <p className={styles.summaryNote}>Your scores are set in step 4; the race&rsquo;s bonuses go on top.</p>

      {race && (
        <>
          <div className={styles.summaryFacts}>
            <div>
              <span className={styles.summaryLabel}>Speed</span>
              <span className={styles.fact}>{race.speed} ft</span>
            </div>
            <div>
              <span className={styles.summaryLabel}>Size</span>
              <span className={styles.fact}>{race.size}</span>
            </div>
          </div>
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
