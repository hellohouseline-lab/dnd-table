import { Pips } from '../../components/Pips.tsx'
import type { Character } from '../../rules/character.ts'
import { findCondition } from '../../rules/srd/index.ts'
import styles from './AtAGlance.module.css'
import { SlotPips } from './SpellParts.tsx'

const BACK = { short: 'back after a short rest', long: 'back after a long rest' }

/**
 * A character's cheat card in a fight: spell slots left, conditions with what they do, and
 * features with their uses and when they come back. Shown under Your turn, and on the DM's
 * Acting now card for a character.
 */
export function AtAGlance({ character }: { character: Character }) {
  const features = character.features.filter((f) => f.usesMax !== null)
  const slots = character.spellcasting.slotsMax.some((max) => max > 0)
  if (!slots && features.length === 0 && character.conditions.length === 0) return null
  return (
    <section className={styles.glance} aria-label="At a glance">
      <div className={styles.title}>At a glance</div>
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
