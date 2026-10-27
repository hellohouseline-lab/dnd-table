import { useState } from 'react'
import { ABILITY_NAME, type Ability } from '../../rules/abilities.ts'
import { CONDITION_WORD, type ClockChoice, type HowLong } from '../../rules/conditionClocks.ts'
import { CONDITIONS } from '../../rules/srd/index.ts'
import styles from './ConditionPicker.module.css'

type Concentrating = { characterId: string; name: string; spell: string }

type ConditionPickerProps = {
  /** Conditions it already has, left out of the list. */
  has: string[]
  /** Casters concentrating now, to tie a condition to (Hold Person). */
  concentrating: Concentrating[]
  onApply: (condition: string, choice: ClockChoice) => void
}

const HOW_LONG: { key: string; label: string; value: HowLong }[] = [
  { key: 'removed', label: 'Until I take it off', value: { kind: 'removed' } },
  { key: 'end-of-turn', label: 'Until the end of their next turn', value: { kind: 'end-of-turn' } },
  ...[1, 2, 3, 4, 5].map((rounds) => ({
    key: `rounds-${rounds}`,
    label: rounds === 1 ? '1 round' : `${rounds} rounds`,
    value: { kind: 'rounds' as const, rounds },
  })),
  { key: 'rounds-10', label: '1 minute (10 rounds)', value: { kind: 'rounds', rounds: 10 } },
]

const ABILITIES = Object.keys(ABILITY_NAME) as Ability[]

/**
 * Add a condition, then How long? (decision 72): until taken off, the end of their next turn, some
 * rounds; a save at the end of each of their turns; tied to a caster's concentration; and, for a
 * grab or a web, the DC to break free.
 */
export function ConditionPicker({ has, concentrating, onApply }: ConditionPickerProps) {
  const [condition, setCondition] = useState('')
  const [howLong, setHowLong] = useState('removed')
  const [saveAbility, setSaveAbility] = useState<Ability | ''>('')
  const [dc, setDc] = useState(13)
  const [secret, setSecret] = useState(false)
  const [caster, setCaster] = useState('')
  const [escapeDc, setEscapeDc] = useState('')
  const available = CONDITIONS.filter((c) => c.index !== 'exhaustion' && !has.includes(c.index))
  const holds = ['grappled', 'restrained'].includes(condition)

  function apply() {
    const who = concentrating.find((c) => c.characterId === caster)
    onApply(condition, {
      howLong: HOW_LONG.find((h) => h.key === howLong)?.value ?? { kind: 'removed' },
      save: saveAbility ? { ability: saveAbility, dc, secret } : null,
      caster: who ? { characterId: who.characterId, spell: who.spell } : null,
      escapeDc: holds && escapeDc ? Number(escapeDc) : null,
    })
    setCondition('')
    setHowLong('removed')
    setSaveAbility('')
    setCaster('')
    setEscapeDc('')
  }

  if (!condition) {
    return (
      <select aria-label="Add a condition" value="" onChange={(event) => setCondition(event.target.value)}>
        <option value="">Add a condition…</option>
        {available.map((c) => (
          <option key={c.index} value={c.index}>
            {CONDITION_WORD[c.index] ?? c.name}
          </option>
        ))}
      </select>
    )
  }

  const name = CONDITION_WORD[condition] ?? CONDITIONS.find((c) => c.index === condition)?.name ?? condition
  return (
    <div className={styles.picker} role="group" aria-label={`How long is it ${name.toLowerCase()}?`}>
      <div className={styles.title}>{name}: how long?</div>
      <label className={styles.field}>
        <span>Lasts</span>
        <select aria-label="How long" value={howLong} onChange={(event) => setHowLong(event.target.value)}>
          {HOW_LONG.map((h) => (
            <option key={h.key} value={h.key}>
              {h.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Save each turn</span>
        <select
          aria-label="Save each turn"
          value={saveAbility}
          onChange={(event) => setSaveAbility(event.target.value as Ability | '')}
        >
          <option value="">No save</option>
          {ABILITIES.map((a) => (
            <option key={a} value={a}>
              {ABILITY_NAME[a]}
            </option>
          ))}
        </select>
        {saveAbility && (
          <>
            <input
              type="number"
              className={styles.dc}
              aria-label="Save DC"
              min={1}
              max={30}
              value={dc}
              onChange={(event) => setDc(Number(event.target.value) || 10)}
            />
            <label className={styles.tick}>
              <input type="checkbox" checked={secret} onChange={(event) => setSecret(event.target.checked)} /> Keep the
              DC secret
            </label>
          </>
        )}
      </label>
      {concentrating.length > 0 && (
        <label className={styles.field}>
          <span>Ends with</span>
          <select
            aria-label="Ends with concentration"
            value={caster}
            onChange={(event) => setCaster(event.target.value)}
          >
            <option value="">Nobody&rsquo;s concentration</option>
            {concentrating.map((c) => (
              <option key={c.characterId} value={c.characterId}>
                {c.name}&rsquo;s {c.spell}
              </option>
            ))}
          </select>
        </label>
      )}
      {holds && (
        <label className={styles.field}>
          <span>Break free DC</span>
          <input
            type="number"
            className={styles.dc}
            aria-label="Break free DC"
            min={1}
            max={30}
            placeholder="none"
            value={escapeDc}
            onChange={(event) => setEscapeDc(event.target.value)}
          />
        </label>
      )}
      <div className={styles.buttons}>
        <button type="button" className={styles.apply} onClick={apply}>
          Put it on
        </button>
        <button type="button" className={styles.cancel} onClick={() => setCondition('')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
