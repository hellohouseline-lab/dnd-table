import { describe, expect, it } from 'vitest'
import { conditionEntry, RULE_ENTRIES, RULE_SECTIONS, searchRules } from './rulesGuide.ts'
import { CONDITIONS, loadRuleSections } from './srd/index.ts'

describe('the Rules panel', () => {
  it('explains every condition, in plain words with the free rules underneath', () => {
    for (const condition of CONDITIONS) {
      const entry = conditionEntry(condition.index)
      expect(entry?.plain, condition.name).toBeTruthy()
      expect(entry?.srdCondition).toBe(condition.index)
    }
    expect(conditionEntry('exhaustion')?.list).toHaveLength(6)
  })

  it('has something in every section, and every entry has plain words with no em dashes', () => {
    for (const section of RULE_SECTIONS) {
      expect(
        RULE_ENTRIES.some((e) => e.section === section.key),
        section.name,
      ).toBe(true)
    }
    expect(new Set(RULE_ENTRIES.map((e) => e.id)).size).toBe(RULE_ENTRIES.length)
    for (const entry of RULE_ENTRIES) {
      expect(entry.plain, entry.id).toBeTruthy()
      for (const text of [entry.title, entry.plain, ...(entry.list ?? [])]) expect(text, entry.id).not.toMatch(/—/)
    }
    expect(RULE_ENTRIES.find((e) => e.id === 'dice:skills')?.list).toHaveLength(18)
  })

  it('points only at sections of the free rules that are in the app', async () => {
    const sections = new Set((await loadRuleSections()).map((s) => s.index))
    for (const entry of RULE_ENTRIES) for (const s of entry.srdSections ?? []) expect(sections.has(s), s).toBe(true)
  })

  it('finds what a player types, best first', () => {
    const first = (query: string) => searchRules(RULE_ENTRIES, query)[0]?.id
    expect(first('prone')).toBe('condition:prone')
    expect(first('Prone ')).toBe('condition:prone')
    expect(first('dash')).toBe('turn:dash')
    expect(first('run')).toBe('turn:dash')
    expect(first('advantage')).toBe('dice:advantage')
    expect(first('short rest')).toBe('rest:short')
    expect(first('death save')).toBe('turn:dropping')
    expect(first('stealth')).toBe('turn:hide')
    expect(searchRules(RULE_ENTRIES, '')).toHaveLength(RULE_ENTRIES.length)
    expect(searchRules(RULE_ENTRIES, 'zzz')).toEqual([])
    // Words match from their start: "run" isn't found inside "trunk".
    expect(searchRules(RULE_ENTRIES, 'run', () => 'a tree trunk').map((e) => e.id)).toEqual(['turn:dash'])
  })

  it('also searches the free rules words when they are loaded', () => {
    const srd = (e: { id: string }) => (e.id === 'turn:cover' ? 'a wall or a tree trunk' : '')
    expect(searchRules(RULE_ENTRIES, 'tree trunk', srd).map((e) => e.id)).toEqual(['turn:cover'])
  })
})
