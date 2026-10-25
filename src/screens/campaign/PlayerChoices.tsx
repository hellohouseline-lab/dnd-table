import { buttonClassName } from '../../components/buttonClassName.ts'
import { Parchment } from '../../components/Parchment.tsx'
import styles from './PlayerChoices.module.css'

/**
 * The player's half of the Join screen. Character sheets arrive in milestone 2 and the wizard in
 * Phase 2, so both cards are shown as designed but can't be used yet.
 */
export function PlayerChoices() {
  return (
    <div className={styles.cards}>
      <Parchment className={styles.character}>
        <div className={styles.cardTitle}>Your character</div>
        <p className={styles.inkText}>
          Coming in the next milestone: type your character sheet in here, and the table works out every bonus for
          you.
        </p>
        <button type="button" className={buttonClassName('ink', { className: styles.push })} disabled>
          Take your seat
        </button>
      </Parchment>

      <article className={styles.forge}>
        <div className={styles.cardTitle}>Forge a new character</div>
        <p className={styles.darkText}>
          A guided wizard with a plain-English explanation at every choice. It arrives after the first sessions; until
          then you&rsquo;ll type your sheet in.
        </p>
        <ol className={styles.steps}>
          <li>Race and subrace</li>
          <li>Class</li>
          <li>Background</li>
          <li>Ability scores: standard set, point buy or rolled dice</li>
          <li>Starting equipment, picked as cards</li>
          <li>Spells, if your class casts them</li>
        </ol>
        <button type="button" className={buttonClassName('outline', { className: styles.push })} disabled>
          Start the wizard
        </button>
      </article>
    </div>
  )
}
