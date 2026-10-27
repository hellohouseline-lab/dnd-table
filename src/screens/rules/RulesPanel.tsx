import { useEffect, useState } from 'react'
import { cx } from '../../components/cx.ts'
import {
  RULE_ENTRIES,
  RULE_SECTIONS,
  searchRules,
  type RuleEntry,
  type RuleSectionKey,
} from '../../rules/rulesGuide.ts'
import { findCondition, loadRuleSections, type SrdRuleSection } from '../../rules/srd/index.ts'
import styles from './RulesPanel.module.css'

type RulesPanelProps = {
  /** An entry to open at once ("condition:prone"), as when a condition on the plate is clicked. */
  focus?: string
  /** Conditions the character has, by index: shown first and marked. */
  yours?: string[]
  className?: string
  onClose: () => void
}

/**
 * The Rules panel (S1e): the rules in plain words, with the free rules' own words folded
 * underneath, opened beside the table rather than over it. Search covers every section.
 */
export default function RulesPanel({ focus, yours = [], className, onClose }: RulesPanelProps) {
  const focused = RULE_ENTRIES.find((e) => e.id === focus)
  const [section, setSection] = useState<RuleSectionKey>(focused?.section ?? 'conditions')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(focused?.id ?? null)
  const [srd, setSrd] = useState<SrdRuleSection[]>([])

  useEffect(() => {
    let live = true
    void loadRuleSections().then((sections) => live && setSrd(sections))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  const srdText = (entry: RuleEntry): string =>
    entry.srdCondition
      ? (findCondition(entry.srdCondition)?.desc ?? '')
      : (entry.srdSections ?? []).map((index) => srd.find((s) => s.index === index)?.desc ?? '').join('\n\n')

  const searching = query.trim() !== ''
  const shown = searching
    ? searchRules(RULE_ENTRIES, query, srdText)
    : RULE_ENTRIES.filter((e) => e.section === section).sort(
        (a, b) => Number(isYours(b, yours)) - Number(isYours(a, yours)),
      )

  return (
    <section className={cx(styles.panel, className)} aria-label="Rules">
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Rules</h2>
          <p className={styles.lead}>In plain words, from the free rules</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} title="Close (Esc)">
          Close
        </button>
      </div>

      <input
        className={styles.search}
        type="search"
        value={query}
        placeholder="Search: prone, dash, short rest"
        aria-label="Search the rules"
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
        <ul
          className={styles.entries}
          aria-label={searching ? 'What we found' : RULE_SECTIONS.find((s) => s.key === section)?.name}
        >
          {shown.map((entry) => {
            const isOpen = open === entry.id || (searching && shown.length === 1)
            const words = srdText(entry)
            return (
              <li key={entry.id} className={cx(styles.entry, isOpen && styles.entryOpen)}>
                <button
                  type="button"
                  className={styles.entryHead}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : entry.id)}
                >
                  <span className={styles.entryTitle}>{entry.title}</span>
                  {isYours(entry, yours) && <span className={styles.yours}>You</span>}
                  {searching && (
                    <span className={styles.where}>{RULE_SECTIONS.find((s) => s.key === entry.section)?.name}</span>
                  )}
                </button>
                {isOpen && (
                  <div className={styles.entryBody}>
                    <p className={styles.plain}>{entry.plain}</p>
                    {entry.list && (
                      <ul className={styles.list}>
                        {entry.list.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
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
          })}
        </ul>
        <p className={styles.credit}>
          The rules&rsquo; words are from the System Reference Document 5.1 by Wizards of the Coast, under CC-BY-4.0.
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
