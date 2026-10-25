import { cx } from '../components/cx.ts'
import type { Member } from '../live/campaigns.ts'
import type { Roll } from '../live/rolls.ts'
import type { Character } from '../rules/character.ts'
import { DiceFaces } from './DiceFaces.tsx'
import {
  damageLine,
  modeText,
  naturalMoment,
  naturalNote,
  naturalTitle,
  partsText,
  sumText,
  whoRolled,
} from './rollText.ts'
import styles from './RollToasts.module.css'

type RollToastsProps = {
  rolls: Roll[]
  members: Member[]
  characters: Character[]
  onDismiss: (id: string) => void
  className?: string
}

/** The result of each throw once the dice land, newest at the bottom, with a fuss for natural 20s and 1s. */
export function RollToasts({ rolls, members, characters, onDismiss, className }: RollToastsProps) {
  return (
    <div className={cx(styles.stack, className)} aria-live="polite">
      {rolls.map((roll) => (
        <RollToast
          key={roll.id}
          roll={roll}
          who={whoRolled(roll, members, characters)}
          onDismiss={() => onDismiss(roll.id)}
        />
      ))}
    </div>
  )
}

export function RollToast({ roll, who, onDismiss }: { roll: Roll; who: string; onDismiss?: () => void }) {
  const moment = naturalMoment(roll)
  const title = naturalTitle(roll)
  const note = naturalNote(roll)
  const damage = damageLine(roll)
  const mode = modeText(roll)
  // "13 = 13" says nothing: the dice show what was thrown, so the sum only matters with a bonus.
  const showSum = roll.modifier !== 0
  return (
    <div className={styles.wrap}>
      {moment === 'nat20' && <span className={styles.burst} aria-hidden="true" />}
      <div className={cx(styles.card, moment && styles[moment])} role="status">
        {moment === 'nat1' && (
          <svg className={styles.crack} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M58 0 L52 22 L61 30 L47 52 L55 60 L44 100" />
            <path d="M52 22 L38 30 M47 52 L66 58" />
          </svg>
        )}
        <div className={styles.top}>
          <span className={styles.eyebrow}>
            {who} · {roll.label}
          </span>
          {roll.secret && <span className={styles.secret}>Secret</span>}
          {onDismiss && (
            <button type="button" className={styles.close} aria-label="Close" onClick={onDismiss}>
              ×
            </button>
          )}
        </div>
        {title && <div className={styles.title}>{title}</div>}
        <div className={styles.main}>
          <DiceFaces dice={roll.dice} natural={roll.natural} size="large" />
          <span className={styles.total}>{roll.total}</span>
        </div>
        {(showSum || mode) && (
          <div className={styles.sum}>
            {showSum && `${sumText(roll)} = ${roll.total}`}
            {showSum && mode && ' · '}
            {mode && <span className={styles.mode}>{mode}</span>}
          </div>
        )}
        {roll.parts.length > 0 && <div className={styles.parts}>{partsText(roll.parts)}</div>}
        {damage && (
          <div className={styles.damage}>
            {roll.damage && <DiceFaces dice={roll.damage.dice} />}
            <span>{damage}</span>
          </div>
        )}
        {note && <div className={styles.note}>{note}</div>}
      </div>
    </div>
  )
}
