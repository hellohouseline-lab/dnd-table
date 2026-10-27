import { describe, expect, it } from 'vitest'
import { groupSessions, highlight, matches, searchSessions, type SessionEntry } from './sessions.ts'

const note = (id: string, at: string, text: string): SessionEntry => ({ id, kind: 'note', text, at })
const scene = (id: string, at: string, text: string): SessionEntry => ({ id, kind: 'stage', text, at })

const entries = [
  scene('s1', '2026-10-24T18:00:00Z', 'Went to the Gull and Anchor'),
  note('n1', '2026-10-24T18:20:00Z', 'Tobin has a pearl on a string'),
  note('n2', '2026-10-24T23:50:00Z', 'Party owes the innkeeper 5 gp'),
  scene('s2', '2026-10-25T00:30:00Z', 'Went to the chapel'),
  note('n3', '2026-10-25T00:40:00Z', 'The bell rope is wet'),
  note('n4', '2026-10-31T19:00:00Z', 'Elowen kept the hag’s pearl'),
]

describe('notes by session', () => {
  it('keeps an evening together, even past midnight, and starts again after a long gap', () => {
    const sessions = groupSessions(entries)
    expect(sessions.map((s) => [s.number, s.entries.map((e) => e.id)])).toEqual([
      [1, ['s1', 'n1', 'n2', 's2', 'n3']],
      [2, ['n4']],
    ])
    expect(sessions[0]).toMatchObject({ start: '2026-10-24T18:00:00Z', end: '2026-10-25T00:40:00Z' })
  })

  it('finds notes by every word, with the scene they were in', () => {
    expect(matches('Tobin has a pearl', 'PEARL tobin')).toBe(true)
    expect(matches('Tobin has a pearl', 'pearl hag')).toBe(false)
    const found = searchSessions(groupSessions(entries), 'pearl')
    expect(found.map((s) => [s.number, s.entries.map((e) => e.id)])).toEqual([
      [1, ['s1', 'n1']],
      [2, ['n4']],
    ])
    expect(searchSessions(groupSessions(entries), 'chapel')[0].entries.map((e) => e.id)).toEqual(['s2'])
    expect(searchSessions(groupSessions(entries), 'dragon')).toEqual([])
    expect(searchSessions(groupSessions(entries), '  ')).toHaveLength(2)
  })

  it('marks the words searched for', () => {
    expect(highlight('Tobin has a pearl', 'pearl')).toEqual([
      { text: 'Tobin has a ', hit: false },
      { text: 'pearl', hit: true },
    ])
    expect(highlight('5 gp (owed)', '(owed)')).toEqual([
      { text: '5 gp ', hit: false },
      { text: '(owed)', hit: true },
    ])
  })
})
