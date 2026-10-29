import { useState } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { cx } from '../../components/cx.ts'
import { entryId, type Character } from '../../rules/character.ts'
import { castableFrom, newSpellEntry, preparesSpells, spellbookList } from '../../rules/spellbook.ts'
import { spellLevelName } from '../../rules/spellLevels.ts'
import type { SrdClass, SrdSpell } from '../../rules/srd/index.ts'
import { Section } from './SheetTab.tsx'
import styles from './Spellbook.module.css'

type SpellbookProps = {
  character: Character
  /** The character's class in the free rules, if it is one. */
  cls: SrdClass | undefined
  spells: SrdSpell[] | null
  /** Changes the character's spells; left out when you can only look. */
  onChange?: (spellcasting: Character['spellcasting']) => void
}

/** How many spells show before "Show more", so a long list stays quick. */
const PAGE = 30
const LEVELS: (number | 'all')[] = ['all', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * Every spell in the free rules, cantrips to 9th level, whether the character can cast it yet or not:
 * search it, read it, and add it to your spells (or take it off). Spells above your level say from
 * which level you can cast them, so you can plan ahead.
 */
export function Spellbook({ character, cls, spells, onChange }: SpellbookProps) {
  const ownList = Boolean(cls?.spellcastingAbility)
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<number | 'all'>('all')
  // Your own class's list to start with, once the classes have loaded; null until you pick.
  const [picked, setEveryClass] = useState<boolean | null>(null)
  const everyClass = picked ?? !ownList
  const [shown, setShown] = useState(PAGE)
  const { spellcasting } = character

  const list = spells ? spellbookList(spells, { level, search, classIndex: everyClass || !cls ? null : cls.index }) : []
  const mine = (spell: SrdSpell) => spellcasting.spells.find((s) => s.index === spell.index)
  const prepares = preparesSpells(cls)

  const add = (spell: SrdSpell) =>
    onChange?.({ ...spellcasting, spells: [...spellcasting.spells, newSpellEntry(spell, character, cls, entryId())] })
  const remove = (spell: SrdSpell) =>
    onChange?.({ ...spellcasting, spells: spellcasting.spells.filter((s) => s.index !== spell.index) })
  const togglePrepared = (spell: SrdSpell) =>
    onChange?.({
      ...spellcasting,
      spells: spellcasting.spells.map((s) => (s.index === spell.index ? { ...s, prepared: !s.prepared } : s)),
    })

  const reset = (next: () => void) => {
    next()
    setShown(PAGE)
  }

  return (
    <Section title="Spellbook" note={spells ? `${list.length} spells` : 'Loading the spells…'}>
      <div className={styles.controls}>
        <input
          className={styles.search}
          type="search"
          aria-label="Search the spells"
          placeholder="Search by name or what it does: fire, heal, invisible…"
          value={search}
          onChange={(event) => reset(() => setSearch(event.target.value))}
        />
        {ownList && cls && (
          <select
            className={styles.scope}
            aria-label="Whose spells"
            value={everyClass ? 'every' : 'mine'}
            onChange={(event) => reset(() => setEveryClass(event.target.value === 'every'))}
          >
            <option value="mine">{cls.name} spells</option>
            <option value="every">Every class&rsquo;s spells</option>
          </select>
        )}
      </div>
      <div className={styles.levels} role="group" aria-label="Spell level">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            className={cx(styles.level, level === l && styles.levelOn)}
            aria-pressed={level === l}
            onClick={() => reset(() => setLevel(l))}
          >
            {l === 'all' ? 'All' : l === 0 ? 'Cantrips' : spellLevelName(l)}
          </button>
        ))}
      </div>

      {spells && list.length === 0 && (
        <p className={styles.none}>No spells match. Try fewer words, or another level.</p>
      )}
      <ul className={styles.list}>
        {list.slice(0, shown).map((spell) => {
          const entry = mine(spell)
          const from = cls ? castableFrom(cls, spell.level) : null
          const onClassList = !cls || spell.classes.includes(cls.index)
          let when: string | null = null
          if (cls && !onClassList) when = `Not a ${cls.name.toLowerCase()} spell`
          else if (cls && from === null) when = `${cls.name}s don’t cast this`
          else if (from !== null && from > character.level) when = `You can cast this from level ${from}`
          return (
            <li key={spell.index} className={cx(styles.spell, entry && styles.yours)}>
              <div className={styles.head}>
                <span className={styles.name}>
                  {spell.name}
                  <span className={styles.meta}>
                    {spell.level === 0 ? 'Cantrip' : spellLevelName(spell.level)} · {spell.school}
                    {spell.concentration && ' · Concentration'}
                    {spell.ritual && ' · Ritual'}
                  </span>
                </span>
                {entry && spell.level > 0 && prepares && onChange && (
                  <label className={styles.prepared}>
                    <input type="checkbox" checked={entry.prepared} onChange={() => togglePrepared(spell)} />
                    Prepared
                  </label>
                )}
                {onChange &&
                  (entry ? (
                    <button
                      type="button"
                      className={buttonClassName('quiet')}
                      aria-label={`Remove ${spell.name} from my spells`}
                      onClick={() => remove(spell)}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={buttonClassName('outline', { size: 'small' })}
                      aria-label={`Add ${spell.name} to my spells`}
                      onClick={() => add(spell)}
                    >
                      Add to my spells
                    </button>
                  ))}
              </div>
              {(entry || when) && (
                <div className={styles.status}>
                  {entry && <span className={styles.have}>In your spells</span>}
                  {when && <span className={styles.when}>{when}</span>}
                </div>
              )}
              <details className={styles.details}>
                <summary>
                  {spell.castingTime} · {spell.range} · {spell.duration}
                </summary>
                <p className={styles.muted}>Components: {spell.components}</p>
                <p className={styles.prose}>{spell.desc}</p>
                {spell.higherLevel && <p className={styles.prose}>{spell.higherLevel}</p>}
                <p className={styles.muted}>
                  Classes: {spell.classes.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}
                </p>
              </details>
            </li>
          )
        })}
      </ul>
      {list.length > shown && (
        <button
          type="button"
          className={buttonClassName('outline', { size: 'small' })}
          onClick={() => setShown((n) => n + PAGE)}
        >
          Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
        </button>
      )}
    </Section>
  )
}
