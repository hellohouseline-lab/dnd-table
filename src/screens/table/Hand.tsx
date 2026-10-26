import { useState, type CSSProperties } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import type { AttackEntry, Character, FeatureEntry } from '../../rules/character.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import type { SrdSpell } from '../../rules/srd/index.ts'
import { spellSummary } from '../../rules/spells.ts'
import { SlotPips } from '../fight/SpellParts.tsx'
import { levelWords, srdSpellFor } from '../fight/useCasting.ts'
import styles from './Hand.module.css'

/** A caster's spells for the hand: the SRD list, why one can't be cast now (or null), and casting one. */
export type HandSpells = {
  list: SrdSpell[] | null
  whyNot: (spell: SrdSpell) => string | null
  onCast: (spell: SrdSpell) => void
}

type HandProps = {
  character: Character
  onAttack: (attack: AttackEntry) => void
  onUseFeature: (feature: FeatureEntry) => void
  /** A caster's spells: shown as a second set of cards, with the slots left above them. */
  spells?: HandSpells | null
  disabled?: boolean
  className?: string
}

const MOST_CARDS = 9

/**
 * Your hand of cards from design 02: attacks roll to hit and damage in one click, and features with
 * limited uses spend one. A caster has a second set, their spells, with the slots left above them:
 * a click casts (then pick a target, or where it goes). Items join the hand in a later milestone.
 */
export function Hand({ character, onAttack, onUseFeature, spells = null, disabled, className }: HandProps) {
  const sheet = deriveSheet(character)
  const [showing, setShowing] = useState<'weapons' | 'spells'>('weapons')
  const castable = character.spellcasting.spells
    .filter((entry) => entry.prepared || entry.level === 0)
    .flatMap((entry) => {
      const spell = srdSpellFor(entry, spells?.list ?? null)
      return spell ? [spell] : []
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const hasSpells = Boolean(spells) && castable.length > 0
  const spellCards = castable.map((spell) => {
    const why = spells?.whyNot(spell) ?? null
    return {
      key: spell.index,
      tag: `${levelWords(spell.level)}${spell.concentration ? ' · C' : ''}`,
      tone: 'spell' as const,
      icon: 'star' as const,
      name: spell.name,
      detail: spellSummary(spell, character) || spell.castingTime,
      title:
        why ??
        `Cast ${spell.name}: ${spell.castingTime}, ${spell.range}${spell.concentration ? ', concentration' : ''}`,
      spent: why !== null,
      play: () => spells?.onCast(spell),
    }
  })
  const weaponCards = [
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
  ]
  // A caster with nothing else to play starts on their spells.
  const set = hasSpells && (showing === 'spells' || weaponCards.length === 0) ? 'spells' : 'weapons'
  const cards = (set === 'spells' ? spellCards : weaponCards).slice(0, MOST_CARDS)

  if (cards.length === 0 && !hasSpells) return null
  const middle = (cards.length - 1) / 2

  return (
    <div className={cx(styles.wrap, className)}>
      {hasSpells && (
        <div className={styles.sets}>
          <div className={styles.tabs} role="group" aria-label="Which cards">
            <button
              type="button"
              className={cx(styles.tab, set === 'weapons' && styles.tabOn)}
              aria-pressed={set === 'weapons'}
              onClick={() => setShowing('weapons')}
            >
              Attacks and features
            </button>
            <button
              type="button"
              className={cx(styles.tab, set === 'spells' && styles.tabOn)}
              aria-pressed={set === 'spells'}
              onClick={() => setShowing('spells')}
            >
              Spells
            </button>
          </div>
          {set === 'spells' && <SlotPips spellcasting={character.spellcasting} />}
        </div>
      )}
      <div className={styles.hand} aria-label="Your hand">
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
    </div>
  )
}
