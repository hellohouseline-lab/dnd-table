import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon, type IconName } from '../../components/Icon.tsx'
import { CardInfo } from './CardPanel.tsx'
import type { CardDetails } from './cardDetails.ts'
import styles from './Hand.module.css'

/** One card in a hand: a player's weapon or spell, or a monster's attack or breath. */
export type HandCard = {
  key: string
  tag: string
  tone: 'action' | 'feature' | 'spell' | 'bonus' | 'roll'
  icon: IconName
  name: string
  detail: string
  why: string | null
  info: CardDetails
  spent: boolean
  /** What a screen reader says, if not the card's words. */
  ariaLabel?: string
  /** A concentration spell: a C seal on the card. */
  concentration?: boolean
  play: () => void
}

/** A tab of cards. A bonus tab is blue and carries a dot that goes out once the bonus action is used. */
export type HandSet = { key: string; name: string; cards: HandCard[]; bonus?: boolean }

const MOST_CARDS = 9

type CardHandProps = {
  sets: HandSet[]
  /** In a fight, whether the bonus action is gone (the dot on the bonus tab); null outside one. */
  bonusUsed?: boolean | null
  /** Shown beside the tabs for one set (a caster's spell slots). */
  extra?: (setKey: string) => ReactNode
  label?: string
  /** Greyed-out cards can still be played (the DM, who can bend the rules: "Attack again anyway?"). */
  playSpent?: boolean
  disabled?: boolean
  className?: string
}

/**
 * The fanned hand of cards from design 02, with a tab for each set. Hovering on a card for 2 seconds
 * shows what it does. Used by the player's hand and by the DM playing a monster.
 */
export function CardHand({
  sets: given,
  bonusUsed = null,
  extra,
  label = 'Your hand',
  playSpent = false,
  disabled,
  className,
}: CardHandProps) {
  const [showing, setShowing] = useState<string | null>(null)
  // Hovering on a card for 2 seconds shows what it does.
  const [about, setAbout] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const hover = (key: string | null) => {
    clearTimeout(timer.current)
    setAbout(null)
    if (key) timer.current = setTimeout(() => setAbout(key), 2000)
  }

  const sets = given.filter((s) => s.cards.length > 0)
  const set = sets.find((s) => s.key === showing) ?? sets[0]
  if (!set) return null
  const cards = set.cards.slice(0, MOST_CARDS)
  const middle = (cards.length - 1) / 2

  return (
    <div className={cx(styles.wrap, className)}>
      {sets.length > 1 && (
        <div className={styles.sets}>
          <div className={styles.tabs} role="group" aria-label="Which cards">
            {sets.map((s) => (
              <button
                key={s.key}
                type="button"
                className={cx(styles.tab, s.bonus && styles.tabBonus, set.key === s.key && styles.tabOn)}
                aria-pressed={set.key === s.key}
                onClick={() => setShowing(s.key)}
              >
                {s.name}
                {s.bonus && bonusUsed !== null && (
                  <span className={cx(styles.bonusDot, bonusUsed && styles.bonusDotUsed)} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          {extra?.(set.key)}
        </div>
      )}
      <div className={styles.hand} aria-label={label}>
        {cards.map((card, i) => {
          const offset = i - middle
          return (
            // The wrapper hears the mouse even when the card is greyed out.
            <span
              key={card.key}
              className={styles.slot}
              onMouseEnter={() => hover(card.key)}
              onMouseLeave={() => hover(null)}
            >
              <button
                type="button"
                className={cx(styles.card, card.tone === 'bonus' && styles.bonusCard, card.spent && styles.spent)}
                style={{ '--rot': `${offset * 3}deg`, '--lift': `${offset * offset * 1.5}px` } as CSSProperties}
                aria-label={card.ariaLabel}
                disabled={disabled || (card.spent && !playSpent)}
                title={card.spent && playSpent && card.why ? `${card.name}: ${card.why}` : undefined}
                onClick={() => {
                  hover(null)
                  card.play()
                }}
              >
                <span className={cx(styles.tag, styles[card.tone])}>{card.tag}</span>
                {card.concentration && (
                  <span className={styles.concSeal} title="Concentration: one at a time, and damage means a save">
                    C<span className={styles.hidden}> (concentration)</span>
                  </span>
                )}
                <span className={styles.art}>
                  <Icon name={card.icon} size={26} />
                </span>
                <span className={styles.name}>{card.name}</span>
                <span className={styles.detail}>{card.detail}</span>
              </button>
            </span>
          )
        })}
      </div>
      {cards
        .filter((card) => card.key === about)
        .map((card) => (
          <div key={card.key} className={styles.info}>
            <CardInfo details={card.info} why={card.why} />
          </div>
        ))}
    </div>
  )
}
