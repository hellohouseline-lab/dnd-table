import { useState, type FormEvent, type ReactNode } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { cx } from '../../components/cx.ts'
import { aOrAn } from '../../components/words.ts'
import { HpBar } from '../../components/HpBar.tsx'
import { Icon } from '../../components/Icon.tsx'
import { Pips } from '../../components/Pips.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import type { TrackerPatch } from '../../live/characterRows.ts'
import { ABILITIES, ABILITY_NAME, ABILITY_SHORT, type Ability } from '../../rules/abilities.ts'
import type { AttackEntry, Character } from '../../rules/character.ts'
import type { SkillRank } from '../../rules/maths/checks.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { gainTempHp, heal, takeDamage } from '../../rules/maths/hitPoints.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { CONDITIONS, findCondition, findWeapon } from '../../rules/srd/index.ts'
import styles from './sheet.module.css'
import { DAMAGE_TYPES } from '../../rules/damage.ts'

/** What clicking a number on the sheet rolls. Without it, the sheet only shows the numbers. */
export type SheetRolls = {
  ability: (ability: Ability) => void
  save: (ability: Ability) => void
  skill: (index: string) => void
  initiative: () => void
  attack: (attack: AttackEntry) => void
  /** Spends one hit die on a short rest: rolls it and heals. */
  hitDie?: () => void
  disabled?: boolean
}

type TabProps = { character: Character; canEdit: boolean; onUpdate: (patch: TrackerPatch) => void; rolls?: SheetRolls }

