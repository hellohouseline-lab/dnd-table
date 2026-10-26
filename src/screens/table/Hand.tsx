import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon, type IconName } from '../../components/Icon.tsx'
import type { AttackEntry, Character, FeatureEntry } from '../../rules/character.ts'
import { featureCost } from '../../rules/features.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { findWeapon, type SrdSpell } from '../../rules/srd/index.ts'
import { castingCost, spellSummary } from '../../rules/spells.ts'
import type { BonusMove } from '../../rules/turn.ts'
import { SlotPips } from '../fight/SpellParts.tsx'
import { levelWords, srdSpellFor } from '../fight/useCasting.ts'
import { CardInfo } from './CardPanel.tsx'
import { attackDetails, featureDetails, spellDetails, type CardDetails } from './cardDetails.ts'
import styles from './Hand.module.css'

/** A caster's spells for the hand: the SRD list, why one can't be cast now (or null), and casting one. */
export type HandSpells = {
  list: SrdSpell[] | null
  whyNot: (spell: SrdSpell) => string | null
  onCast: (spell: SrdSpell) => void
}

/** In a fight: what's left of your turn, for the bonus action cards. */
export type HandTurn = {
  myTurn: boolean
  bonusUsed: boolean
  /** An off-hand attack is possible with this weapon now (two-weapon fighting). */
  offhand: (attack: AttackEntry) => boolean
}

type HandProps = {
  character: Character
  onAttack: (attack: AttackEntry) => void
  onUseFeature: (feature: FeatureEntry) => void
  /** A caster's spells: shown as a second set of cards, with the slots left above them. */
  spells?: HandSpells | null
  /** In a fight: the turn, so bonus action cards can show when they're used. */
  turn?: HandTurn | null
  /** Dash, Disengage, Hide or Dodge as a bonus action (a rogue's Cunning Action, a monk's ki). */
  bonusMoves?: BonusMove[]
  onBonusMove?: (move: BonusMove) => void
  disabled?: boolean
  className?: string
}

type Card = {
  key: string
  tag: string
  tone: 'action' | 'feature' | 'spell' | 'bonus'
  icon: IconName
  name: string
  detail: string
  why: string | null
  info: CardDetails
  spent: boolean
  play: () => void
}

type CardSet = 'weapons' | 'spells' | 'bonus'

const MOST_CARDS = 9

const MOVE_WORDS: Record<BonusMove, [string, string]> = {
  dash: ['Dash', 'Move your speed again this turn.'],
  disengage: ['Disengage', 'Moving away draws no opportunity attacks this turn.'],
  hide: ['Hide', 'Try to hide: roll Stealth against what the enemies can see.'],
  dodge: ['Dodge', 'Attacks against you have disadvantage until your next turn.'],
}

/**
 * Your hand of cards from design 02. Attacks, then features; a caster has their spells as a second
 * set, and anyone with bonus actions has a third, Bonus actions, gathering everything they can do
 * with one (Rage, Second Wind, Healing Word, an off-hand attack, a rogue's Cunning Action). Bonus
 * action cards are blue everywhere, and grey out once the bonus action is used this turn. Hovering on
 * a card for 3 seconds shows what it does.
 */
