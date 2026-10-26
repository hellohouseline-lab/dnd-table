import { useMemo, useState } from 'react'
import { cx } from '../../components/cx.ts'
import { crText } from '../../rules/combat.ts'
import type { SrdMonster } from '../../rules/srd/index.ts'
import styles from './Fight.module.css'

export type MonsterPick = { monster: SrdMonster; count: number }

type MonsterPickerProps = {
  monsters: SrdMonster[] | null
  onPick: (pick: MonsterPick) => void
  pickLabel?: string
  /** Start combat: clicking a monster adds one at once (click again for another). */
  quick?: boolean
}

/** Search the SRD monsters by name, pick how many, and add them. */
export function MonsterPicker({ monsters, onPick, pickLabel = 'Add', quick = false }: MonsterPickerProps) {
  const [search, setSearch] = useState('')
  const [chosen, setChosen] = useState<SrdMonster | null>(null)
  const [count, setCount] = useState(1)
  const found = useMemo(() => {
    if (!monsters) return []
    const wanted = search.trim().toLowerCase()
    const list = wanted ? monsters.filter((m) => m.name.toLowerCase().includes(wanted)) : monsters
    return list.slice(0, 40)
  }, [monsters, search])

  return (
    <div className={styles.picker}>
      <input
        className={styles.search}
        aria-label="Find a monster"
        placeholder="Find a monster: goblin, wolf, bandit…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {!monsters && <p className={styles.hint}>Loading the monsters…</p>}
      <ul className={styles.monsterList} aria-label="Monsters">
        {found.map((monster) => (
          <li key={monster.index}>
            <button
              type="button"
              aria-pressed={quick ? undefined : chosen?.index === monster.index}
              className={cx(styles.monster, !quick && chosen?.index === monster.index && styles.monsterOn)}
              title={quick ? `Add a ${monster.name} to the fight` : undefined}
              onClick={() => (quick ? onPick({ monster, count: 1 }) : setChosen(monster))}
            >
              <span className={styles.monsterName}>{monster.name}</span>
              <span className={styles.monsterMeta}>
                CR {crText(monster.cr)} · AC {monster.ac} · HP {monster.hp}
              </span>
            </button>
          </li>
        ))}
        {monsters && found.length === 0 && <li className={styles.hint}>No monster by that name in the SRD.</li>}
      </ul>
      {!quick && (
        <div className={styles.pickRow}>
          <span className={styles.pickName}>{chosen ? chosen.name : 'Pick a monster'}</span>
          <button
            type="button"
            className={styles.step}
            aria-label="One fewer"
            disabled={count <= 1}
            onClick={() => setCount(count - 1)}
          >
            −
          </button>
          <span className={styles.count}>{count}</span>
          <button
            type="button"
            className={styles.step}
            aria-label="One more"
            disabled={count >= 8}
            onClick={() => setCount(count + 1)}
          >
            +
          </button>
          <button
            type="button"
            className={styles.primarySmall}
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              onPick({ monster: chosen, count })
              setCount(1)
            }}
          >
            {pickLabel}
          </button>
        </div>
      )}
    </div>
  )
}
