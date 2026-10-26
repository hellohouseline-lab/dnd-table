import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { ABILITIES, ABILITY_NAME, type Ability } from '../../rules/abilities.ts'
import type { BuilderDraft, RaceSummary, ScoreMethod } from '../../rules/build/draft.ts'
import {
  pointBuyCost,
  pointBuyRoom,
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  suggestScores,
  type Scores,
} from '../../rules/build/scores.ts'
import { methodValues, modifierText, randomBalanced } from '../../rules/build/steps.ts'
import styles from './Builder.module.css'

type ScoresStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  classIndex: string | null
  className: string | null
  race: RaceSummary | null
  /** Throws 4d6 six times on the server, for everyone to see; each roll's four dice. */
  onRoll: () => Promise<number[][] | null>
}

const METHODS: { key: ScoreMethod; name: string; line: string }[] = [
  { key: 'standard', name: 'Standard set', line: 'Place 15, 14, 13, 12, 10 and 8. Balanced and fair.' },
  { key: 'pointbuy', name: 'Point buy', line: 'Spend 27 points. Choose exactly where your strengths are.' },
  { key: 'roll', name: 'Roll the dice', line: 'Roll 4d6 six times, dropping the lowest die. Once, for real.' },
  {
    key: 'random',
    name: 'Random but balanced',
    line: 'The standard set dealt for you, best where your class needs it.',
  },
]

const ABILITY_WORDS: Record<Ability, string> = {
  strength: 'Lifting, hitting with heavy weapons, climbing',
  dexterity: 'Dodging, aiming, sneaking, quick hands',
  constitution: 'Hit points and staying power',
  intelligence: 'Memory, reasoning, wizard spells',
  wisdom: 'Noticing things, instincts, cleric and druid spells',
  charisma: 'Persuading, performing, bard, sorcerer and warlock spells',
}

const flat = (n: number): Scores => Object.fromEntries(ABILITIES.map((a) => [a, n])) as Scores

/** Gives an ability a value from the set, swapping with whichever ability had it. */
function place(scores: Scores, ability: Ability, value: number): Scores {
  const holder = ABILITIES.find((a) => a !== ability && scores[a] === value)
  return holder ? { ...scores, [ability]: value, [holder]: scores[ability] } : { ...scores, [ability]: value }
}

/**
 * Step 4: what you're good at. Four ways to make the six scores; racial bonuses are added on top
 * and shown separately, with the modifier each gives.
 */
