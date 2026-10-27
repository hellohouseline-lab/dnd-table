import { useEffect, useState } from 'react'
import { cx } from '../../components/cx.ts'
import { StoredImage } from '../../components/StoredImage.tsx'
import type { Asset } from '../../live/library.ts'
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

/** Where the fight happens, and whether players know what they're fighting. */
export type FightSetting = { mapId: string | null; known: boolean }

type StartFightProps = {
  characters: Character[]
  hereTonight: Character[]
  monsters: SrdMonster[] | null
  /** Battle maps in the library (Maps), to fight on. */
  maps: Asset[]
  /** The map on stage now, picked to begin with. */
  mapOnStage: string | null
  /** A scene's planned fight: its monsters and map to start with. */
  preset?: { foes: MonsterPick[]; mapId: string | null } | null
  onStart: (characters: Character[], monsters: MonsterPick[], setting: FightSetting) => Promise<void>
  onClose: () => void
}

/**
 * Start combat: who fights, which monsters, and where. The map goes on stage with everyone's
 * miniature on it; monsters roll initiative behind the screen; each player is asked to roll theirs.
 */
export function StartFightDialog({
  characters,
  hereTonight,
  monsters,
  maps,
  mapOnStage,
  preset = null,
  onStart,
  onClose,
}: StartFightProps) {
  const [picked, setPicked] = useState<string[]>(() =>
    (hereTonight.length > 0 ? hereTonight : characters).map((c) => c.id),
  )
  const [foes, setFoes] = useState<MonsterPick[]>(preset?.foes ?? [])
  const [mapId, setMapId] = useState<string | null>(() => preset?.mapId ?? mapOnStage ?? maps[0]?.id ?? null)
  const [known, setKnown] = useState(true)
  const [starting, setStarting] = useState(false)
  useEscape(onClose)

  // One more or one fewer of a monster; at none, it leaves the list.
  function change(pick: MonsterPick, by: number) {
    setFoes((now) => {
      const there = now.find((f) => f.monster.index === pick.monster.index)
      if (!there) return by > 0 ? [...now, { monster: pick.monster, count: 1 }] : now
      const count = Math.min(8, there.count + by)
      return count <= 0 ? now.filter((f) => f !== there) : now.map((f) => (f === there ? { ...f, count } : f))
    })
  }

  async function start() {
    setStarting(true)
    await onStart(
      characters.filter((c) => picked.includes(c.id)),
      foes,
      { mapId, known },
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
        {foes.length > 0 ? (
          <ul className={styles.foes} aria-label="Monsters in this fight">
            {foes.map((foe) => (
              <li key={foe.monster.index}>
                <button
                  type="button"
                  className={styles.step}
                  aria-label={`One fewer ${foe.monster.name}`}
                  onClick={() => change(foe, -1)}
                >
                  −
                </button>
                {foe.count} × {foe.monster.name}
                <button
                  type="button"
                  className={styles.step}
                  aria-label={`One more ${foe.monster.name}`}
                  disabled={foe.count >= 8}
                  onClick={() => change(foe, 1)}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Click a monster to add it; click again for another.</p>
        )}
        <MonsterPicker monsters={monsters} quick onPick={(pick) => change(pick, 1)} />
        <label className={styles.person}>
          <input type="checkbox" checked={known} onChange={(event) => setKnown(event.target.checked)} />
          Players know what these are
        </label>
      </div>
      <fieldset className={styles.where}>
        <legend className={styles.legend}>Where</legend>
        <div className={styles.mapChoices}>
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              className={cx(styles.mapChoice, mapId === map.id && styles.mapChoiceOn)}
              aria-pressed={mapId === map.id}
              onClick={() => setMapId(map.id)}
            >
              <StoredImage className={styles.mapThumb} path={map.thumbPath ?? map.path} alt="" fallback="Map" />
              <span>{map.name}</span>
            </button>
          ))}
          <button
            type="button"
            className={cx(styles.mapChoice, mapId === null && styles.mapChoiceOn)}
            aria-pressed={mapId === null}
            onClick={() => setMapId(null)}
          >
            <span className={styles.noMap}>No map</span>
            <span>In our heads</span>
          </button>
        </div>
        {maps.length === 0 && (
          <p className={styles.hint}>Upload a battle map under Maps on Screen 2 to fight on one.</p>
        )}
      </fieldset>
      <p className={styles.hint}>
        {mapId ? 'The map goes on stage with everyone’s miniature on it. ' : ''}
        Monsters roll initiative behind the screen
        {known ? '' : ' and players see them as “Unknown creature” until you reveal them'}. Each player gets a prompt to
        roll their own initiative, and the first turn starts once everyone has.
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
