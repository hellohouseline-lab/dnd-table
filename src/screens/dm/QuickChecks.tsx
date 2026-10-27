import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { AskInput } from '../../live/rollRequests.ts'
import { ASKABLES, DIFFICULTIES, findAskable, PRESET_KEYS, type Askable, type AskKind } from '../../rules/askable.ts'
import styles from './QuickChecks.module.css'

type QuickChecksProps = {
  /** Who is ticked on the party cards. */
  characterIds: string[]
  onSend: (input: AskInput) => Promise<boolean>
  error?: string | null
  className?: string
}

const EVERYDAY = DIFFICULTIES.slice(0, 3)

const SECTIONS: { kind: AskKind; name: string }[] = [
  { kind: 'skill', name: 'Skills' },
  { kind: 'save', name: 'Saving throws' },
  { kind: 'ability', name: 'Ability checks' },
]

/**
 * The Party tab's quick rolls, in a column beside the cameras: how hard first, then one click on a
 * roll asks everyone ticked on the party cards. The rolls a table asks for most are open at the top;
 * every skill, saving throw and ability check is in the sections below. A secret DC is still under
 * Ask for a roll.
 */
export function QuickChecks({ characterIds, onSend, error, className }: QuickChecksProps) {
  const [dc, setDc] = useState(15)
  const [sending, setSending] = useState<string | null>(null)
  const custom = !EVERYDAY.some((d) => d.dc === dc)
  const nobody = characterIds.length === 0

  async function send(askable: Askable) {
    if (nobody || sending) return
    setSending(askable.key)
    await onSend({ askable, characterIds, dc })
    setSending(null)
  }

  const rollButton = (askable: Askable) => (
    <button
      key={askable.key}
      type="button"
      className={cx(styles.check, sending === askable.key && styles.on)}
      title={`${askable.short}. Asks ${characterIds.length === 1 ? '1 player' : `${characterIds.length} players`}, DC ${dc}.`}
      disabled={nobody || sending !== null}
      onClick={() => void send(askable)}
    >
      {askable.name}
    </button>
  )

  return (
    <section className={cx(styles.panel, className)} aria-label="Quick checks">
      <h2 className={styles.title}>Quick rolls</h2>

      <div className={styles.step}>
        <span className={styles.label}>How hard</span>
        <div className={styles.difficulty} role="group" aria-label="How hard">
          {EVERYDAY.map((d) => (
            <button
              key={d.dc}
              type="button"
              className={cx(styles.check, dc === d.dc && styles.on)}
              aria-pressed={dc === d.dc}
              title={d.plain}
              onClick={() => setDc(d.dc)}
            >
              {d.name} {d.dc}
            </button>
          ))}
          <label className={cx(styles.custom, custom && styles.on)}>
            DC
            <input
              type="number"
              min={1}
              max={40}
              value={dc}
              aria-label="Difficulty class"
              onChange={(event) => setDc(Math.max(1, Math.min(40, Number(event.target.value) || 10)))}
            />
          </label>
        </div>
      </div>

      <p className={cx(styles.who, nobody && styles.nobody)}>
        {nobody
          ? 'Tick who rolls on their card.'
          : `Click a roll to ask ${characterIds.length === 1 ? 'the 1 player' : `the ${characterIds.length} players`} ticked.`}
      </p>

      <details className={styles.section} open>
        <summary>Most asked</summary>
        <div className={styles.checks}>
          {PRESET_KEYS.map((key) => findAskable(key))
            .filter((a): a is Askable => a !== undefined)
            .map(rollButton)}
        </div>
      </details>
      {SECTIONS.map((section) => {
        const rolls = ASKABLES.filter((a) => a.kind === section.kind)
        return (
          <details key={section.kind} className={styles.section}>
            <summary>
              {section.name} <span className={styles.count}>{rolls.length}</span>
            </summary>
            <div className={styles.checks}>{rolls.map(rollButton)}</div>
          </details>
        )
      })}

      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
