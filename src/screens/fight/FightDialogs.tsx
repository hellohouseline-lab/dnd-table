import { useEffect, useState } from 'react'
import type { Character } from '../../rules/character.ts'
import type { SrdMonster } from '../../rules/srd/index.ts'
import { MonsterPicker, type MonsterPick } from './MonsterPicker.tsx'
import styles from './Fight.module.css'

function useEscape(onClose: () => void) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
}

type StartFightProps = {
  characters: Character[]
  hereTonight: Character[]
  monsters: SrdMonster[] | null
  onStart: (characters: Character[], monsters: MonsterPick[]) => Promise<void>
  onClose: () => void
}

/**
 * Start combat: who fights and which monsters. Monsters roll initiative behind the screen; each
 * player is asked to roll theirs.
 */
export function StartFightDialog({ characters, hereTonight, monsters, onStart, onClose }: StartFightProps) {
  const [picked, setPicked] = useState<string[]>(() =>
    (hereTonight.length > 0 ? hereTonight : characters).map((c) => c.id),
  )
  const [foes, setFoes] = useState<MonsterPick[]>([])
  const [starting, setStarting] = useState(false)
  useEscape(onClose)

  async function start() {
    setStarting(true)
    await onStart(
      characters.filter((c) => picked.includes(c.id)),
      foes,
    )
    setStarting(false)
  }

  return (
    <div className={styles.dialog} role="dialog" aria-labelledby="start-title">
      <h2 id="start-title" className={styles.dialogTitle}>
        Start combat
      </h2>
      <fieldset className={styles.who}>
        <legend className={styles.legend}>Who&rsquo;s fighting</legend>
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
      </fieldset>
      <div>
        <div className={styles.legend}>Monsters</div>
        {foes.length > 0 && (
          <ul className={styles.foes}>
            {foes.map((foe, i) => (
              <li key={`${foe.monster.index}-${i}`}>
                {foe.count} × {foe.monster.name}
                <button
                  type="button"
                  className={styles.removeSmall}
                  aria-label={`Remove ${foe.monster.name}`}
                  onClick={() => setFoes((now) => now.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <MonsterPicker monsters={monsters} onPick={(pick) => setFoes((now) => [...now, pick])} />
      </div>
      <p className={styles.hint}>
        Monsters roll initiative behind the screen and players see them as &ldquo;Unknown creature&rdquo; until you
        reveal them. Each player gets a prompt to roll their own initiative.
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={starting || picked.length + foes.length === 0}
          onClick={() => void start()}
        >
          {starting ? 'Starting…' : 'Start the fight'}
        </button>
      </div>
    </div>
  )
}

type AddMonsterProps = {
  monsters: SrdMonster[] | null
  onAdd: (pick: MonsterPick) => Promise<void>
  onClose: () => void
}

/** Add a monster mid-fight: it rolls initiative and joins the turn order. */
export function AddMonsterDialog({ monsters, onAdd, onClose }: AddMonsterProps) {
  const [adding, setAdding] = useState(false)
  useEscape(onClose)
  return (
    <div className={styles.dialog} role="dialog" aria-labelledby="add-monster-title">
      <h2 id="add-monster-title" className={styles.dialogTitle}>
        Add a monster
      </h2>
      <MonsterPicker
        monsters={monsters}
        pickLabel={adding ? 'Adding…' : 'Add to the fight'}
        onPick={async (pick) => {
          setAdding(true)
          await onAdd(pick)
          setAdding(false)
          onClose()
        }}
      />
      <div className={styles.buttons}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
