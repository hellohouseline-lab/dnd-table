import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { DiceFaces } from '../../dice/DiceFaces.tsx'
import { modeText, naturalMoment } from '../../dice/rollText.ts'
import type { Roll } from '../../live/rolls.ts'
import { ABILITIES, ABILITY_NAME } from '../../rules/abilities.ts'
import { ASKABLES, DIFFICULTIES, PRESET_KEYS, findAskable, passes, type Askable } from '../../rules/askable.ts'
import type { Character } from '../../rules/character.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { abilityCheck, savingThrow, skillCheck } from '../../rules/rolls.ts'
import styles from './RollsForDm.module.css'

type Naming = { label: string; kind: 'check' | 'save'; modifier: number; parts: RollRequest['parts'] }

type RollsForDmProps = {
  rolls: Roll[]
  characters: Character[]
  onSettle: (roll: Roll, naming: Naming | null, judged?: { dc: number; passed: boolean } | null) => void
  className?: string
}

const EVERYDAY = DIFFICULTIES.slice(0, 3)

/** What a roll counts as for this character: its name, kind and bonus, from their sheet. */
function namingFor(character: Character, askable: Askable): Naming {
  const request =
    askable.kind === 'skill' && askable.skill
      ? skillCheck(character, askable.skill)
      : askable.kind === 'save'
        ? savingThrow(character, askable.ability)
        : abilityCheck(character, askable.ability)
  return {
    label: request.label,
    kind: askable.kind === 'save' ? 'save' : 'check',
    modifier: request.modifier,
    parts: request.parts,
  }
}

/**
 * Rolls players made for the DM, outside a fight. Each shows the d20 (both dice with advantage or
 * disadvantage); the DM picks what it was, which adds the character's bonus, and can judge it
 * against a DC, or just count it, or let it go.
 */
export function RollsForDm({ rolls, characters, onSettle, className }: RollsForDmProps) {
  if (rolls.length === 0) return null
  return (
    <div className={cx(styles.stack, className)} aria-label="Rolls for you">
      {rolls.slice(0, 3).map((roll) => (
        <RollForDm
          key={roll.id}
          roll={roll}
          character={characters.find((c) => c.id === roll.characterId) ?? null}
          onSettle={onSettle}
        />
      ))}
      {rolls.length > 3 && <p className={styles.more}>{rolls.length - 3} more waiting</p>}
    </div>
  )
}

function RollForDm({
  roll,
  character,
  onSettle,
}: {
  roll: Roll
  character: Character | null
  onSettle: RollsForDmProps['onSettle']
}) {
  const [key, setKey] = useState('')
  const [dc, setDc] = useState<number | null>(null)
  const askable = key ? findAskable(key) : undefined
  const naming = askable && character ? namingFor(character, askable) : null
  const total = roll.total + (naming?.modifier ?? 0)
  const diceSay = dc !== null ? passes(total, dc) : null
  const moment = naturalMoment(roll)
  const name = character?.name ?? 'Someone'

  const option = (a: Askable, label = a.name) => (
    <option key={a.key} value={a.key}>
      {label}
    </option>
  )

  return (
    <section className={cx(styles.card, moment && styles[moment])} aria-label={`${name}'s roll for you`}>
      <div className={styles.head}>
        <span className={styles.who}>
          {name} rolled for you{modeText(roll) ? ` ${modeText(roll)}` : ''}
        </span>
        <button type="button" className={styles.letGo} onClick={() => onSettle(roll, null)}>
          Let it go
        </button>
      </div>
      <div className={styles.dice}>
        <DiceFaces dice={roll.dice} natural={roll.natural} size="large" />
        <span className={styles.natural}>
          {moment === 'nat20' ? 'Natural 20!' : moment === 'nat1' ? 'Natural 1' : `Rolled ${roll.total}`}
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>What was it?</span>
        <select value={key} onChange={(event) => setKey(event.target.value)} disabled={!character}>
          <option value="">Pick a check or save…</option>
          <optgroup label="Most asked">
            {PRESET_KEYS.map((k) => findAskable(k))
              .filter((a): a is Askable => Boolean(a))
              .map((a) => option(a))}
          </optgroup>
          <optgroup label="Skills">{ASKABLES.filter((a) => a.kind === 'skill').map((a) => option(a))}</optgroup>
          <optgroup label="Saving throws">
            {ABILITIES.map((ab) => findAskable(`save:${ab}`))
              .filter((a): a is Askable => Boolean(a))
              .map((a) => option(a, `${ABILITY_NAME[a.ability]} save`))}
          </optgroup>
          <optgroup label="Ability checks">
            {ABILITIES.map((ab) => findAskable(`ability:${ab}`))
              .filter((a): a is Askable => Boolean(a))
              .map((a) => option(a, `${ABILITY_NAME[a.ability]} check`))}
          </optgroup>
        </select>
      </label>

      {naming && (
        <>
          <p className={styles.sum}>
            {naming.label}: {roll.total} {formatBonus(naming.modifier)} = <strong>{total}</strong>
          </p>
          <div className={styles.row} role="group" aria-label="How hard, if you want to judge it">
            {EVERYDAY.map((d) => (
              <button
                key={d.dc}
                type="button"
                className={cx(styles.chip, dc === d.dc && styles.on)}
                aria-pressed={dc === d.dc}
                onClick={() => setDc(dc === d.dc ? null : d.dc)}
              >
                {d.name} {d.dc}
              </button>
            ))}
            <label
              className={cx(styles.chip, styles.custom, dc !== null && !EVERYDAY.some((d) => d.dc === dc) && styles.on)}
            >
              DC
              <input
                type="number"
                min={1}
                max={40}
                value={dc ?? ''}
                placeholder="–"
                aria-label="Difficulty class"
                onChange={(event) => {
                  const n = Number(event.target.value)
                  setDc(event.target.value === '' ? null : Math.max(1, Math.min(40, n || 1)))
                }}
              />
            </label>
          </div>
          <div className={styles.actions}>
            {dc === null ? (
              <button type="button" className={styles.count} onClick={() => onSettle(roll, naming)}>
                Count it as {naming.label}
              </button>
            ) : (
              <>
                <span className={styles.diceSay}>
                  dice say <strong>{diceSay ? 'pass' : 'fail'}</strong>
                </span>
                <button
                  type="button"
                  className={cx(styles.rule, styles.pass, diceSay === true && styles.suggested)}
                  onClick={() => onSettle(roll, naming, { dc, passed: true })}
                >
                  Pass
                </button>
                <button
                  type="button"
                  className={cx(styles.rule, styles.fail, diceSay === false && styles.suggested)}
                  onClick={() => onSettle(roll, naming, { dc, passed: false })}
                >
                  Fail
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
