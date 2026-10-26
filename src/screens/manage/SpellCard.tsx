import { useState, type ReactNode } from 'react'
import { cx } from '../../components/cx.ts'
import { togglePick } from '../../rules/build/draft.ts'
import { levelWord } from '../../rules/manage.ts'
import type { SrdSpell } from '../../rules/srd/index.ts'
import styles from '../builder/Builder.module.css'
import own from './Manage.module.css'

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

type SpellCardProps = {
  spell: SrdSpell
  /** Known, prepared or picked: drawn in gold. */
  on: boolean
  /** In a wizard's book but not prepared: a dashed edge. */
  inBook?: boolean
  children: ReactNode
}

/** A spell as a card: its name, level and school, how it's cast, what it does, and buttons. */
export function SpellCard({ spell, on, inBook = false, children }: SpellCardProps) {
  return (
    <li className={cx(styles.option, own.card, on && styles.picked, inBook && own.inBook)}>
      <span className={styles.optionName}>
        {spell.name}
        {spell.concentration && (
          <span className={styles.concMark} title="Concentration">
            {' '}
            C
          </span>
        )}
      </span>
      <span className={styles.spellMeta}>
        {levelWord(spell.level)} · {spell.school} · {spell.castingTime} · {spell.range}
      </span>
      <span className={styles.optionLine} title={spell.desc}>
        {first(spell.desc)}
      </span>
      <details className={own.more}>
        <summary>All of it</summary>
        <p>{spell.desc}</p>
        {spell.higherLevel && <p>{spell.higherLevel}</p>}
      </details>
      <span className={own.cardActions}>{children}</span>
    </li>
  )
}

type LevelFilterProps = { levels: number[]; value: number | 'all'; onChange: (value: number | 'all') => void }

/** All, Cantrip, Level 1… as chips. */
export function LevelFilter({ levels, value, onChange }: LevelFilterProps) {
  return (
    <>
      {(['all', ...levels] as const).map((l) => (
        <button
          key={l}
          type="button"
          className={cx(styles.chip, value === l && styles.picked)}
          aria-pressed={value === l}
          onClick={() => onChange(l)}
        >
          {l === 'all' ? 'All' : levelWord(l)}
        </button>
      ))}
    </>
  )
}

type SpellPickProps = {
  title: string
  spells: SrdSpell[]
  picked: string[]
  choose: number
  onChange: (picked: string[]) => void
  /** The level to show first, such as a newly reached spell level. */
  startLevel?: number | null
  note?: string
}

/** Pick some spells from a list of cards, filtered by level, up to how many are allowed. */
export function SpellPick({ title, spells, picked, choose, onChange, startLevel = null, note }: SpellPickProps) {
  const levels = [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b)
  const [level, setLevel] = useState<number | 'all'>(
    startLevel !== null && levels.includes(startLevel) ? startLevel : 'all',
  )
  const shown = spells.filter((s) => level === 'all' || s.level === level || picked.includes(s.index))
  const full = picked.length >= choose
  return (
    <div className={styles.choice}>
      <h3 className={styles.choiceTitle}>
        {title} ({picked.length} of {choose})
      </h3>
      {note && <p className={styles.note}>{note}</p>}
      {levels.length > 1 && (
        <div className={styles.optionRow} role="group" aria-label={`${title}: which level`}>
          <LevelFilter levels={levels} value={level} onChange={setLevel} />
        </div>
      )}
      <ul className={own.cardGrid} aria-label={title}>
        {shown.map((spell) => {
          const on = picked.includes(spell.index)
          return (
            <SpellCard key={spell.index} spell={spell} on={on}>
              <button
                type="button"
                className={own.cardButton}
                aria-pressed={on}
                aria-label={`${on ? 'Unpick' : 'Pick'} ${spell.name}`}
                disabled={!on && full && choose > 1}
                onClick={() => onChange(togglePick(picked, spell.index, choose))}
              >
                {on ? 'Picked' : 'Pick'}
              </button>
            </SpellCard>
          )
        })}
      </ul>
    </div>
  )
}
