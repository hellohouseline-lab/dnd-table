import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { subclassIndex } from '../../rules/build/applyLevelUp.ts'
import { entryId, type CharacterBuild, type SpellEntry } from '../../rules/character.ts'
import { copyCost, spellChoices, spellLimits, type SpellLimits } from '../../rules/manage.ts'
import type { SrdClass, SrdSpell } from '../../rules/srd/index.ts'
import styles from '../builder/Builder.module.css'
import own from './Manage.module.css'

type ManageSpellsProps = {
  build: CharacterBuild
  onBuild: (build: CharacterBuild) => void
  cls: SrdClass
  spells: SrdSpell[]
}

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text
const levelWord = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`)

/** The counts at the top, in the words of how the class keeps its spells. */
function countWords(limits: SpellLimits, cantrips: number, spells: number, prepared: number): string {
  const c = `Cantrips: ${cantrips} of ${limits.cantrips}`
  if (limits.way === 'known') return `${c} · Spells known: ${spells} of ${limits.known ?? 0}`
  if (limits.way === 'prepared') return `${c} · Prepared today: ${prepared} of ${limits.prepared ?? 0}`
  return `${c} · In your spellbook: ${spells} · Prepared today: ${prepared} of ${limits.prepared ?? 0}`
}

const HOW: Record<SpellLimits['way'], string> = {
  known: 'You know these spells for good. You can swap one for another each time you level up.',
  prepared: 'You can call on any spell on your list. Pick the ones prepared today; change them after a long rest.',
  spellbook:
    'You cast from your spellbook. Add spells you find (copying one takes gold and time), and prepare some each day.',
  none: '',
}

/**
 * Spells, the builder's way: the class's list as cards, filtered by level, each with what it does
 * and a button to learn, forget, prepare or add to the spellbook, within what the class allows at
 * this level. A subclass's spells are always ready; spells from elsewhere stay, with Remove.
 */
export function ManageSpells({ build, onBuild, cls, spells }: ManageSpellsProps) {
  const [level, setLevel] = useState<number | 'all'>('all')
  const [mine, setMine] = useState(false)
  const limits = spellLimits({ level: build.level, scores: build.scores, features: build.features }, cls)
  if (limits.way === 'none') {
    return (
      <p className={styles.note}>
        A level {build.level} {cls.name.toLowerCase()} doesn&rsquo;t cast spells.
      </p>
    )
  }

  const list = build.spellcasting.spells
  const have = (index: string) => list.find((s) => s.index === index)
  const sub = subclassIndex(cls, build, null)
  const always = new Set(
    (sub ? (cls.subclassSpells[sub] ?? []) : [])
      .filter((s) => s.level <= build.level && !s.terrain)
      .map((s) => s.spell),
  )
  const cantrips = list.filter((s) => s.level === 0).length
  const leveled = list.filter((s) => s.level > 0 && !(s.index && always.has(s.index)))
  const prepared = leveled.filter((s) => s.prepared).length
  const choices = spellChoices(cls, limits, spells)
  const others = list.filter((s) => !s.index || !choices.some((c) => c.index === s.index))
  const shown = choices
    .filter((s) => level === 'all' || s.level === level)
    .filter((s) => !mine || have(s.index) || always.has(s.index))

  const setSpells = (next: SpellEntry[]) => onBuild({ ...build, spellcasting: { ...build.spellcasting, spells: next } })
  const add = (spell: SrdSpell, isPrepared: boolean) =>
    setSpells([
      ...list,
      { id: entryId(), index: spell.index, name: spell.name, level: spell.level, prepared: isPrepared },
    ])
  const remove = (index: string | null, id?: string) =>
    setSpells(list.filter((s) => (id ? s.id !== id : s.index !== index)))
  const setPrepared = (index: string, value: boolean) =>
    setSpells(list.map((s) => (s.index === index ? { ...s, prepared: value } : s)))

  function actions(spell: SrdSpell) {
    const entry = have(spell.index)
    if (always.has(spell.index)) return <span className={own.tag}>Always ready</span>
    if (spell.level === 0) {
      return entry ? (
        <button type="button" className={own.cardButton} onClick={() => remove(spell.index)}>
          Forget
        </button>
      ) : (
        <button
          type="button"
          className={own.cardButton}
          disabled={cantrips >= limits.cantrips}
          onClick={() => add(spell, true)}
        >
          Learn
        </button>
      )
    }
    if (limits.way === 'known') {
      return entry ? (
        <button type="button" className={own.cardButton} onClick={() => remove(spell.index)}>
          Forget
        </button>
      ) : (
        <button
          type="button"
          className={own.cardButton}
          disabled={leveled.length >= (limits.known ?? 0)}
          onClick={() => add(spell, true)}
        >
          Learn
        </button>
      )
    }
    if (limits.way === 'prepared') {
      return entry ? (
        <button type="button" className={own.cardButton} onClick={() => remove(spell.index)}>
          Unprepare
        </button>
      ) : (
        <button
          type="button"
          className={own.cardButton}
          disabled={prepared >= (limits.prepared ?? 0)}
          onClick={() => add(spell, true)}
        >
          Prepare
        </button>
      )
    }
    // A wizard: in the book or not, and prepared or not.
    if (!entry) {
      return (
        <button
          type="button"
          className={own.cardButton}
          title={`Copying it costs ${copyCost(spell.level)}`}
          onClick={() => add(spell, false)}
        >
          Add to spellbook
        </button>
      )
    }
    return (
      <>
        <button
          type="button"
          className={own.cardButton}
          disabled={!entry.prepared && prepared >= (limits.prepared ?? 0)}
          onClick={() => setPrepared(spell.index, !entry.prepared)}
        >
          {entry.prepared ? 'Unprepare' : 'Prepare'}
        </button>
        <button type="button" className={own.cardLink} onClick={() => remove(spell.index)}>
          Remove from book
        </button>
      </>
    )
  }

  return (
    <div className={styles.step}>
      <div className={styles.detail}>
        <p className={styles.plays}>
          <strong>{countWords(limits, cantrips, leveled.length, prepared)}</strong>
        </p>
        <p className={styles.note}>{HOW[limits.way]}</p>
        <div className={styles.optionRow} role="group" aria-label="Which spells">
          {(['all', ...Array.from({ length: limits.maxLevel + 1 }, (_, i) => i)] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={cx(styles.chip, level === l && styles.picked)}
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
            >
              {l === 'all' ? 'All' : levelWord(l)}
            </button>
          ))}
          <button
            type="button"
            className={cx(styles.chip, mine && styles.picked)}
            aria-pressed={mine}
            onClick={() => setMine(!mine)}
          >
            Only mine
          </button>
        </div>
      </div>

      <ul className={own.cardGrid}>
        {shown.map((spell) => {
          const entry = have(spell.index)
          const on =
            Boolean(entry && (spell.level === 0 || limits.way !== 'spellbook' || entry.prepared)) ||
            always.has(spell.index)
          return (
            <li
              key={spell.index}
              className={cx(styles.option, own.card, on && styles.picked, entry && !on && own.inBook)}
            >
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
              <span className={own.cardActions}>{actions(spell)}</span>
            </li>
          )
        })}
      </ul>

      {others.length > 0 && (
        <div className={styles.detail}>
          <h3 className={styles.choiceTitle}>Your other spells</h3>
          <p className={styles.note}>From your race, a magic item or another book.</p>
          <ul className={styles.traitList}>
            {others.map((s) => (
              <li key={s.id}>
                <span className={styles.traitName}>{s.name}</span>
                <span className={styles.traitLine}>{levelWord(s.level)}</span>{' '}
                <button type="button" className={own.cardLink} onClick={() => remove(s.index, s.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
