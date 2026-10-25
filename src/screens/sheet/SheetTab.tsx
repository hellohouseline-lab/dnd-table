import { useState, type FormEvent, type ReactNode } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { cx } from '../../components/cx.ts'
import { HpBar } from '../../components/HpBar.tsx'
import { Icon } from '../../components/Icon.tsx'
import { Pips } from '../../components/Pips.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import type { TrackerPatch } from '../../live/characterRows.ts'
import { ABILITIES, ABILITY_NAME, ABILITY_SHORT } from '../../rules/abilities.ts'
import type { Character } from '../../rules/character.ts'
import type { SkillRank } from '../../rules/maths/checks.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { gainTempHp, heal, takeDamage } from '../../rules/maths/hitPoints.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { CONDITIONS, findCondition, findWeapon } from '../../rules/srd/index.ts'
import styles from './sheet.module.css'

type TabProps = { character: Character; canEdit: boolean; onUpdate: (patch: TrackerPatch) => void }

/** Abilities, saves, skills, hit points and the other things that change in play, and attacks. */
export function SheetTab({ character, canEdit, onUpdate }: TabProps) {
  const sheet = deriveSheet(character)
  const edit = canEdit ? onUpdate : undefined

  return (
    <div className={styles.sheetColumns}>
      <div className={styles.column}>
        <Section title="Abilities">
          <div className={styles.abilityGrid}>
            {ABILITIES.map((ability) => (
              <div key={ability} className={styles.ability} title={ABILITY_NAME[ability]}>
                <span className={styles.abilityShort}>{ABILITY_SHORT[ability]}</span>
                <span className={styles.medallion}>{formatBonus(sheet.modifiers[ability])}</span>
                <span className={styles.abilityScore}>{character.scores[ability]}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Saving throws">
          <ul className={styles.rows}>
            {sheet.saves.map((save) => (
              <li key={save.ability} className={styles.row}>
                <RankMarker rank={save.proficient ? 'proficient' : 'none'} />
                <span className={styles.rowName}>{ABILITY_NAME[save.ability]}</span>
                <span className={styles.bonus}>{formatBonus(save.bonus)}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Passive senses">
          <ul className={styles.rows}>
            <PassiveRow name="Perception" value={sheet.passivePerception} />
            <PassiveRow name="Insight" value={sheet.passiveInsight} />
            <PassiveRow name="Investigation" value={sheet.passiveInvestigation} />
          </ul>
        </Section>
      </div>

      <div className={styles.column}>
        <Section title="Skills" note="● proficient  ◆ expertise">
          <ul className={styles.rows}>
            {sheet.skills.map((skill) => (
              <li key={skill.index} className={styles.row}>
                <RankMarker rank={skill.rank} />
                <span className={styles.rowName}>
                  {skill.name} <span className={styles.muted}>({ABILITY_SHORT[skill.ability]})</span>
                </span>
                <span className={styles.bonus}>{formatBonus(skill.bonus)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className={styles.column}>
        <HitPoints character={character} onUpdate={edit} />
        <div className={styles.statRow}>
          <StatBox label="AC" value={character.armourClass} title="Armour class" />
          <StatBox label="Init." value={formatBonus(sheet.initiative)} title="Initiative" />
          <StatBox label="Speed" value={character.speed} title="Speed in feet" />
          <StatBox label="Prof." value={formatBonus(sheet.proficiencyBonus)} title="Proficiency bonus" />
        </div>

        <div className={styles.trackerGrid}>
          <Section title="Hit dice">
            <div className={styles.inline}>
              <Pips
                label="Hit dice left"
                total={sheet.hitDice.total}
                filled={sheet.hitDice.left}
                onChange={edit && ((left) => edit({ hitDiceUsed: sheet.hitDice.total - left }))}
              />
              <span className={styles.muted}>
                d{sheet.hitDice.die}, {sheet.hitDice.left} of {sheet.hitDice.total} left
              </span>
            </div>
          </Section>
          <Section title="Death saves">
            <div className={styles.deathSaves}>
              <span className={styles.muted}>Successes</span>
              <Pips
                label="Death save successes"
                tone="pass"
                total={3}
                filled={character.deathSaveSuccesses}
                onChange={edit && ((n) => edit({ deathSaveSuccesses: n }))}
              />
              <span className={styles.muted}>Failures</span>
              <Pips
                label="Death save failures"
                tone="fail"
                total={3}
                filled={character.deathSaveFailures}
                onChange={edit && ((n) => edit({ deathSaveFailures: n }))}
              />
            </div>
          </Section>
        </div>

        <Section title="Conditions">
          <Conditions character={character} onUpdate={edit} />
        </Section>

        <div className={styles.inlineSplit}>
          <Exhaustion level={character.exhaustion} onUpdate={edit} />
          <button
            type="button"
            className={cx(styles.toggle, character.inspiration && styles.toggleOn)}
            aria-pressed={character.inspiration}
            disabled={!edit}
            onClick={() => edit?.({ inspiration: !character.inspiration })}
          >
            <Icon name="star" size={16} filled={character.inspiration} />
            Inspiration: {character.inspiration ? 'yes' : 'not yet'}
          </button>
        </div>

        <Section title="Attacks">
          {sheet.attacks.length === 0 ? (
            <p className={styles.empty}>No attacks yet. Add weapons with Edit character.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Attack</th>
                  <th scope="col">To hit</th>
                  <th scope="col">Damage</th>
                </tr>
              </thead>
              <tbody>
                {sheet.attacks.map(({ entry, result }) => {
                  const weapon = findWeapon(entry.weapon)
                  return (
                    <tr key={entry.id}>
                      <th scope="row">
                        {entry.name || weapon?.name || 'Attack'}
                        {weapon?.normalRange && (
                          <span className={styles.muted}>
                            {' '}
                            {weapon.normalRange}/{weapon.longRange} ft
                          </span>
                        )}
                      </th>
                      <td className={styles.bonus}>{formatBonus(result.toHit)}</td>
                      <td>
                        {result.damage} {result.damageType.toLowerCase()}
                        {result.versatileDamage && (
                          <span className={styles.muted}> ({result.versatileDamage} two hands)</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Proficiencies and languages">
          <p className={styles.text}>{character.otherProficiencies || 'None noted.'}</p>
          <p className={styles.text}>
            <span className={styles.muted}>Languages:</span> {character.languages || 'None noted.'}
          </p>
        </Section>
      </div>
    </div>
  )
}

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title}
        {note && <span className={styles.sectionNote}>{note}</span>}
      </h3>
      {children}
    </section>
  )
}

function RankMarker({ rank }: { rank: SkillRank }) {
  const label = { none: 'Not proficient', proficient: 'Proficient', expertise: 'Expertise' }[rank]
  return (
    <span className={cx(styles.marker, styles[rank])} title={label} aria-label={label} role="img">
      {rank === 'expertise' ? '◆' : rank === 'proficient' ? '●' : '○'}
    </span>
  )
}

function PassiveRow({ name, value }: { name: string; value: number }) {
  return (
    <li className={styles.row}>
      <span className={styles.rowName}>{name}</span>
      <span className={styles.bonus}>{value}</span>
    </li>
  )
}

function HitPoints({ character, onUpdate }: { character: Character; onUpdate?: (patch: TrackerPatch) => void }) {
  const [amount, setAmount] = useState('')
  const hp = { current: character.currentHp, max: character.maxHp, temp: character.tempHp }
  const value = Math.max(0, Math.trunc(Number(amount)) || 0)

  function apply(change: typeof hp) {
    onUpdate?.({ currentHp: change.current, tempHp: change.temp })
    setAmount('')
  }

  function damage(event: FormEvent) {
    event.preventDefault()
    if (value > 0) apply(takeDamage(hp, value))
  }

  return (
    <div className={styles.hitPoints}>
      <div className={styles.hpHeader}>
        <span className={styles.sectionTitle}>Hit points</span>
        <span className={styles.hpValue}>
          {hp.current} <span className={styles.hpMax}>/ {hp.max}</span>
          {hp.temp > 0 && <span className={styles.hpTemp}> +{hp.temp} temp</span>}
        </span>
      </div>
      <HpBar current={hp.current} max={hp.max} temp={hp.temp} height={10} />
      {hp.current === 0 && <p className={styles.downed}>Down at 0 hit points: roll a death save on each of your turns.</p>}
      {onUpdate && (
        <form className={styles.hpControls} onSubmit={damage}>
          <label className={styles.visuallyHidden} htmlFor={`hp-amount-${character.id}`}>
            Amount
          </label>
          <input
            id={`hp-amount-${character.id}`}
            className={styles.hpInput}
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button type="submit" className={buttonClassName('outline', { size: 'small' })} disabled={!value}>
            Damage
          </button>
          <button
            type="button"
            className={buttonClassName('outline', { size: 'small' })}
            disabled={!value}
            onClick={() => apply(heal(hp, value))}
          >
            Heal
          </button>
          <button
            type="button"
            className={buttonClassName('quiet')}
            disabled={!value}
            onClick={() => apply(gainTempHp(hp, value))}
            title="Temporary hit points don't stack: you keep the higher amount"
          >
            Set temp HP
          </button>
        </form>
      )}
    </div>
  )
}

function Conditions({ character, onUpdate }: { character: Character; onUpdate?: (patch: TrackerPatch) => void }) {
  const active = character.conditions
  const available = CONDITIONS.filter((c) => c.index !== 'exhaustion' && !active.includes(c.index))
  return (
    <div className={styles.chips}>
      {active.length === 0 && <span className={styles.empty}>None</span>}
      {active.map((index) => {
        const condition = findCondition(index)
        return (
          <span key={index} className={styles.chip} title={condition?.desc}>
            {condition?.name ?? index}
            {onUpdate && (
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Remove ${condition?.name ?? index}`}
                onClick={() => onUpdate({ conditions: active.filter((c) => c !== index) })}
              >
                ×
              </button>
            )}
          </span>
        )
      })}
      {onUpdate && (
        <select
          className={styles.addSelect}
          aria-label="Add a condition"
          value=""
          onChange={(event) => event.target.value && onUpdate({ conditions: [...active, event.target.value] })}
        >
          <option value="">Add a condition…</option>
          {available.map((c) => (
            <option key={c.index} value={c.index}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function Exhaustion({ level, onUpdate }: { level: number; onUpdate?: (patch: TrackerPatch) => void }) {
  const description = findCondition('exhaustion')?.desc
  return (
    <span className={styles.exhaustion} title={description}>
      <span className={styles.muted}>Exhaustion</span>
      {onUpdate && (
        <button
          type="button"
          className={styles.stepper}
          aria-label="Less exhaustion"
          disabled={level <= 0}
          onClick={() => onUpdate({ exhaustion: level - 1 })}
        >
          −
        </button>
      )}
      <strong>{level}</strong>
      {onUpdate && (
        <button
          type="button"
          className={styles.stepper}
          aria-label="More exhaustion"
          disabled={level >= 6}
          onClick={() => onUpdate({ exhaustion: level + 1 })}
        >
          +
        </button>
      )}
    </span>
  )
}
