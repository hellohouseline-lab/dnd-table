import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { CombatEvent } from '../../live/combat.ts'
import { namesText } from '../../rules/askable.ts'
import { talkSkill, type MoraleHint, type Stance, type TalkAnswer, type TalkOutcome } from '../../rules/talk.ts'
import styles from './Talk.module.css'

type TalkCardsProps = {
  /** Talk cards waiting for an answer, oldest first. */
  waiting: CombatEvent[]
  nameOf: (combatantId: string | null) => string
  /** For each card, who on it can't be talked round. */
  deafOn: (event: CombatEvent) => string[]
  onAnswer: (event: CombatEvent, answer: TalkAnswer, outcome: TalkOutcome | null) => void
  className?: string
}

/**
 * The DM's talk cards (C3b): what a player said, the total, and It works, Partly or It doesn't.
 * It works then offers what comes of it: they surrender, they run, a parley, or just the words.
 */
export function TalkCards({ waiting, nameOf, deafOn, onAnswer, className }: TalkCardsProps) {
  if (waiting.length === 0) return null
  return (
    <ul className={cx(styles.cards, className)} aria-label="Talk cards">
      {waiting.map((event) => (
        <TalkCard key={event.id} event={event} nameOf={nameOf} deaf={deafOn(event)} onAnswer={onAnswer} />
      ))}
    </ul>
  )
}

type TalkCardProps = {
  event: CombatEvent
  nameOf: (combatantId: string | null) => string
  deaf: string[]
  onAnswer: TalkCardsProps['onAnswer']
}

function TalkCard({ event, nameOf, deaf, onAnswer }: TalkCardProps) {
  const [works, setWorks] = useState(false)
  const skill = talkSkill(event.shown.talk)
  const targets = event.shown.targets ?? []
  const them = namesText(targets.map((id) => nameOf(id)))
  const one = targets.length === 1
  return (
    <li className={styles.card}>
      <p className={styles.words}>
        <strong>{nameOf(event.actorId)}</strong> tries to {(skill?.verb ?? 'talk to').toLowerCase()}{' '}
        <strong>{them}</strong>. {skill?.word ?? 'Check'} <span className={styles.total}>{event.shown.total}</span>
        {event.shown.words && <span className={styles.said}> &lsquo;{event.shown.words}&rsquo;</span>}
      </p>
      {deaf.map((hint) => (
        <p key={hint} className={styles.deaf}>
          {hint}
        </p>
      ))}
      {works ? (
        <div className={styles.buttons} role="group" aria-label="What comes of it">
          <button type="button" className={styles.answer} onClick={() => onAnswer(event, 'works', 'surrender')}>
            {one ? 'It surrenders' : 'They surrender'}
          </button>
          <button type="button" className={styles.answer} onClick={() => onAnswer(event, 'works', 'run')}>
            {one ? 'It runs' : 'They run'}
          </button>
          <button type="button" className={styles.answer} onClick={() => onAnswer(event, 'works', 'parley')}>
            Parley
          </button>
          <button type="button" className={styles.quiet} onClick={() => onAnswer(event, 'works', 'words')}>
            Just the words
          </button>
          <button type="button" className={styles.quiet} onClick={() => setWorks(false)}>
            Back
          </button>
        </div>
      ) : (
        <div className={styles.buttons} role="group" aria-label="Does it work?">
          <button type="button" className={styles.answer} onClick={() => setWorks(true)}>
            It works
          </button>
          <button type="button" className={styles.answer} onClick={() => onAnswer(event, 'partly', null)}>
            Partly
          </button>
          <button type="button" className={styles.answer} onClick={() => onAnswer(event, 'fails', null)}>
            It doesn&rsquo;t
          </button>
        </div>
      )}
    </li>
  )
}

type ParleyBannerProps = {
  /** DM: carry on from the same turn. */
  onBack?: () => void
  /** DM: the talking settled it. */
  onEnd?: () => void
  className?: string
}

/** A parley (decision 81): on everyone's screen while the fight is paused to talk. */
export function ParleyBanner({ onBack, onEnd, className }: ParleyBannerProps) {
  return (
    <div className={cx(styles.parley, className)} role="status">
      <span className={styles.parleyTitle}>Parley: talking, not fighting</span>
      {!onBack && <span className={styles.parleyNote}>The fight is paused while everyone talks.</span>}
      {onBack && (
        <button type="button" className={styles.answer} onClick={onBack} title="P">
          Back to the fight
        </button>
      )}
      {onEnd && (
        <button type="button" className={styles.quiet} onClick={onEnd}>
          End the fight
        </button>
      )}
    </div>
  )
}

type MoraleNudgesProps = {
  hints: MoraleHint[]
  onStance: (ids: string[], stance: Stance) => void
  className?: string
}

/** The DM's quiet morale nudge (decision 82): only a hint, with one click to make it so. */
export function MoraleNudges({ hints, onStance, className }: MoraleNudgesProps) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const shown = hints.filter((h) => !dismissed.includes(h.text))
  if (shown.length === 0) return null
  return (
    <ul className={cx(styles.nudges, className)} aria-label="Morale">
      {shown.map((hint) => (
        <li key={hint.text} className={styles.nudge}>
          <span className={styles.nudgeWords}>{hint.text}.</span>
          <button type="button" className={styles.link} onClick={() => onStance(hint.ids, 'surrendered')}>
            Surrenders
          </button>
          <button type="button" className={styles.link} onClick={() => onStance(hint.ids, 'running')}>
            Runs
          </button>
          <button
            type="button"
            className={styles.link}
            aria-label="Fights on: hide this"
            onClick={() => setDismissed((list) => [...list, hint.text])}
          >
            Fights on
          </button>
        </li>
      ))}
    </ul>
  )
}
