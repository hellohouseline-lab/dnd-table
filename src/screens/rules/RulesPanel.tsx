import { useEffect, useRef, useState } from 'react'
import { cx } from '../../components/cx.ts'
import {
  RULE_ENTRIES,
  RULE_SECTIONS,
  searchRules,
  spellEntry,
  type RuleEntry,
  type RuleSectionKey,
} from '../../rules/rulesGuide.ts'
import {
  findCondition,
  loadRuleSections,
  loadSpells,
  type SrdRuleSection,
  type SrdSpell,
} from '../../rules/srd/index.ts'
import styles from './RulesPanel.module.css'

type RulesPanelProps = {
  /** An entry to open at once ("condition:prone"), as when a condition on the plate is clicked. */
  focus?: string
  /** Conditions the character has, by index: shown first and marked. */
  yours?: string[]
  /** The player's class and spells, for the Spells section. Leave out for the DM, who sees every spell. */
  caster?: { className: string; spells: { index: string | null; prepared: boolean }[] } | null
  className?: string
  onClose: () => void
}

/**
 * The Rules panel (S1e): the rules in plain words, with the free rules' own words folded
 * underneath, opened beside the table rather than over it. Search covers every section, and the
 * spells of your class (or every class's).
 */
export default function RulesPanel({ focus, yours = [], caster, className, onClose }: RulesPanelProps) {
  const focused = RULE_ENTRIES.find((e) => e.id === focus)
  const [section, setSection] = useState<RuleSectionKey>(focused?.section ?? 'conditions')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(focused?.id ?? null)
  const [srd, setSrd] = useState<SrdRuleSection[]>([])
  const [spells, setSpells] = useState<SrdSpell[]>([])
  const [everyClass, setEveryClass] = useState(false)
  const [level, setLevel] = useState<number | 'all'>('all')
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    void loadRuleSections().then((sections) => live && setSrd(sections))
    void loadSpells().then((list) => live && setSpells(list))
    return () => {
      live = false
    }
  }, [])

  // Esc closes; / jumps to the search box (unless you're already typing somewhere).
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      const typing = (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')
      if (event.key === '/' && !typing) {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [onClose])

  const srdText = (entry: RuleEntry): string =>
    entry.srdCondition
      ? (findCondition(entry.srdCondition)?.desc ?? '')
      : (entry.srdSections ?? []).map((index) => srd.find((s) => s.index === index)?.desc ?? '').join('\n\n')

  // The spells to show: your class's list, or every class's for the DM or with the tick.
  const classIndex = caster?.className.toLowerCase() ?? ''
  const classHasSpells = spells.some((s) => s.classes.includes(classIndex))
  const allSpells = !caster || everyClass
  const mySpells = new Map((caster?.spells ?? []).flatMap((s) => (s.index ? [[s.index, s.prepared] as const] : [])))
  const spellList = spells
    .filter((s) => allSpells || s.classes.includes(classIndex))
    .sort((a, b) => Number(mySpells.has(b.index)) - Number(mySpells.has(a.index)) || a.level - b.level)
  const spellLevels = [...new Set(spellList.map((s) => s.level))].sort((a, b) => a - b)
  const spellShown = spellList.filter((s) => level === 'all' || s.level === level).map(spellEntry)

  const searching = query.trim() !== ''
  const shown = searching
    ? searchRules([...RULE_ENTRIES, ...spellList.map(spellEntry)], query, srdText)
    : RULE_ENTRIES.filter((e) => e.section === section).sort(
        (a, b) => Number(isYours(b, yours)) - Number(isYours(a, yours)),
      )

  const entryItem = (entry: RuleEntry, isOpen: boolean) => {
    const words = entry.spell ? '' : srdText(entry)
    const badge = isYours(entry, yours)
      ? 'You'
      : entry.spell && mySpells.has(entry.spell.index)
        ? mySpells.get(entry.spell.index)
          ? 'Yours'
          : 'In your book'
        : null
    return (
      <li key={entry.id} className={cx(styles.entry, isOpen && styles.entryOpen)}>
        <button
          type="button"
          className={styles.entryHead}
          aria-expanded={isOpen}
          onClick={() => setOpen(isOpen ? null : entry.id)}
        >
          <span className={styles.entryTitle}>{entry.title}</span>
          {badge && <span className={styles.yours}>{badge}</span>}
          {searching ? (
            <span className={styles.where}>{RULE_SECTIONS.find((s) => s.key === entry.section)?.name}</span>
          ) : (
            entry.spell && (
              <span className={styles.where}>{entry.spell.level === 0 ? 'Cantrip' : `Level ${entry.spell.level}`}</span>
            )
          )}
        </button>
        {isOpen && (
          <div className={styles.entryBody}>
            <p className={entry.spell ? styles.spellMeta : styles.plain}>{entry.plain}</p>
            {entry.list && (
              <ul className={styles.list}>
                {entry.list.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {entry.spell && (
              <div className={styles.spellText}>
                {paragraphs(entry.spell.desc).map((p, i) => (
                  <p key={i}>{p.text}</p>
                ))}
                {entry.spell.higherLevel && (
                  <p>
                    <strong>At higher levels.</strong> {entry.spell.higherLevel}
                  </p>
                )}
              </div>
            )}
            {words && (
              <details className={styles.srd}>
                <summary>The rules&rsquo; words</summary>
                {paragraphs(words).map((p, i) =>
                  p.heading ? (
                    <h4 key={i} className={styles.srdHeading}>
                      {p.text}
                    </h4>
                  ) : (
                    <p key={i}>{p.text}</p>
                  ),
                )}
              </details>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <section className={cx(styles.panel, className)} aria-label="Rules">
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Rules</h2>
          <p className={styles.lead}>In plain words, from the free rules</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} title="Close (Esc or ?)">
          Close
        </button>
      </div>

      <input
        ref={search}
        className={styles.search}
        type="search"
        value={query}
        placeholder="Search: prone, dash, short rest, fire bolt"
        aria-label="Search the rules"
        title="Search (/)"
        onChange={(e) => setQuery(e.target.value)}
      />

      <div role="tablist" aria-label="Rules sections" className={styles.tabs}>
        {RULE_SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={!searching && s.key === section}
            className={cx(styles.tab, !searching && s.key === section && styles.selected)}
            title={s.hint}
            onClick={() => {
              setSection(s.key)
              setQuery('')
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {searching && shown.length === 0 && (
          <p className={styles.nothing}>Nothing called that. Try another word, or ask the DM.</p>
        )}
        {!searching && section === 'spells' && <h3 className={styles.subhead}>How spells work</h3>}
        <ul
          className={styles.entries}
          aria-label={
            searching
              ? 'What we found'
              : section === 'spells'
                ? 'How spells work'
                : RULE_SECTIONS.find((s) => s.key === section)?.name
          }
        >
          {shown.map((entry) => entryItem(entry, open === entry.id || (searching && shown.length === 1)))}
        </ul>

        {!searching && section === 'spells' && (
          <>
            <h3 className={styles.subhead}>
              {allSpells ? 'Every spell in the free rules' : `${caster?.className} spells`}
            </h3>
            {caster && (
              <label className={styles.tick}>
                <input type="checkbox" checked={everyClass} onChange={(e) => setEveryClass(e.target.checked)} /> Every
                class&rsquo;s spells
              </label>
            )}
            {caster && !classHasSpells && !everyClass ? (
              <p className={styles.nothing}>
                {caster.className ? `A ${caster.className.toLowerCase()} doesn't cast spells` : 'No spells yet'}, but
                tick Every class&rsquo;s spells to read what the others can do.
              </p>
            ) : (
              <>
                <div className={styles.levels} role="group" aria-label="Spell level">
                  {(['all', ...spellLevels] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={cx(styles.level, level === l && styles.selected)}
                      aria-pressed={level === l}
                      onClick={() => setLevel(l)}
                    >
                      {l === 'all' ? 'All' : l === 0 ? 'Cantrips' : l}
                    </button>
                  ))}
                </div>
                <ul className={styles.entries} aria-label="Spells">
                  {spellShown.map((entry) => entryItem(entry, open === entry.id))}
                </ul>
              </>
            )}
          </>
        )}
        <p className={styles.credit}>
          The rules&rsquo; words and spells are from the System Reference Document 5.1 by Wizards of the Coast, under
          CC-BY-4.0.
        </p>
      </div>
    </section>
  )
}

function isYours(entry: RuleEntry, yours: string[]): boolean {
  return !!entry.srdCondition && yours.includes(entry.srdCondition)
}

/** The free rules' Markdown as plain paragraphs and small headings. */
function paragraphs(text: string): { text: string; heading: boolean }[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = /^#+\s+/.test(block)
      return {
        heading,
        text: block
          .replace(/^#+\s+/, '')
          .replace(/\*\*|__|\*|_/g, '')
          .replace(/^\s*[-*]\s+/gm, '• ')
          .replace(/\n/g, ' '),
      }
    })
}
