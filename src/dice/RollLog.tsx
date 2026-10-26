import { useState } from 'react'
import { cx } from '../components/cx.ts'
import type { Member } from '../live/campaigns.ts'
import type { Roll } from '../live/rolls.ts'
import type { Character } from '../rules/character.ts'
import { DiceFaces } from './DiceFaces.tsx'
import {
  damageLine,
  modeText,
  naturalMoment,
  naturalTitle,
  partsText,
  sumText,
  timeText,
  whoRolled,
} from './rollText.ts'
import styles from './RollLog.module.css'

type RollLogProps = {
  rolls: Roll[]
  members: Member[]
  characters: Character[]
  loading?: boolean
  error?: string
}

/** Who rolled what, with which bonuses, the result and the time, newest first. Filter by person. */
export function RollLog({ rolls, members, characters, loading, error }: RollLogProps) {
  const [who, setWho] = useState('')
  const shown = who ? rolls.filter((roll) => roll.rollerId === who) : rolls
  const people = members.map((member) => {
    const character = characters.find((c) => c.ownerId === member.user_id)
    const name = member.role === 'dm' ? `${member.display_name} (DM)` : (character?.name ?? member.display_name)
    return { id: member.user_id, name }
  })

  return (
    <section className={styles.log} aria-label="Roll log">
      <div className={styles.bar}>
        <h2 className={styles.heading}>Rolls tonight and before</h2>
        <label className={styles.filter}>
          <span>Show</span>
          <select value={who} onChange={(event) => setWho(event.target.value)}>
            <option value="">Everyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className={styles.empty}>{error}</p>}
      {!error && loading && shown.length === 0 && <p className={styles.empty}>Loading the rolls…</p>}
      {!error && !loading && shown.length === 0 && (
        <p className={styles.empty}>No rolls yet. Every roll at the table appears here the moment it lands.</p>
      )}
      <ol className={styles.list}>
        {shown.map((roll) => (
          <LogRow key={roll.id} roll={roll} who={whoRolled(roll, members, characters)} />
        ))}
      </ol>
    </section>
  )
}

function LogRow({ roll, who }: { roll: Roll; who: string }) {
  const moment = naturalMoment(roll)
  const title = naturalTitle(roll)
  const damage = damageLine(roll)
  const mode = modeText(roll)
  return (
    <li className={cx(styles.row, moment && styles[moment])}>
      <time className={styles.time} dateTime={roll.createdAt}>
        {timeText(roll.createdAt)}
      </time>
      <div className={styles.what}>
        <div className={styles.line}>
          <span className={styles.who}>{who}</span>
          <span>{roll.label}</span>
          {mode && <span className={styles.chip}>{mode}</span>}
          {roll.secret && <span className={cx(styles.chip, styles.secret)}>Secret</span>}
          {title && <span className={cx(styles.chip, styles.moment)}>{title}</span>}
        </div>
        <div className={styles.line}>
          <DiceFaces dice={roll.dice} natural={roll.natural} />
          {roll.modifier !== 0 && <span className={styles.sum}>{sumText(roll)}</span>}
          {roll.parts.length > 0 && <span className={styles.parts}>{partsText(roll.parts)}</span>}
        </div>
        {damage && (
          <div className={cx(styles.line, styles.damage)}>
            {roll.damage && roll.damage.dice.length > 0 && <DiceFaces dice={roll.damage.dice} />}
            <span>{damage}</span>
          </div>
        )}
      </div>
      <div className={styles.total} aria-label={`Total ${roll.total}`}>
        {roll.total}
      </div>
    </li>
  )
}
