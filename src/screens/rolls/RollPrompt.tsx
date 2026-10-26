import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { DiceFaces } from '../../dice/DiceFaces.tsx'
import { naturalMoment, naturalTitle, sumText } from '../../dice/rollText.ts'
import type { AskedRoll } from '../../live/rollRequests.ts'
import type { Roll } from '../../live/rolls.ts'
import type { Character } from '../../rules/character.ts'
import type { RollMode } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { answerRoll } from '../../rules/rolls.ts'
import { resultSentence } from './requestStatus.ts'
import styles from './RollPrompt.module.css'

const NEXT_MODE: Record<RollMode, RollMode> = { normal: 'advantage', advantage: 'disadvantage', disadvantage: 'normal' }

type RollPromptProps = {
  request: AskedRoll
  character: Character
  /** Advantage or disadvantage the player says the DM gave them; conditions add their own. */
  mode: RollMode
  onModeChange: (mode: RollMode) => void
  onRoll: () => void
  rolling?: boolean
  className?: string
}

/** Screen 03: the parchment card with a wax seal that pops up when the DM asks you to roll. */
export function RollPrompt({ request, character, mode, onModeChange, onRoll, rolling, className }: RollPromptProps) {
  const answer = answerRoll(character, request, { mode })
  const conditions = answer.parts.filter((part) => part.value === 0 && part.label.includes(':'))
  const bonusParts = answer.parts.filter((part) => !conditions.includes(part))
  const modeWords = answer.mode === 'normal' ? 'Normal roll' : `With ${answer.mode}`
  const why = conditions.map((part) => part.label.split(':')[0]).join(', ')

  return (
    <div className={cx(styles.prompt, className)} role="dialog" aria-labelledby="prompt-title">
      <span className={styles.seal} aria-hidden="true">
        <Icon name="d20" size={30} />
      </span>
      <span className={cx(styles.corner, styles.topLeft)} aria-hidden="true" />
      <span className={cx(styles.corner, styles.topRight)} aria-hidden="true" />
      <span className={cx(styles.corner, styles.bottomLeft)} aria-hidden="true" />
      <span className={cx(styles.corner, styles.bottomRight)} aria-hidden="true" />
      <div className={styles.eyebrow}>The Dungeon Master calls for a roll</div>
      <h2 id="prompt-title" className={styles.title}>
        {request.label}
      </h2>
      {request.plain && <p className={styles.plain}>{request.plain}</p>}
      <div className={styles.divider} aria-hidden="true">
        <span />
      </div>
      <div className={styles.chips}>
        <span className={styles.chip} title={bonusParts.map((p) => `${p.label} ${formatBonus(p.value)}`).join(', ')}>
          Your bonus {formatBonus(answer.modifier)}
        </span>
        <span className={styles.chip}>
          {request.shownDc ? `Target ${request.shownDc} or more` : 'Target kept secret'}
        </span>
        <button
          type="button"
          className={cx(styles.chip, styles.modeChip)}
          title="Did the DM give you advantage or disadvantage? Click to change it."
          onClick={() => onModeChange(NEXT_MODE[mode])}
        >
          {modeWords}
          {why && `: ${why.toLowerCase()}`}
        </button>
      </div>
      <button type="button" className={styles.roll} disabled={rolling} onClick={onRoll}>
        <Icon name="d20" size={20} />
        {answer.mode === 'normal' ? 'Roll the d20' : 'Roll two d20s'}
      </button>
      <p className={styles.note}>Your proficiency is already in your bonus. Advantage applies itself when it counts.</p>
    </div>
  )
}

type RollResultProps = {
  roll: Roll
  shownDc: number | null
  onClose: () => void
  className?: string
}

/** Screen 04: pass or fail, in a rune ring, with a fuss for a natural 20 or 1. */
export function RollResult({ roll, shownDc, onClose, className }: RollResultProps) {
  const moment = naturalMoment(roll)
  const passed = roll.passed === true
  // A requested roll waits for the DM's ruling before it passes or fails.
  const waiting = roll.passed === null && roll.requestId !== null
  const tone = moment === 'nat20' ? 'gold' : waiting ? 'wait' : passed ? 'pass' : 'fail'
  const kept = roll.dice.find((die) => !die.dropped)?.value ?? roll.total
  const title = naturalTitle(roll) ?? (waiting ? 'Waiting for the DM' : passed ? 'Passed' : 'Failed')

  return (
    <div className={cx(styles.resultWrap, className)}>
      {moment === 'nat20' && <span className={styles.burst} aria-hidden="true" />}
      <div className={cx(styles.result, styles[tone], moment === 'nat1' && styles.shake)} role="status">
        <div className={styles.resultEyebrow}>{roll.label}</div>
        <div className={styles.ring}>
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <circle cx="120" cy="120" r="114" className={styles.ringOuter} />
            <circle cx="120" cy="120" r="102" className={styles.ringDots} />
            <circle cx="120" cy="120" r="92" className={styles.ringInner} />
            <path d="M120 50L180.6 85v70L120 190l-60.6-35V85z" className={styles.hex} />
            <path d="M120 82l-38 66h76z" className={styles.triangle} />
            {moment === 'nat1' && (
              <path d="M150 20 L132 70 L148 92 L118 140 L134 160 L112 222" className={styles.crack} />
            )}
          </svg>
          <span className={styles.die}>{kept}</span>
        </div>
        {roll.dice.length > 1 && (
          <div className={styles.both}>
            <DiceFaces dice={roll.dice} natural={roll.natural} /> {roll.mode === 'advantage' ? 'higher' : 'lower'}{' '}
            counts
          </div>
        )}
        <div className={styles.sum}>
          {sumText(roll)} = {roll.total}
          {shownDc && <span className={styles.vs}> vs DC {shownDc}</span>}
        </div>
        <div className={styles.label}>{title}</div>
        {moment && !waiting && (
          <div className={cx(styles.verdict, passed ? styles.verdictPass : styles.verdictFail)}>
            {passed ? 'Passed' : 'Failed'}
          </div>
        )}
        <p className={styles.sub}>
          {waiting ? `You rolled ${roll.total}. The DM is deciding whether it passes.` : resultSentence(roll)}
        </p>
        <p className={styles.small}>Everyone at the table sees your result. The DM decides what happens next.</p>
        <button type="button" className={styles.back} onClick={onClose}>
          Back to the table
        </button>
      </div>
    </div>
  )
}
