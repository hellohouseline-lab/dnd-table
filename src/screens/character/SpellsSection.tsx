import { useState, type KeyboardEvent } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { SelectField } from '../../components/Field.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useSrd } from '../../live/useSrd.ts'
import { ABILITIES, ABILITY_NAME, isAbility } from '../../rules/abilities.ts'
import { entryId, type CharacterBuild, type SpellEntry } from '../../rules/character.ts'
import { spellAttackBonus, spellSaveDc } from '../../rules/maths/attacks.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { slotsFor } from '../../rules/srd/defaults.ts'
import { byName, loadSpells } from '../../rules/srd/index.ts'
import { spellLevelName } from '../../rules/spellLevels.ts'
import styles from './form.module.css'
import type { SrdBundle } from './srdBundle.ts'

type SectionProps = { build: CharacterBuild; onChange: (build: CharacterBuild) => void; srd: SrdBundle }

/** Spellcasting ability, slots per level, and the spells the character knows or prepares. */
export function SpellsSection({ build, onChange, srd }: SectionProps) {
  const spells = useSrd(loadSpells)
  const srdClass = srd.classes ? byName(srd.classes, build.className) : undefined
  const [search, setSearch] = useState('')
  const [onlyClass, setOnlyClass] = useState(true)
  const { spellcasting } = build
  const setSpellcasting = (patch: Partial<typeof spellcasting>) =>
    onChange({ ...build, spellcasting: { ...spellcasting, ...patch } })

  const classIndex = srdClass?.index
  const choices = spells?.filter((s) => !onlyClass || !classIndex || s.classes.includes(classIndex)) ?? []
  const tableSlots = srdClass?.spellcastingAbility ? slotsFor(srdClass, build.level) : null
  const slotsDiffer = tableSlots && tableSlots.some((n, i) => n !== spellcasting.slotsMax[i])

  // This sits inside the character form, so it can't be a form of its own: Enter in the box adds
  // the spell instead of saving the whole character.
  function addSpell(event?: KeyboardEvent<HTMLInputElement>) {
    if (event) {
      if (event.key !== 'Enter') return
      event.preventDefault()
    }
    const name = search.trim()
    if (!name) return
    const known = spells ? byName(spells, name) : undefined
    const entry: SpellEntry = known
      ? { id: entryId(), index: known.index, name: known.name, level: known.level, prepared: true }
      : { id: entryId(), index: null, name, level: 1, prepared: true }
    setSpellcasting({ spells: [...spellcasting.spells, entry] })
    setSearch('')
  }

  const changeSpell = (id: string, patch: Partial<SpellEntry>) =>
    setSpellcasting({ spells: spellcasting.spells.map((s) => (s.id === id ? { ...s, ...patch } : s)) })

  const sorted = [...spellcasting.spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const ability = spellcasting.ability

  return (
    <Panel title="Spellcasting">
      <div className={styles.grid3}>
        <SelectField
          label="Spellcasting ability"
          value={ability ?? ''}
          onChange={(event) => setSpellcasting({ ability: isAbility(event.target.value) ? event.target.value : null })}
        >
          <option value="">No spellcasting</option>
          {ABILITIES.map((a) => (
            <option key={a} value={a}>
              {ABILITY_NAME[a]}
            </option>
          ))}
        </SelectField>
        {ability && (
          <p className={styles.note}>
            Spell save DC <span className={styles.bonus}>{spellSaveDc(build.scores[ability], build.level)}</span>, spell
            attack <span className={styles.bonus}>{formatBonus(spellAttackBonus(build.scores[ability], build.level))}</span>
          </p>
        )}
      </div>

      <div className={styles.form}>
        <span className={styles.note}>Spell slots for each spell level</span>
        <div className={styles.abilityGrid}>
          {spellcasting.slotsMax.map((max, i) => (
            <label key={i} className={styles.abilityField}>
              <span className={styles.muted}>{spellLevelName(i + 1)}</span>
              <input
                className={`${styles.input} ${styles.narrow}`}
                type="number"
                min={0}
                max={9}
                value={max}
                onChange={(event) => {
                  const value = Math.min(9, Math.max(0, Math.trunc(Number(event.target.value)) || 0))
                  setSpellcasting({
                    slotsMax: spellcasting.slotsMax.map((n, j) => (j === i ? value : n)),
                    slotsUsed: spellcasting.slotsUsed.map((n, j) => (j === i ? Math.min(n, value) : n)),
                  })
                }}
              />
            </label>
          ))}
        </div>
        {slotsDiffer && tableSlots && (
          <div className={styles.actions}>
            <span className={styles.note}>
              These don&rsquo;t match the table for a level {build.level} {srdClass?.name}.
            </span>
            <button
              type="button"
              className={buttonClassName('outline', { size: 'small' })}
              onClick={() => setSpellcasting({ slotsMax: tableSlots, slotsUsed: spellcasting.slotsUsed.map((n, i) => Math.min(n, tableSlots[i])) })}
            >
              Use the table
            </button>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <input
          className={`${styles.input} ${styles.grow}`}
          list="srd-spells"
          aria-label="Spell name"
          placeholder={spells ? 'Type a spell name' : 'Loading the spell list…'}
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={addSpell}
        />
        <button
          type="button"
          className={buttonClassName('outline', { size: 'small' })}
          disabled={!search.trim()}
          onClick={() => addSpell()}
        >
          Add spell
        </button>
        {classIndex && (
          <label className={styles.check}>
            <input type="checkbox" checked={onlyClass} onChange={(event) => setOnlyClass(event.target.checked)} />
            Only {srdClass?.name} spells
          </label>
        )}
        <datalist id="srd-spells">
          {choices.map((s) => (
            <option key={s.index} value={s.name}>
              {spellLevelName(s.level)}
            </option>
          ))}
        </datalist>
      </div>

      {sorted.length > 0 && (
        <ul className={styles.list}>
          {sorted.map((spell) => (
            <li key={spell.id} className={`${styles.item} ${styles.itemRow}`}>
              <span className={styles.grow}>
                {spell.name}
                {!spell.index && <span className={styles.muted}> (typed in)</span>}
              </span>
              <select
                className={styles.select}
                aria-label={`${spell.name} level`}
                value={spell.level}
                disabled={Boolean(spell.index)}
                onChange={(event) => changeSpell(spell.id, { level: Number(event.target.value) })}
              >
                {Array.from({ length: 10 }, (_, level) => (
                  <option key={level} value={level}>
                    {spellLevelName(level)}
                  </option>
                ))}
              </select>
              {spell.level > 0 && (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={spell.prepared}
                    onChange={(event) => changeSpell(spell.id, { prepared: event.target.checked })}
                  />
                  Prepared
                </label>
              )}
              <button
                type="button"
                className={buttonClassName('quiet')}
                onClick={() => setSpellcasting({ spells: spellcasting.spells.filter((s) => s.id !== spell.id) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