/** Abilities, saves, skills, hit points and the other things that change in play, and attacks. */
export function SheetTab({ character, canEdit, onUpdate, rolls }: TabProps) {
  const sheet = deriveSheet(character)
  const edit = canEdit ? onUpdate : undefined

  return (
    <div className={styles.sheetColumns}>
      <div className={styles.column}>
        <Section title="Abilities">
          <div className={styles.abilityGrid}>
            {ABILITIES.map((ability) => {
              const inside = (
                <>
                  <span className={styles.abilityShort}>{ABILITY_SHORT[ability]}</span>
                  <span className={styles.medallion}>{formatBonus(sheet.modifiers[ability])}</span>
                  <span className={styles.abilityScore}>{character.scores[ability]}</span>
                </>
              )
              return rolls ? (
                <button
                  key={ability}
                  type="button"
                  className={cx(styles.ability, styles.rollable)}
                  title={`Roll ${aOrAn(ABILITY_NAME[ability])} check`}
                  disabled={rolls.disabled}
                  onClick={() => rolls.ability(ability)}
                >
                  {inside}
                </button>
              ) : (
                <div key={ability} className={styles.ability} title={ABILITY_NAME[ability]}>
                  {inside}
                </div>
              )
            })}
          </div>
        </Section>
        <Section title="Saving throws">
          <ul className={styles.rows}>
            {sheet.saves.map((save) => (
              <RollRow
                key={save.ability}
                title={`Roll ${aOrAn(ABILITY_NAME[save.ability])} save`}
                onRoll={rolls && (() => rolls.save(save.ability))}
                disabled={rolls?.disabled}
              >
                <RankMarker rank={save.proficient ? 'proficient' : 'none'} />
                <span className={styles.rowName}>{ABILITY_NAME[save.ability]}</span>
                <span className={styles.bonus}>{formatBonus(save.bonus)}</span>
              </RollRow>
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
        <Section title="Skills" note={rolls ? 'Click any to roll' : '● proficient  ◆ expertise'}>
          <ul className={styles.rows}>
            {sheet.skills.map((skill) => (
              <RollRow
                key={skill.index}
                title={`Roll ${aOrAn(skill.name)} check`}
                onRoll={rolls && (() => rolls.skill(skill.index))}
                disabled={rolls?.disabled}
              >
                <RankMarker rank={skill.rank} />
                <span className={styles.rowName}>
                  {skill.name} <span className={styles.muted}>({ABILITY_SHORT[skill.ability]})</span>
                </span>
                <span className={styles.bonus}>{formatBonus(skill.bonus)}</span>
              </RollRow>
            ))}
          </ul>
        </Section>
      </div>

      <div className={styles.column}>
        <HitPoints character={character} onUpdate={edit} />
        <div className={styles.statRow}>
          <StatBox label="AC" value={character.armourClass} title="Armour class" />
          <StatBox
            label="Init."
            value={formatBonus(sheet.initiative)}
            title={rolls ? 'Roll initiative' : 'Initiative'}
            onClick={rolls?.initiative}
            disabled={rolls?.disabled}
          />
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
              {rolls?.hitDie && (
                <button
                  type="button"
                  className={buttonClassName('quiet')}
                  disabled={rolls.disabled || sheet.hitDice.left === 0 || character.currentHp >= character.maxHp}
                  title="On a short rest: roll one hit die and heal that much plus your Constitution modifier"
                  onClick={rolls.hitDie}
                >
                  Spend one
                </button>
              )}
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

        <Section title="Damage defences">
          <DamageDefences character={character} onUpdate={edit} />
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
                  {rolls && (
                    <th scope="col">
                      <span className={styles.visuallyHidden}>Roll</span>
                    </th>
                  )}
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
                      {rolls && (
                        <td>
                          <button
                            type="button"
                            className={buttonClassName('outline', { size: 'small' })}
                            disabled={rolls.disabled}
                            onClick={() => rolls.attack(entry)}
                          >
                            Roll
                          </button>
                        </td>
                      )}
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

/** A row on the sheet; with `onRoll`, the whole row is a button that rolls it. */
function RollRow({
  title,
  onRoll,
  disabled,
  children,
}: {
  title: string
  onRoll?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  if (!onRoll) return <li className={styles.row}>{children}</li>
  return (
    <li>
      <button
        type="button"
        className={cx(styles.row, styles.rollRow)}
        title={title}
        disabled={disabled}
        onClick={onRoll}
      >
        {children}
      </button>
    </li>
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
      {hp.current === 0 && (
        <p className={styles.downed}>Down at 0 hit points: roll a death save on each of your turns.</p>
      )}
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

const DEFENCE_KINDS = [
  { key: 'resistances', label: 'Resists', add: 'Add a resistance…', hint: 'Takes half damage of these types' },
  { key: 'immunities', label: 'Immune to', add: 'Add an immunity…', hint: 'Takes no damage of these types' },
  { key: 'vulnerabilities', label: 'Vulnerable to', add: 'Add a vulnerability…', hint: 'Takes double damage of these types' },
] as const

/** Damage types the character resists, is immune to or vulnerable to, such as a tiefling's fire or a raging barbarian's. */
function DamageDefences({ character, onUpdate }: { character: Character; onUpdate?: (patch: TrackerPatch) => void }) {
  return (
    <div className={styles.defences}>
      {DEFENCE_KINDS.map(({ key, label, add, hint }) => {
        const list = character[key]
        if (!onUpdate && list.length === 0) return null
        return (
          <div key={key} className={styles.chips} title={hint}>
            <span className={styles.muted}>{label}</span>
            {list.length === 0 && <span className={styles.empty}>None</span>}
            {list.map((type) => (
              <span key={type} className={styles.chip}>
                {type.replace(':nonmagical', ' (non-magical)')}
                {onUpdate && (
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={`Remove ${type}`}
                    onClick={() => onUpdate({ [key]: list.filter((t) => t !== type) })}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {onUpdate && (
              <select
                className={styles.addSelect}
                aria-label={add}
                value=""
                onChange={(event) => event.target.value && onUpdate({ [key]: [...list, event.target.value] })}
              >
                <option value="">{add}</option>
                {DAMAGE_TYPES.filter((type) => !list.includes(type)).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}
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
