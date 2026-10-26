import { Pips } from '../../components/Pips.tsx'
import type { Character, FeatureEntry } from '../../rules/character.ts'
import { featureCost, roundsLeftWords } from '../../rules/features.ts'
import { castingCost } from '../../rules/spells.ts'
import { findCondition, type SrdSpell } from '../../rules/srd/index.ts'
import styles from './AtAGlance.module.css'
import { SlotPips } from './SpellParts.tsx'
import { srdSpellFor } from './useCasting.ts'

/** Something to open from the card: a feature or a spell. */
export type GlanceOpen = { kind: 'feature'; feature: FeatureEntry } | { kind: 'spell'; spell: SrdSpell }

type AtAGlanceProps = {
  character: Character
  /** The SRD spells, to list bonus action and reaction spells (Healing Word, Shield). */
  spells?: SrdSpell[] | null
  /** Opens a feature's or spell's card (the player's own screen). */
  onOpen?: (open: GlanceOpen) => void
  /** Ends an effect, such as Rage. */
  onEndEffect?: (key: string) => void
}

const BACK = { short: 'back after a short rest', long: 'back after a long rest' }

/**
 * A character's cheat card in a fight: spell slots left, conditions with what they do, and
 * features with their uses and when they come back. Shown under Your turn, and on the DM's
 * Acting now card for a character.
 */
export function AtAGlance({ character, spells = null, onOpen, onEndEffect }: AtAGlanceProps) {
  const features = character.features.filter((f) => f.usesMax !== null)
  const slots = character.spellcasting.slotsMax.some((max) => max > 0)
  // What can be done with a bonus action or a reaction, so nobody forgets they have them.
  const known = character.spellcasting.spells.flatMap((entry) => {
    const spell = srdSpellFor(entry, spells)
    return spell && (entry.prepared || entry.level === 0) ? [spell] : []
  })
  const options = (cost: 'bonus' | 'reaction'): GlanceOpen[] => [
    ...character.features
      .filter((f) => featureCost(f.name, f.description) === cost)
      .map((feature) => ({ kind: 'feature' as const, feature })),
    ...known.filter((s) => castingCost(s.castingTime) === cost).map((spell) => ({ kind: 'spell' as const, spell })),
  ]
  const bonus = options('bonus')
  const reactions = options('reaction')
  const nameOf = (open: GlanceOpen) => (open.kind === 'feature' ? open.feature.name : open.spell.name)
  const choices = (list: GlanceOpen[]) =>
    list.map((open) =>
      onOpen ? (
        <button key={nameOf(open)} type="button" className={styles.option} onClick={() => onOpen(open)}>
          {nameOf(open)}
        </button>
      ) : (
        <span key={nameOf(open)} className={styles.optionText}>
          {nameOf(open)}
        </span>
      ),
    )
  if (
    !slots &&
    features.length === 0 &&
    character.conditions.length === 0 &&
    character.effects.length === 0 &&
    bonus.length === 0 &&
    reactions.length === 0
  ) {
    return null
  }
  return (
    <section className={styles.glance} aria-label="At a glance">
      <div className={styles.title}>At a glance</div>
      {character.effects.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Now</span>
          {character.effects.map((effect) => (
            <span key={effect.key} className={styles.effect}>
              {effect.name}
              {effect.roundsLeft !== undefined && (
                <span className={styles.roundsLeft}> · {roundsLeftWords(effect.roundsLeft)}</span>
              )}
              {onEndEffect && (
                <button type="button" className={styles.end} onClick={() => onEndEffect(effect.key)}>
                  End
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {bonus.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Bonus action</span>
          {choices(bonus)}
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.label}>Reaction</span>
        <span className={styles.optionText} title="When an enemy leaves your reach without Disengaging">
          Opportunity attack
        </span>
        {choices(reactions)}
      </div>
      {slots && (
        <div className={styles.row}>
          <span className={styles.label}>Slots</span>
          <SlotPips spellcasting={character.spellcasting} />
        </div>
      )}
      {character.conditions.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Conditions</span>
          <span className={styles.conditions}>
            {character.conditions.map((c) => {
              const condition = findCondition(c)
              return (
                <span key={c} className={styles.condition} title={condition?.desc}>
                  {condition?.name ?? c}
                </span>
              )
            })}
          </span>
        </div>
      )}
      {features.map((feature) => (
        <div key={feature.id} className={styles.row}>
          <span className={styles.feature} title={feature.description}>
            {feature.name}
          </span>
          <Pips label={`${feature.name} uses left`} total={feature.usesMax ?? 0} filled={feature.usesLeft} />
          {feature.recharge && <span className={styles.back}>{BACK[feature.recharge]}</span>}
        </div>
      ))}
    </section>
  )
}
