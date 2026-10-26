import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon, type IconName } from '../../components/Icon.tsx'
import type { AttackEntry, Character, FeatureEntry, InventoryItem } from '../../rules/character.ts'
import type { Usable } from '../../rules/items.ts'
import { coveredFeatures } from '../../rules/bonusActions.ts'
import { featureCost } from '../../rules/features.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { findWeapon, type SrdSpell } from '../../rules/srd/index.ts'
import { castingCost, spellSummary } from '../../rules/spells.ts'
import type { BonusMove } from '../../rules/turn.ts'
import type { BonusChoice } from '../fight/BonusReady.tsx'
import { SlotPips } from '../fight/SpellParts.tsx'
import { levelWords, srdSpellFor } from '../fight/useCasting.ts'
import { CardInfo } from './CardPanel.tsx'
import {
  attackDetails,
  featureDetails,
  moveDetails,
  spellDetails,
  weaponIcon,
  type CardDetails,
} from './cardDetails.ts'
import type { RollMode } from '../../rules/dice.ts'
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
  /** A monk's unarmed strike and Flurry of Blows, a berserker's frenzy: why each can't be used now, or null. */
  bonusAttacks?: (BonusChoice & { why: string | null })[]
  onBonusAttack?: (choice: BonusChoice) => void
  /** Outside a fight: the Checks set, a d20 rolled for the DM (who says what it was), in one of three ways. */
  onRollForDm?: ((mode: RollMode) => void) | null
  /** Things in the pack that can be used (a potion, a kit, a flask), and why each can't be now, or null. */
  items?: { item: InventoryItem; use: Usable; why: string | null }[]
  onUseItem?: (entry: { item: InventoryItem; use: Usable }) => void
  disabled?: boolean
  className?: string
}

type Card = {
  key: string
  tag: string
  tone: 'action' | 'feature' | 'spell' | 'bonus' | 'roll'
  icon: IconName
  name: string
  detail: string
  why: string | null
  info: CardDetails
  spent: boolean
  /** A concentration spell: a C seal on the card. */
  concentration?: boolean
  play: () => void
}

type CardSet = 'weapons' | 'spells' | 'bonus' | 'checks' | 'items'

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
 * a card for 2 seconds shows what it does. Concentration spells carry a C seal.
 */
