import { cx } from '../../components/cx.ts'
import { Pips } from '../../components/Pips.tsx'
import type { Combatant } from '../../live/combat.ts'
import type { Character, Spellcasting } from '../../rules/character.ts'
import { slotsLeft, spellSummary } from '../../rules/spells.ts'
import type { SrdSpell } from '../../rules/srd/index.ts'
import fight from './Fight.module.css'
import styles from './SpellParts.module.css'
import { levelWords, srdSpellFor, whyNot } from './useCasting.ts'

/** Spell slots left at each level, as pips: "1st ●●○ · 2nd ●○". */
export function SlotPips({ spellcasting, className }: { spellcasting: Spellcasting; className?: string }) {
  const levels = spellcasting.slotsMax.flatMap((max, i) => (max > 0 ? [i + 1] : []))
  if (levels.length === 0) return null
  return (
    <span className={cx(styles.slots, className)} aria-label="Spell slots left">
      {levels.map((level) => (
        <span key={level} className={styles.slotLevel}>
          <span className={styles.slotWord}>{levelWords(level)}</span>
          <Pips
            label={`${levelWords(level)}-level slots left`}
            total={spellcasting.slotsMax[level - 1]}
            filled={slotsLeft(spellcasting, level)}
          />
        </span>
      ))}
    </span>
  )
}

/** "Concentrating: Bless" with a button to drop it, and the save owed after taking damage. */
export function ConcentrationChip({
  character,
  onLostIt,
  onSave,
  rolling,
}: {
  character: Character
  onLostIt?: () => void
  onSave?: () => void
  rolling?: boolean
}) {
  if (!character.concentration) return null
  return (
    <div className={cx(styles.concentration, character.concentrationDc !== null && styles.owed)}>
      <span className={styles.badge} title="Concentration">
        C
      </span>
      <span className={styles.concentrationWords}>
        Concentrating: <strong>{character.concentration}</strong>
        {character.concentrationDc !== null && <> · save DC {character.concentrationDc} to keep it</>}
      </span>
      {onSave && character.concentrationDc !== null && (
        <button type="button" className={styles.save} disabled={rolling} onClick={onSave}>
          Roll the save
        </button>
      )}
      {onLostIt && (
        <button type="button" className={styles.lost} onClick={onLostIt} title="The spell ends">
          Lost it
        </button>
      )}
    </div>
  )
}

type SpellListProps = {
  character: Character
  spells: SrdSpell[] | null
  /** In a fight: the turn record that decides what can be cast now. Leave out for the DM acting for them. */
  combatant?: Combatant | null
  myTurn?: boolean
  onCast: (spell: SrdSpell) => void
  rolling?: boolean
}

/** The spells on a sheet that can be cast in a fight, by level, each a click away (then its target). */
export function SpellList({ character, spells, combatant = null, myTurn = true, onCast, rolling }: SpellListProps) {
  const known = character.spellcasting.spells
    .filter((entry) => entry.prepared || entry.level === 0)
    .flatMap((entry) => {
      const spell = srdSpellFor(entry, spells)
      return spell ? [spell] : []
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  if (known.length === 0) return null
  return (
    <ul className={fight.actions}>
      {known.map((spell) => {
        const why = whyNot(spell, character, combatant, myTurn)
        return (
          <li key={spell.index}>
            <button
              type="button"
              className={fight.action}
              disabled={Boolean(why) || rolling}
              title={why ?? `${spell.castingTime} · ${spell.range}${spell.concentration ? ' · concentration' : ''}`}
              onClick={() => onCast(spell)}
            >
              <span className={fight.actionName}>
                {spell.name}
                <span className={styles.level}> · {levelWords(spell.level)}</span>
                {spell.concentration && (
                  <span className={styles.badge} title="Concentration">
                    C
                  </span>
                )}
              </span>
              <span className={fight.actionText}>{why ?? (spellSummary(spell, character) || spell.castingTime)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
