import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Notice } from '../../components/Notice.tsx'
import { namesText } from '../../rules/askable.ts'
import { sumText } from '../../dice/rollText.ts'
import type { AskedRoll } from '../../live/rollRequests.ts'
import type { Roll } from '../../live/rolls.ts'
import type { Character } from '../../rules/character.ts'
import { parseDice, type DiceGroup } from '../../rules/dice.ts'
import { halfDamage } from '../../rules/maths/hitPoints.ts'
import { CONDITIONS } from '../../rules/srd/index.ts'
import { allAnswered, closestMiss, CONDITION_VERBS, suggestedCondition } from './requestStatus.ts'
import styles from './RequestResults.module.css'

type RequestResultsProps = {
  request: AskedRoll
  answers: Roll[]
  /** The DC (the DM always knows it). */
  dc: number | null
  characters: Character[]
  onOverride: (roll: Roll, passed: boolean) => void
  /** Rolls for a character whose player hasn't, say because they stepped away. */
  onRollFor: (character: Character) => void
  onDamage: (characterIds: string[], amount: number) => void
  onCondition: (characterIds: string[], condition: string) => void
  /** Throws damage dice behind the screen; resolves with the total. */
  onRollDamage: (dice: DiceGroup[]) => Promise<number | null>
  onDone: () => void
  onHide: () => void
  rolling?: boolean
  error?: string | null
  className?: string
}

