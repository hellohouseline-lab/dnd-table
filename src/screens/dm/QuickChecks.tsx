import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { AskInput } from '../../live/rollRequests.ts'
import { DIFFICULTIES, findAskable, PRESET_KEYS } from '../../rules/askable.ts'
import styles from './QuickChecks.module.css'

type QuickChecksProps = {
  /** Who is ticked on the party cards. */
  characterIds: string[]
  onSend: (input: AskInput) => Promise<boolean>
  error?: string | null
}

const EVERYDAY = DIFFICULTIES.slice(0, 3)

/**
 * The Party tab's quick checks (docs/TABLE_TOOLS_PLAN.md section 2): the nine checks a table asks
 * for most, a difficulty, and Roll, for everyone ticked on the cards below. Any other roll, or a
 * secret DC, is still under Ask for a roll.
 */
export function QuickChecks({ characterIds, onSend, error }: QuickChecksProps) {
  const [key, setKey] = useState<string>(PRESET_KEYS[0])
  const [dc, setDc] = useState(15)
  const [sending, setSending] = useState(false)
  const askable = findAskable(key)
  const custom = !EVERYDAY.some((d) => d.dc === dc)

  async function send() {
    if (!askable || characterIds.length === 0) return
    setSending(true)
    await onSend({ askable, characterIds, dc, dcShown: true })
    setSending(false)
  }

  return (
    <section className={styles.bar} aria-label="Quick checks">
      <div className={styles.checks} role="group" aria-label="Which check">
        {PRESET_KEYS.map((presetKey) => {
          const preset = findAskable(presetKey)
          if (!preset) return null
          return (
            <button
              key={presetKey}
              type="button"
              className={cx(styles.check, key === presetKey && styles.on)}
              aria-pressed={key === presetKey}
              title={preset.short}
              onClick={() => setKey(presetKey)}
            >
              {preset.name}
            </button>
          )
        })}
      </div>
      <div className={styles.row}>
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
        <button
          type="button"
          className={styles.roll}
          disabled={sending || characterIds.length === 0}
          onClick={() => void send()}
        >
          {characterIds.length === 0
            ? 'Tick who rolls'
            : `${askable?.name ?? 'Roll'}: ask ${characterIds.length === 1 ? '1 player' : `${characterIds.length} players`}`}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
