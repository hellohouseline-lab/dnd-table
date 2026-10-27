import { useEffect, useState } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { cx } from '../../components/cx.ts'
import { Notice } from '../../components/Notice.tsx'
import type { AskInput } from '../../live/rollRequests.ts'
import { ASKABLES, DIFFICULTIES, findAskable, PRESET_KEYS } from '../../rules/askable.ts'
import type { Character } from '../../rules/character.ts'
import { askSentence } from './requestStatus.ts'
import styles from './AskRollDialog.module.css'

type AskRollDialogProps = {
  /** The characters who could be asked; "Everyone" means those here tonight. */
  characters: Character[]
  hereTonight: Character[]
  /** Start with just this character picked (from a party card's "Ask to roll"). */
  only?: string | null
  /** Start with this roll picked ("skill:persuasion", for a haggle). */
  startKey?: string | null
  /** A scene's planned roll: everything filled in to start with. */
  preset?: { dc: number; outcomeShown: boolean; who: string[] } | null
  /** The DM throws it for them, secretly: only the DM sees (decision 58). */
  onBehindScreen?: (input: AskInput) => void
  onSend: (input: AskInput) => Promise<boolean>
  onCancel: () => void
  error?: string | null
  className?: string
}

const GROUPS = [
  { kind: 'skill', name: 'Skills' },
  { kind: 'save', name: 'Saving throws' },
  { kind: 'ability', name: 'Plain ability checks' },
] as const

