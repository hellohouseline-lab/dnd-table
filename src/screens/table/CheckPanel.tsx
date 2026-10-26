import { cx } from '../../components/cx.ts'
import { ABILITIES, ABILITY_NAME } from '../../rules/abilities.ts'
import { PRESET_KEYS, findAskable, type Askable } from '../../rules/askable.ts'
import type { Character } from '../../rules/character.ts'
import type { RollMode } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import type { SheetRolls } from '../sheet/SheetTab.tsx'
import styles from './CheckPanel.module.css'

type CheckPanelProps = {
  character: Character
  rolls: SheetRolls
  mode: RollMode
  onModeChange: (mode: RollMode) => void
  disabled?: boolean
}

const MODES: { mode: RollMode; label: string }[] = [
  { mode: 'advantage', label: 'Advantage' },
  { mode: 'normal', label: 'Normal' },
  { mode: 'disadvantage', label: 'Disadvantage' },
]

/**
 * The Checks set in the hand, outside a fight: roll any skill, saving throw or ability check
 * yourself ("I search the room"), with advantage, normal or disadvantage picked first. The dice
 * land for everyone as usual, and the DM sees what it was.
 */
export function CheckPanel({ character, rolls, mode, onModeChange, disabled }: CheckPanelProps) {
  const sheet = deriveSheet(character)
  const bonusFor = (askable: Askable) => {
    if (askable.kind === 'skill') return sheet.skills.find((s) => s.index === askable.skill)?.bonus ?? 0
    if (askable.kind === 'save') return sheet.saves.find((s) => s.ability === askable.ability)?.bonus ?? 0
    return sheet.modifiers[askable.ability]
  }
  const roll = (askable: Askable) => {
    if (askable.kind === 'skill' && askable.skill) rolls.skill(askable.skill)
    else if (askable.kind === 'save') rolls.save(askable.ability)
    else rolls.ability(askable.ability)
  }
  const button = (askable: Askable, name = askable.name) => (
    <button
      key={askable.key}
      type="button"
      className={styles.check}
      disabled={disabled}
      title={askable.short}
      onClick={() => roll(askable)}
    >
      {name} <span className={styles.bonus}>{formatBonus(bonusFor(askable))}</span>
    </button>
  )
  const find = (key: string) => findAskable(key)
  const listed = (keys: string[]) => keys.map(find).filter((a): a is Askable => a !== undefined)

  return (
    <section className={styles.panel} aria-label="Roll a check">
      <div className={styles.top}>
        <span className={styles.title}>Roll a check</span>
        <div className={styles.modes} role="group" aria-label="How to roll">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              className={cx(styles.mode, mode === m.mode && styles.modeOn, styles[m.mode])}
              aria-pressed={mode === m.mode}
              onClick={() => onModeChange(m.mode)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Most used</div>
          <div className={styles.checks}>{listed([...PRESET_KEYS]).map((a) => button(a))}</div>
        </div>
        <details className={styles.section}>
          <summary className={styles.sectionTitle}>Skills</summary>
          <div className={styles.checks}>
            {sheet.skills.map((skill) => {
              const askable = find(`skill:${skill.index}`)
              return askable ? button(askable) : null
            })}
          </div>
        </details>
        <details className={styles.section}>
          <summary className={styles.sectionTitle}>Saving throws</summary>
          <div className={styles.checks}>
            {listed(ABILITIES.map((a) => `save:${a}`)).map((a) => button(a, ABILITY_NAME[a.ability]))}
          </div>
        </details>
        <details className={styles.section}>
          <summary className={styles.sectionTitle}>Ability checks</summary>
          <div className={styles.checks}>
            {listed(ABILITIES.map((a) => `ability:${a}`)).map((a) => button(a, ABILITY_NAME[a.ability]))}
          </div>
        </details>
      </div>
      {mode !== 'normal' && <p className={styles.note}>Your next roll is with {mode}.</p>}
    </section>
  )
}