export function ScoresStep({ draft, onDraft, classIndex, className, race, onRoll }: ScoresStepProps) {
  const [rolling, setRolling] = useState(false)
  const scores = draft.baseScores
  const values = methodValues(draft)
  const suggest = (set: readonly number[]) => (classIndex ? suggestScores(set, classIndex) : null)

  function choose(method: ScoreMethod) {
    if (method === draft.scoreMethod) return
    const base =
      method === 'standard'
        ? suggest(STANDARD_ARRAY)
        : method === 'pointbuy'
          ? flat(8)
          : method === 'random'
            ? randomBalanced(classIndex ?? '')
            : draft.rolled
              ? suggest(methodValues({ ...draft, scoreMethod: 'roll' }) ?? [])
              : null
    onDraft({ ...draft, scoreMethod: method, baseScores: base })
  }

  async function roll() {
    setRolling(true)
    const rolled = await onRoll()
    setRolling(false)
    if (!rolled) return
    const next = { ...draft, rolled, scoreMethod: 'roll' as const }
    onDraft({ ...next, baseScores: suggest(methodValues(next) ?? []) })
  }

  const cost = scores && draft.scoreMethod === 'pointbuy' ? pointBuyCost(scores) : null

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>What are you good at?</h2>
        <p className={styles.stepLead}>
          Six ability scores say how strong, quick, tough, clever, wise and charming you are. 10 is average; each 2
          above it adds +1 to rolls that use it.
        </p>
      </div>

      <div className={styles.methods} role="group" aria-label="How to make your scores">
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={cx(styles.option, styles.method, draft.scoreMethod === m.key && styles.picked)}
            aria-pressed={draft.scoreMethod === m.key}
            onClick={() => choose(m.key)}
          >
            <span className={styles.optionName}>{m.name}</span>
            <span className={styles.optionLine}>{m.line}</span>
          </button>
        ))}
      </div>

      {draft.scoreMethod && (
        <div className={styles.detail}>
          {draft.scoreMethod === 'roll' && (
            <div className={styles.rollRow}>
              {draft.rolled ? (
                <div className={styles.rolls} aria-label="Your rolls">
                  {draft.rolled.map((dice, i) => {
                    const lowest = dice.indexOf(Math.min(...dice))
                    return (
                      <span key={i} className={styles.rollSet}>
                        {dice.map((d, j) => (
                          <span key={j} className={cx(styles.die, j === lowest && styles.dropped)}>
                            {d}
                          </span>
                        ))}
                        <strong>= {values?.[i]}</strong>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <button type="button" className={styles.next} disabled={rolling} onClick={() => void roll()}>
                  {rolling ? 'Rolling…' : 'Roll 4d6 six times'}
                </button>
              )}
              <p className={styles.note}>
                {draft.rolled
                  ? 'Rolled once, and the DM can see it in the roll log.'
                  : 'The dice are thrown for the whole table to see, once.'}
              </p>
            </div>
          )}

          {draft.scoreMethod === 'pointbuy' && (
            <p className={styles.pointsLeft}>
              Points left: <strong>{POINT_BUY_BUDGET - (cost ?? 0)}</strong> of {POINT_BUY_BUDGET}. Scores go from 8 to
              15; higher ones cost more.
            </p>
          )}

          {scores && (
            <>
              <table className={styles.scoreTable}>
                <thead>
                  <tr>
                    <th>Ability</th>
                    <th>Score</th>
                    <th>Race</th>
                    <th>Total</th>
                    <th>Modifier</th>
                  </tr>
                </thead>
                <tbody>
                  {ABILITIES.map((ability) => {
                    const bonus = race?.bonuses[ability] ?? 0
                    const total = Math.min(20, scores[ability] + bonus)
                    const room = draft.scoreMethod === 'pointbuy' ? pointBuyRoom(scores, ability) : null
                    return (
                      <tr key={ability}>
                        <th scope="row">
                          <span className={styles.abilityName}>{ABILITY_NAME[ability]}</span>
                          <span className={styles.abilityWords}>{ABILITY_WORDS[ability]}</span>
                        </th>
                        <td>
                          {room ? (
                            <span className={styles.stepper}>
                              <button
                                type="button"
                                aria-label={`Lower ${ABILITY_NAME[ability]}`}
                                disabled={!room.down}
                                onClick={() =>
                                  onDraft({ ...draft, baseScores: { ...scores, [ability]: scores[ability] - 1 } })
                                }
                              >
                                −
                              </button>
                              <span className={styles.stepperValue}>{scores[ability]}</span>
                              <button
                                type="button"
                                aria-label={`Raise ${ABILITY_NAME[ability]}`}
                                disabled={!room.up}
                                onClick={() =>
                                  onDraft({ ...draft, baseScores: { ...scores, [ability]: scores[ability] + 1 } })
                                }
                              >
                                +
                              </button>
                            </span>
                          ) : (
                            <select
                              className={styles.scoreSelect}
                              aria-label={`${ABILITY_NAME[ability]} score`}
                              value={scores[ability]}
                              onChange={(event) =>
                                onDraft({ ...draft, baseScores: place(scores, ability, Number(event.target.value)) })
                              }
                            >
                              {[...new Set(values ?? [])]
                                .sort((a, b) => b - a)
                                .map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                            </select>
                          )}
                        </td>
                        <td className={bonus ? styles.bonusCell : styles.quietCell}>{bonus ? `+${bonus}` : '–'}</td>
                        <td className={styles.totalCell}>{total}</td>
                        <td className={styles.modCell}>{modifierText(total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {draft.scoreMethod !== 'pointbuy' && values && classIndex && (
                <button
                  type="button"
                  className={styles.suggest}
                  onClick={() => onDraft({ ...draft, baseScores: suggest(values) })}
                >
                  Suggest for a {className ?? 'my class'}
                </button>
              )}
              {draft.scoreMethod !== 'pointbuy' && (
                <p className={styles.note}>Pick a score to swap it with the ability that has it.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
