import type { CSSProperties } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import type { AttackEntry, Character, FeatureEntry } from '../../rules/character.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import styles from './Hand.module.css'

type HandProps = {
  character: Character
  onAttack: (attack: AttackEntry) => void
  onUseFeature: (feature: FeatureEntry) => void
  disabled?: boolean
  className?: string
}

const MOST_CARDS = 9

/**
 * Your hand of cards from design 02: attacks roll to hit and damage in one click, and features with
 * limited uses spend one. Spells and items join the hand in later milestones.
 */
export function Hand({ character, onAttack, onUseFeature, disabled, className }: HandProps) {
  const sheet = deriveSheet(character)
  const cards = [
    ...sheet.attacks.map(({ entry, result }) => ({
      key: entry.id,
      tag: 'Attack',
      tone: 'action' as const,
      icon: 'sword' as const,
      name: entry.name || 'Attack',
      detail: `${formatBonus(result.toHit)} · ${result.damage}`,
      title: `Roll ${entry.name}: ${formatBonus(result.toHit)} to hit, ${result.damage} ${result.damageType.toLowerCase()} damage`,
      spent: false,
      play: () => onAttack(entry),
    })),
    ...character.features
      .filter((feature) => feature.usesMax !== null)
      .map((feature) => ({
        key: feature.id,
        tag: 'Feature',
        tone: 'feature' as const,
        icon: 'powers' as const,
        name: feature.name,
        detail: feature.usesLeft === 1 ? '1 use left' : `${feature.usesLeft} uses left`,
        title:
          feature.usesLeft > 0
            ? `Use ${feature.name}: spends one use`
            : `No uses of ${feature.name} left until a ${feature.recharge === 'short' ? 'short or long' : 'long'} rest`,
        spent: feature.usesLeft <= 0,
        play: () => onUseFeature(feature),
      })),
  ].slice(0, MOST_CARDS)

  if (cards.length === 0) return null
  const middle = (cards.length - 1) / 2

  return (
    <div className={cx(styles.hand, className)} aria-label="Your hand">
      {cards.map((card, i) => {
        const offset = i - middle
        return (
          <button
            key={card.key}
            type="button"
            className={cx(styles.card, card.spent && styles.spent)}
            style={{ '--rot': `${offset * 3}deg`, '--lift': `${offset * offset * 1.5}px` } as CSSProperties}
            title={card.title}
            disabled={disabled || card.spent}
            onClick={card.play}
          >
            <span className={cx(styles.tag, styles[card.tone])}>{card.tag}</span>
            <span className={styles.art}>
              <Icon name={card.icon} size={26} />
            </span>
            <span className={styles.name}>{card.name}</span>
            <span className={styles.detail}>{card.detail}</span>
          </button>
        )
      })}
    </div>
  )
}
