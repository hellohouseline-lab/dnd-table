import { useEffect, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { Character } from '../../rules/character.ts'
import { longRest, shortRest, type RestPatch } from '../../rules/rest.ts'
import { CONDITION_WORD } from '../../rules/conditionClocks.ts'
import styles from './RestDialog.module.css'

export type RestKind = 'short' | 'long'

type RestDialogProps = {
  characters: Character[]
  /** Ticked to start with: the characters whose players are here tonight. */
  hereTonight: Character[]
  /** Applies a rest to one character and logs it. */
  onRest: (character: Character, patch: RestPatch & Partial<Pick<Character, 'conditions'>>) => void
  onLog: (text: string) => void
  onClose: () => void
  className?: string
}

const KINDS: { kind: RestKind; name: string; plain: string }[] = [
  {
    kind: 'short',
    name: 'Short rest',
    plain:
      'About an hour. Features such as Second Wind and Action Surge come back. Players can spend hit dice to heal, from the Hit dice box on their sheet.',
  },
  {
    kind: 'long',
    name: 'Long rest',
    plain:
      'Eight hours. Everyone gets all their hit points back, half their hit dice, every spell slot and feature use, and loses one level of exhaustion.',
  },
]

/** The Rest button from the bottom bar: short or long, for everyone here or some, by the 2014 rules. */
export function RestDialog({ characters, hereTonight, onRest, onLog, onClose, className }: RestDialogProps) {
  const [kind, setKind] = useState<RestKind>('short')
  const [picked, setPicked] = useState<string[]>(() =>
    (hereTonight.length > 0 ? hereTonight : characters).map((c) => c.id),
  )
  const [done, setDone] = useState<string[] | null>(null)
  // A long rest asks whether to clear conditions still on the party (decision 77).
  const [clear, setClear] = useState(true)
  const lingering = characters.filter((c) => picked.includes(c.id) && c.conditions.some((x) => x !== 'unconscious'))

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  function rest() {
    const lines: string[] = []
    for (const character of characters.filter((c) => picked.includes(c.id))) {
      const { patch, changes } = kind === 'short' ? shortRest(character) : longRest(character)
      const clearing = kind === 'long' && clear && lingering.includes(character)
      if (clearing) changes.push('conditions cleared')
      if (Object.keys(patch).length > 0 || clearing) onRest(character, clearing ? { ...patch, conditions: [] } : patch)
      lines.push(`${character.name}: ${changes.length > 0 ? changes.join(', ') : 'nothing to recover'}.`)
    }
    onLog(`${kind === 'short' ? 'Short' : 'Long'} rest. ${lines.join(' ')}`)
    setDone(lines)
  }

  return (
    <div className={cx(styles.card, className)} role="dialog" aria-labelledby="rest-title">
      <h2 id="rest-title" className={styles.title}>
        Rest
      </h2>
      {done ? (
        <>
          <p className={styles.lead}>
            {kind === 'short' ? 'The short rest is over.' : 'Morning comes.'} Here&rsquo;s what changed:
          </p>
          <ul className={styles.done}>
            {done.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className={styles.note}>It&rsquo;s in the Log tab too.</p>
          <div className={styles.buttons}>
            <button type="button" className={styles.primary} onClick={onClose}>
              Back to the party
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.kinds} role="radiogroup" aria-label="Which rest">
            {KINDS.map((option) => (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={kind === option.kind}
                className={cx(styles.kind, kind === option.kind && styles.kindOn)}
                onClick={() => setKind(option.kind)}
              >
                <span className={styles.kindName}>{option.name}</span>
                <span className={styles.kindPlain}>{option.plain}</span>
              </button>
            ))}
          </div>
          <fieldset className={styles.who}>
            <legend className={styles.legend}>Who rests</legend>
            {characters.map((character) => (
              <label key={character.id} className={styles.person}>
                <input
                  type="checkbox"
                  checked={picked.includes(character.id)}
                  onChange={(event) =>
                    setPicked((now) =>
                      event.target.checked ? [...now, character.id] : now.filter((id) => id !== character.id),
                    )
                  }
                />
                {character.name}
              </label>
            ))}
            {characters.length === 0 && <p className={styles.note}>Nobody has a character yet.</p>}
          </fieldset>
          {kind === 'long' && lingering.length > 0 && (
            <label className={styles.person}>
              <input type="checkbox" checked={clear} onChange={(event) => setClear(event.target.checked)} />
              Clear what&rsquo;s left:{' '}
              {lingering
                .map((c) => `${c.name} (${c.conditions.map((x) => CONDITION_WORD[x] ?? x).join(', ')})`)
                .join(', ')}
            </label>
          )}
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={styles.primary} disabled={picked.length === 0} onClick={rest}>
              Take a {kind} rest
            </button>
          </div>
        </>
      )}
    </div>
  )
}
