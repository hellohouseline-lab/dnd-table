import type { AttackEntry } from '../../rules/character.ts'
import type { BonusEntry } from '../../rules/bonusActions.ts'
import styles from './BonusReady.module.css'

/** One way to take a bonus action the turn has made ready: the attack it rolls, and its button. */
export type BonusChoice = { entry: BonusEntry; attack: AttackEntry; label: string }

const WHY: Record<BonusEntry['trigger'], string> = {
  always: '',
  afterAttack: 'You attacked, so you can also use your bonus action:',
  whileRaging: 'You are raging, so you can also use your bonus action:',
}

/**
 * Offered when something on your turn opens up a bonus action (an off-hand attack after attacking,
 * a monk's strikes, a berserker's frenzy): take one, or put the card away for this turn.
 */
export function BonusReady({
  choices,
  onTake,
  onNotNow,
}: {
  choices: BonusChoice[]
  onTake: (choice: BonusChoice) => void
  onNotNow: () => void
}) {
  const why = WHY[choices[0]?.entry.trigger ?? 'always']
  return (
    <section className={styles.card} aria-label="Bonus action ready">
      <div className={styles.title}>Bonus action ready</div>
      {why && <p className={styles.why}>{why}</p>}
      <ul className={styles.choices}>
        {choices.map((choice, i) => (
          <li key={`${choice.entry.key}-${choice.attack.id}`}>
            <button type="button" className={styles.take} onClick={() => onTake(choice)}>
              <span className={styles.name}>
                {choice.label}
                {choice.entry.cost && <span className={styles.cost}> · {choice.entry.cost}</span>}
              </span>
              {/* Say what it does once for each kind, not for every weapon. */}
              {choices.findIndex((c) => c.entry.key === choice.entry.key) === i && (
                <span className={styles.what}>{choice.entry.what}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.notNow} onClick={onNotNow}>
        Not now
      </button>
    </section>
  )
}