export function Hand({
  character,
  onAttack,
  onUseFeature,
  spells = null,
  turn = null,
  bonusMoves = [],
  onBonusMove,
  bonusAttacks = [],
  onBonusAttack,
  onRollForDm = null,
  items = [],
  onUseItem,
  disabled,
  className,
}: HandProps) {
  const sheet = deriveSheet(character)
  const [showing, setShowing] = useState<CardSet>('weapons')
  // Hovering on a card for 2 seconds shows what it does.
  const [about, setAbout] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const hover = (key: string | null) => {
    clearTimeout(timer.current)
    setAbout(null)
    if (key) timer.current = setTimeout(() => setAbout(key), 2000)
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
      tag: `${bonus ? 'Bonus · ' : ''}${levelWords(spell.level)}`,
      concentration: spell.concentration,
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
      icon: weaponIcon(entry.weapon || entry.name),
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
    info: moveDetails(MOVE_WORDS[move][0], MOVE_WORDS[move][1]),
    spent: bonusWhy !== null,
    play: () => onBonusMove?.(move),
  })

  const bonusAttackCard = (choice: BonusChoice & { why: string | null }): Card => {
    const why = choice.why ?? bonusWhy
    return {
      key: `bonus-${choice.entry.key}`,
      tag: 'Bonus action',
      tone: 'bonus',
      icon: choice.entry.attack === 'frenzy' ? weaponIcon(choice.attack.weapon || choice.attack.name) : 'powers',
      name: choice.label,
      detail: choice.entry.cost ?? (choice.entry.trigger === 'afterAttack' ? 'After you attack' : 'While raging'),
      why,
      info: {
        kind: 'move',
        title: choice.label,
        icon: 'powers',
        stats: [
          { label: 'Takes', value: 'Bonus action' },
          { label: 'Costs', value: choice.entry.cost ?? 'Nothing more' },
        ],
        bullets: [choice.entry.what],
        footer: [choice.entry.source, ''],
        cost: 'bonus',
      },
      spent: why !== null,
      play: () => onBonusAttack?.(choice),
    }
  }

  // Features a bonus action card stands for (Cunning Action, Martial Arts) aren't shown twice.
  const covered = coveredFeatures(character)
  const usable = character.features.filter((f) => f.usesMax !== null && !covered.has(f.name.trim().toLowerCase()))
  const weaponCards = [...character.attacks.map((entry) => attackCard(entry, false)), ...usable.map(featureCard)]
  const spellCards = castable.map(spellCard)
  // Light melee weapons, for an off-hand attack, when there are two of them.
  const light = character.attacks.filter((a) => {
    const weapon = findWeapon(a.weapon)
    return Boolean(weapon && weapon.range === 'Melee' && weapon.properties.includes('light'))
  })
  const bonusCards = [
    ...bonusMoves.map(moveCard),
    ...bonusAttacks.map(bonusAttackCard),
    ...character.features
      .filter((f) => featureCost(f.name, f.description) === 'bonus' && !covered.has(f.name.trim().toLowerCase()))
      .map(featureCard),
    ...castable.filter((s) => castingCost(s.castingTime) === 'bonus').map(spellCard),
    ...(light.length >= 2 ? light.map((entry) => attackCard(entry, true)) : []),
  ]

  const itemCard = ({ item, use, why }: { item: InventoryItem; use: Usable; why: string | null }): Card => ({
    key: `item-${item.id}`,
    tag: 'Item',
    tone: 'action',
    icon: use.kind === 'heal' || use.kind === 'effect' ? 'potion' : use.kind === 'throw' ? 'flame' : 'items',
    name: item.name,
    detail: item.uses !== null ? `${item.uses} uses left` : item.quantity > 1 ? `${item.quantity} left` : '1 left',
    why,
    info: {
      kind: 'feature',
      title: item.name,
      icon: use.kind === 'heal' || use.kind === 'effect' ? 'potion' : 'items',
      stats: [
        { label: 'Takes', value: 'Your action' },
        { label: 'Left', value: item.uses !== null ? `${item.uses} uses` : String(item.quantity) },
      ],
      bullets: [use.what],
      footer: ['Item', ''],
      cost: 'action',
    },
    spent: why !== null,
    play: () => onUseItem?.({ item, use }),
  })

  // Rolls for the DM: the same size as every other card, so the hand doesn't jump.
  const rollCard = (mode: RollMode, name: string, detail: string, what: string): Card => ({
    key: `roll-${mode}`,
    tag: 'Check',
    tone: 'roll',
    icon: 'd20',
    name,
    detail,
    why: null,
    info: {
      kind: 'move',
      title: name,
      icon: 'd20',
      stats: [
        { label: 'Dice', value: mode === 'normal' ? 'One d20' : 'Two d20s' },
        { label: 'Keeps', value: mode === 'advantage' ? 'The higher' : mode === 'disadvantage' ? 'The lower' : 'It' },
      ],
      bullets: [what, 'The DM says what it was for, adds your bonus and tells you how it went'],
      footer: ['A roll for the DM', ''],
      cost: 'free',
    },
    spent: false,
    play: () => onRollForDm?.(mode),
  })
  const checkCards = onRollForDm
    ? [
        rollCard('advantage', 'Advantage', 'Two dice, higher counts', 'When the DM says you have advantage'),
        rollCard('normal', 'Roll a d20', 'When the DM asks', 'When the DM asks you to roll'),
        rollCard('disadvantage', 'Disadvantage', 'Two dice, lower counts', 'When the DM says you have disadvantage'),
      ]
    : []

  const all: { key: CardSet; name: string; cards: Card[] }[] = [
    { key: 'weapons', name: 'Attacks and features', cards: weaponCards },
    { key: 'spells', name: 'Spells', cards: spells ? spellCards : [] },
    { key: 'bonus', name: 'Bonus actions', cards: bonusCards },
    { key: 'items', name: 'Items', cards: items.map(itemCard) },
    { key: 'checks', name: 'Checks', cards: checkCards },
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