export function Hand({
  character,
  onAttack,
  onUseFeature,
  spells = null,
  turn = null,
  bonusMoves = [],
  onBonusMove,
  disabled,
  className,
}: HandProps) {
  const sheet = deriveSheet(character)
  const [showing, setShowing] = useState<CardSet>('weapons')
  // Hovering on a card for 3 seconds shows what it does.
  const [about, setAbout] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const hover = (key: string | null) => {
    clearTimeout(timer.current)
    setAbout(null)
    if (key) timer.current = setTimeout(() => setAbout(key), 3000)
  }

  // In a fight, a bonus action card can't be played once the bonus action is gone, or off your turn.
  const bonusWhy = turn
    ? turn.bonusUsed
      ? 'bonus action used this turn'
      : !turn.myTurn
        ? 'wait for your turn'
        : null
    : null

  const castable = character.spellcasting.spells
    .filter((entry) => entry.prepared || entry.level === 0)
    .flatMap((entry) => {
      const spell = srdSpellFor(entry, spells?.list ?? null)
      return spell ? [spell] : []
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const spellCard = (spell: SrdSpell): Card => {
    const bonus = castingCost(spell.castingTime) === 'bonus'
    const why = spells?.whyNot(spell) ?? null
    return {
      key: `spell-${spell.index}`,
      tag: `${bonus ? 'Bonus · ' : ''}${levelWords(spell.level)}${spell.concentration ? ' · C' : ''}`,
      tone: bonus ? 'bonus' : 'spell',
      icon: 'star',
      name: spell.name,
      detail: spellSummary(spell, character) || spell.castingTime,
      why,
      info: spellDetails(character, spell),
      spent: why !== null,
      play: () => spells?.onCast(spell),
    }
  }

  const attackCard = (entry: AttackEntry, offhand: boolean): Card => {
    const result = sheet.attacks.find((a) => a.entry.id === entry.id)?.result
    const why = offhand && turn && !turn.offhand(entry) ? (bonusWhy ?? 'attack with your main weapon first') : null
    return {
      key: `${offhand ? 'offhand' : 'attack'}-${entry.id}`,
      tag: offhand ? 'Bonus · Off hand' : 'Attack',
      tone: offhand ? 'bonus' : 'action',
      icon: 'sword',
      name: entry.name || 'Attack',
      detail: result ? `${formatBonus(result.toHit)} · ${offhand ? 'no bonus to damage' : result.damage}` : '',
      why,
      info: attackDetails(character, entry),
      spent: why !== null,
      play: () => onAttack(entry),
    }
  }

  const featureCard = (feature: FeatureEntry): Card => {
    const bonus = featureCost(feature.name, feature.description) === 'bonus'
    const why =
      feature.usesMax !== null && feature.usesLeft <= 0
        ? `no uses left until a ${feature.recharge === 'short' ? 'short or long' : 'long'} rest`
        : bonus
          ? bonusWhy
          : null
    return {
      key: `feature-${feature.id}`,
      tag: bonus ? 'Bonus action' : 'Feature',
      tone: bonus ? 'bonus' : 'feature',
      icon: 'powers',
      name: feature.name,
      detail: feature.usesMax === null ? '' : feature.usesLeft === 1 ? '1 use left' : `${feature.usesLeft} uses left`,
      why,
      info: featureDetails(character, feature),
      spent: why !== null,
      play: () => onUseFeature(feature),
    }
  }

  const moveCard = (move: BonusMove): Card => ({
    key: `move-${move}`,
    tag: 'Bonus action',
    tone: 'bonus',
    icon: 'leave',
    name: MOVE_WORDS[move][0],
    detail: 'Keeps your action',
    why: bonusWhy,
    info: { kind: 'Bonus action', title: MOVE_WORDS[move][0], lines: [MOVE_WORDS[move][1]], cost: 'bonus', more: null },
    spent: bonusWhy !== null,
    play: () => onBonusMove?.(move),
  })

  const usable = character.features.filter((f) => f.usesMax !== null)
  const weaponCards = [...character.attacks.map((entry) => attackCard(entry, false)), ...usable.map(featureCard)]
  const spellCards = castable.map(spellCard)
  // Light melee weapons, for an off-hand attack, when there are two of them.
  const light = character.attacks.filter((a) => {
    const weapon = findWeapon(a.weapon)
    return Boolean(weapon && weapon.range === 'Melee' && weapon.properties.includes('light'))
  })
  const bonusCards = [
    ...bonusMoves.map(moveCard),
    ...character.features.filter((f) => featureCost(f.name, f.description) === 'bonus').map(featureCard),
    ...castable.filter((s) => castingCost(s.castingTime) === 'bonus').map(spellCard),
    ...(light.length >= 2 ? light.map((entry) => attackCard(entry, true)) : []),
  ]

  const all: { key: CardSet; name: string; cards: Card[] }[] = [
    { key: 'weapons', name: 'Attacks and features', cards: weaponCards },
    { key: 'spells', name: 'Spells', cards: spells ? spellCards : [] },
    { key: 'bonus', name: 'Bonus actions', cards: bonusCards },
  ]
  const sets = all.filter((s) => s.cards.length > 0)
  // A caster with nothing else to play starts on their spells.
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
                className={cx(styles.tab, s.key === 'bonus' && styles.tabBonus, set.key === s.key && styles.tabOn)}
                aria-pressed={set.key === s.key}
                onClick={() => setShowing(s.key)}
              >
                {s.name}
                {s.key === 'bonus' && turn && (
                  <span className={cx(styles.bonusDot, turn.bonusUsed && styles.bonusDotUsed)} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          {set.key === 'spells' && <SlotPips spellcasting={character.spellcasting} />}
        </div>
      )}
      <div className={styles.hand} aria-label="Your hand">
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
                disabled={disabled || card.spent}
                onClick={() => {
                  hover(null)
                  card.play()
                }}
              >
                <span className={cx(styles.tag, styles[card.tone])}>{card.tag}</span>
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
