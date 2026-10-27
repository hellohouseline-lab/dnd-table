import { cx } from '../../components/cx.ts'
import type { CombatEvent } from '../../live/combat.ts'
import { attacksLeft, movementLeft, type TurnRecord } from '../../rules/turn.ts'
import { eventWords } from './eventWords.ts'
import styles from './TurnParts.module.css'

type FeedProps = {
  events: CombatEvent[]
  nameOf: (combatantId: string | null) => string
  /** Your own combatant, so the feed says "you". */
  youId?: string | null
  /** How many to show, newest first. */
  limit?: number
  /** DM: takes back the newest thing that happened. */
  onUndo?: () => void
  className?: string
  /** The DM's one-click offer on a line (Apply Paralysed), if any (C3a). */
  offerFor?: (event: CombatEvent) => { label: string; onApply: () => void } | null
}

/** What happened in the fight, newest first, with Undo on the newest for the DM. */
export function CombatFeed({ events, nameOf, youId = null, limit = 6, onUndo, offerFor, className }: FeedProps) {
  const newest = [...events].reverse()
  const undoable = newest.find((e) => !e.undone)
  if (newest.length === 0) return null
  return (
    <section className={cx(styles.feed, className)} aria-label="What happened">
      <ol className={styles.feedList}>
        {newest.slice(0, limit).map((event) => (
          <li
            key={event.id}
            className={cx(styles.feedItem, event.undone && styles.undone, event.shown.hit && styles.hit)}
          >
            <span>
              {eventWords(event, { nameOf, youId })}
              {event.undone && ' (undone)'}
            </span>
            {(() => {
              const offer = offerFor?.(event)
              return (
                offer && (
                  <button
                    type="button"
                    className={styles.undo}
                    onClick={offer.onApply}
                    title="Put it on, with how long already set"
                  >
                    {offer.label}
                  </button>
                )
              )
            })()}
            {onUndo && event.id === undoable?.id && (
              <button type="button" className={styles.undo} onClick={onUndo} title="Take this back (U)">
                Undo
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

type PipsProps = {
  turn: TurnRecord
  speed: number
  /** Attacks one Attack action gives. */
  perAction: number
}

/** Four small marks for what's left of a turn: action, bonus action, reaction and movement. */
export function TurnPips({ turn, speed, perAction }: PipsProps) {
  const attacks = attacksLeft(turn, perAction)
  const actionWord =
    turn.attacksMade > 0 && attacks > 0
      ? `${attacks} attack${attacks === 1 ? '' : 's'} left`
      : turn.actionUsed
        ? 'used'
        : 'ready'
  const feet = movementLeft(turn, speed)
  return (
    <span className={styles.pips} aria-label="What's left of this turn">
      <span
        className={cx(styles.pip, styles.action, turn.actionUsed && attacks === 0 && styles.used)}
        title={`Action: ${actionWord}`}
      />
      <span
        className={cx(styles.pip, styles.bonus, turn.bonusUsed && styles.used)}
        title={`Bonus action: ${turn.bonusUsed ? 'used' : 'ready'}`}
      />
      <span
        className={cx(styles.pip, styles.reaction, turn.reactionUsed && styles.used)}
        title={`Reaction: ${turn.reactionUsed ? 'used' : 'ready'}`}
      />
      <span className={styles.feet} title="Movement left">
        {feet} ft
      </span>
    </span>
  )
}