/** Screen 08: three quick choices (what, who, how hard), a sentence saying what's about to happen, and send. */
export function AskRollDialog({
  characters,
  hereTonight,
  only,
  startKey = null,
  preset = null,
  onBehindScreen,
  onSend,
  onCancel,
  error,
  className,
}: AskRollDialogProps) {
  const [key, setKey] = useState<string | null>(startKey)
  const [picked, setPicked] = useState<string[]>(only ? [only] : (preset?.who ?? []))
  const [dc, setDc] = useState(preset?.dc ?? 15)
  const [outcomeShown, setOutcomeShown] = useState(preset?.outcomeShown ?? true)
  const [sending, setSending] = useState(false)
  const askable = key ? findAskable(key) : undefined
  const everyone = picked.length === 0
  const asked = everyone
    ? hereTonight.length > 0
      ? hereTonight
      : characters
    : characters.filter((c) => picked.includes(c.id))
  const others = ASKABLES.filter((a) => !PRESET_KEYS.includes(a.key))

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [onCancel])

  function toggle(id: string) {
    setPicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]))
  }

  async function send() {
    if (!askable || asked.length === 0) return
    setSending(true)
    const sent = await onSend({ askable, characterIds: asked.map((c) => c.id), dc, outcomeShown })
    setSending(false)
    if (sent) onCancel()
  }

  const sentence =
    askable &&
    askSentence(
      asked.map((c) => c.name),
      everyone,
      askable.label,
      dc,
    )

  return (
    <div className={cx(styles.card, className)} role="dialog" aria-labelledby="ask-title">
      <span className={cx(styles.corner, styles.topLeft)} aria-hidden="true" />
      <span className={cx(styles.corner, styles.topRight)} aria-hidden="true" />
      <h2 id="ask-title" className={styles.title}>
        Ask for a roll
      </h2>
      <p className={styles.subtitle}>Three quick choices. The app does the maths.</p>

      <section className={styles.step} aria-labelledby="ask-what">
        <h3 id="ask-what" className={styles.stepTitle}>
          1. What are they trying to do?
        </h3>
        <div className={styles.checks}>
          {PRESET_KEYS.map((presetKey) => {
            const preset = findAskable(presetKey)
            if (!preset) return null
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={key === preset.key}
                className={cx(styles.check, key === preset.key && styles.on)}
                onClick={() => setKey(preset.key)}
              >
                <span className={styles.checkName}>{preset.name}</span>
                <span className={styles.checkPlain}>{preset.short}</span>
              </button>
            )
          })}
        </div>
        <label className={styles.other}>
          <span className={styles.otherLabel}>Any other skill or save</span>
          <select
            value={key && !PRESET_KEYS.includes(key) ? key : ''}
            onChange={(event) => event.target.value && setKey(event.target.value)}
          >
            <option value="">Pick one…</option>
            {GROUPS.map((group) => (
              <optgroup key={group.kind} label={group.name}>
                {others
                  .filter((a) => a.kind === group.kind)
                  .map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.name}: {a.short.toLowerCase()}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.step} aria-labelledby="ask-who">
        <h3 id="ask-who" className={styles.stepTitle}>
          2. Who rolls?
        </h3>
        <div className={styles.pills}>
          <button
            type="button"
            aria-pressed={everyone}
            className={cx(styles.pill, everyone && styles.on)}
            title={hereTonight.length > 0 ? 'Everyone who is here tonight' : 'Everyone at the table'}
            onClick={() => setPicked([])}
          >
            Everyone
          </button>
          {characters.map((character) => (
            <button
              key={character.id}
              type="button"
              aria-pressed={picked.includes(character.id)}
              className={cx(styles.pill, styles.pillName, picked.includes(character.id) && styles.on)}
              onClick={() => toggle(character.id)}
            >
              {character.name}
            </button>
          ))}
        </div>
        {characters.length === 0 && (
          <p className={styles.hint}>Nobody has a character yet, so there&rsquo;s nobody to ask.</p>
        )}
      </section>

      <section className={styles.step} aria-labelledby="ask-how">
        <h3 id="ask-how" className={styles.stepTitle}>
          3. How hard is it?
        </h3>
        <div className={styles.difficulties}>
          {DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty.dc}
              type="button"
              aria-pressed={dc === difficulty.dc}
              className={cx(styles.difficulty, dc === difficulty.dc && styles.on)}
              onClick={() => setDc(difficulty.dc)}
            >
              <span className={styles.difficultyName}>{difficulty.name}</span>
              <span className={styles.difficultyDc}>{difficulty.dc}</span>
              <span className={styles.checkPlain}>{difficulty.plain}</span>
            </button>
          ))}
        </div>
        <div className={styles.howRow}>
          <span>Each player rolls a d20 and adds their bonus. Meet or beat the number to pass.</span>
          <label className={styles.custom}>
            Or type a number
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              value={dc}
              onChange={(event) => setDc(Math.min(40, Math.max(1, Math.trunc(Number(event.target.value)) || 1)))}
            />
          </label>
          <label className={styles.tell} title="Untick it and players see only their total; only you see who passed">
            <input type="checkbox" checked={outcomeShown} onChange={(event) => setOutcomeShown(event.target.checked)} />
            Tell players the outcome
          </label>
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      <div className={styles.footer}>
        <p className={styles.sentence} aria-live="polite">
          {sentence ? (
            <>
              <strong>{sentence.who}</strong> {sentence.verb} <strong>{sentence.check}</strong>.{' '}
              <strong>{sentence.target}</strong> passes
              {outcomeShown ? '.' : '. Only you will know who passed.'}
            </>
          ) : (
            'Pick what they’re trying to do.'
          )}
        </p>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        {onBehindScreen && (
          <button
            type="button"
            className={styles.cancel}
            disabled={!askable || asked.length === 0}
            title="You throw it for them, in secret: they never see it"
            onClick={() => {
              if (!askable) return
              onBehindScreen({ askable, characterIds: asked.map((c) => c.id), dc, outcomeShown })
              onCancel()
            }}
          >
            Roll behind the screen
          </button>
        )}
        <button
          type="button"
          className={buttonClassName('ink', { className: styles.send })}
          disabled={!askable || asked.length === 0 || sending}
          onClick={() => void send()}
        >
          Send to players
        </button>
      </div>
    </div>
  )
}