/** Screen 09: everyone's results, a way to change any of them, and what happens now. */
export function RequestResults({
  request,
  answers,
  dc,
  characters,
  onOverride,
  onRollFor,
  onDamage,
  onCondition,
  onRollDamage,
  onDone,
  onHide,
  rolling,
  error,
  className,
}: RequestResultsProps) {
  const [amount, setAmount] = useState('')
  const [damageDice, setDamageDice] = useState('')
  const [condition, setCondition] = useState(suggestedCondition(request))
  const [done, setDone] = useState<string[]>([])
  const asked = request.characterIds.flatMap((id) => characters.filter((c) => c.id === id))
  const answerFor = (id: string) => answers.find((a) => a.characterId === id)
  const passed = asked.filter((c) => answerFor(c.id)?.passed === true)
  const failed = asked.filter((c) => answerFor(c.id)?.passed === false)
  const waiting = asked.filter((c) => !answerFor(c.id))
  const everyone = allAnswered(request, answers)
  const miss = closestMiss(answers, dc)
  const missName = miss && characters.find((c) => c.id === miss.roll.characterId)?.name
  const value = Math.max(0, Math.trunc(Number(amount)) || 0)
  const dice = parseDice(damageDice)

  function note(words: string) {
    setDone((now) => [...now, words])
  }

  function damage(who: Character[], how: number, words: string) {
    if (how <= 0 || who.length === 0) return
    onDamage(
      who.map((c) => c.id),
      how,
    )
    note(`${how} damage to ${namesText(who.map((c) => c.name))}${words}.`)
  }

  async function rollDamage() {
    if (dice.length === 0) return
    const total = await onRollDamage(dice)
    if (total !== null) setAmount(String(total))
  }

  return (
    <section className={cx(styles.panel, className)} aria-labelledby="results-title">
      <div className={styles.top}>
        <div>
          <div className={styles.eyebrow}>{everyone ? 'The dice have spoken' : 'Waiting for the dice'}</div>
          <h2 id="results-title" className={styles.title}>
            {request.label}
          </h2>
          <p className={styles.sub}>
            Needed {dc ?? '?'} or more · number {request.shownDc ? 'shown to players' : 'kept secret'} ·{' '}
            {everyone ? 'everyone has rolled' : `${answers.length} of ${asked.length} rolled`}
          </p>
        </div>
        <button type="button" className={styles.hide} onClick={onHide}>
          Hide for now
        </button>
      </div>

      <div className={styles.counts}>
        <div className={cx(styles.count, styles.countPass)}>
          <span className={styles.countNumber}>{passed.length}</span> passed
        </div>
        <div className={cx(styles.count, styles.countFail)}>
          <span className={styles.countNumber}>{failed.length}</span> failed
        </div>
        {waiting.length > 0 && (
          <div className={styles.count}>
            <span className={styles.countNumber}>{waiting.length}</span> to roll
          </div>
        )}
      </div>

      <ul className={styles.rows}>
        {asked.map((character) => {
          const answer = answerFor(character.id)
          return (
            <li key={character.id} className={styles.row}>
              <span className={styles.name}>{character.name}</span>
              {answer ? (
                <>
                  <span className={styles.rolled}>
                    rolled {sumText(answer)} = <strong className={styles.total}>{answer.total}</strong>
                    {answer.mode !== 'normal' && <span className={styles.mode}> ({answer.mode})</span>}
                  </span>
                  <span className={cx(styles.verdict, answer.passed ? styles.verdictPass : styles.verdictFail)}>
                    {answer.passed ? 'Passed' : 'Failed'}
                    {answer.passed !== answer.passedByDice && ' by you'}
                  </span>
                  <button type="button" className={styles.flip} onClick={() => onOverride(answer, !answer.passed)}>
                    {answer.passed ? 'Make it a fail' : 'Make it a pass'}
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.rolled}>hasn&rsquo;t rolled yet</span>
                  <button type="button" className={styles.flip} disabled={rolling} onClick={() => onRollFor(character)}>
                    Roll for them
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <p className={styles.hint}>
        {miss && missName && `${missName} missed by ${miss.by}. `}
        You can always change a result, for example to reward good roleplay.
      </p>

      <div className={styles.now}>
        <h3 className={styles.nowTitle}>What happens now?</h3>
        <div className={styles.amountRow}>
          <label className={styles.field}>
            Damage
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <span className={styles.or}>or roll</span>
          <input
            className={styles.diceInput}
            aria-label="Damage dice, such as 3d6"
            placeholder="3d6"
            value={damageDice}
            onChange={(event) => setDamageDice(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void rollDamage()}
          />
          <button
            type="button"
            className={styles.small}
            disabled={dice.length === 0 || rolling}
            title="Rolls behind the screen: only you see the dice"
            onClick={() => void rollDamage()}
          >
            Roll
          </button>
        </div>
        <div className={styles.outcomes}>
          <button
            type="button"
            className={cx(styles.outcome, styles.outcomeFail)}
            disabled={value === 0 || failed.length === 0}
            onClick={() => damage(failed, value, '')}
          >
            Damage the {failed.length} who failed
          </button>
          <button
            type="button"
            className={cx(styles.outcome, styles.outcomePass)}
            disabled={value === 0 || passed.length === 0}
            title="Half damage, rounded down, as for a save against a fireball"
            onClick={() => damage(passed, halfDamage(value), ' (half)')}
          >
            Half damage to the {passed.length} who passed
          </button>
          <div className={styles.conditionRow}>
            <select aria-label="Condition" value={condition} onChange={(event) => setCondition(event.target.value)}>
              {CONDITIONS.filter((c) => CONDITION_VERBS[c.index]).map((c) => (
                <option key={c.index} value={c.index}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.outcome}
              disabled={failed.length === 0}
              onClick={() => {
                onCondition(
                  failed.map((c) => c.id),
                  condition,
                )
                note(`${namesText(failed.map((c) => c.name))} ${failed.length === 1 ? 'is' : 'are'} now ${condition}.`)
              }}
            >
              {CONDITION_VERBS[condition]} the ones who failed
            </button>
          </div>
          <button type="button" className={styles.outcome} disabled title="Handouts arrive in Phase 2">
            Tell the passers a secret
          </button>
        </div>
        {done.length > 0 && (
          <ul className={styles.done} aria-live="polite">
            {done.map((words, i) => (
              <li key={i}>Done: {words}</li>
            ))}
          </ul>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className={styles.end}>
        <button type="button" className={styles.playOn} onClick={onDone}>
          Done, play on
        </button>
        <button
          type="button"
          className={styles.justLog}
          title="Close it without doing anything; the rolls stay in the log"
          onClick={onDone}
        >
          Just log it
        </button>
      </div>
    </section>
  )
}
