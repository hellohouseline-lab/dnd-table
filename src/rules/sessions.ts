// The DM's quick notes, by session: a new session starts after a long gap (6 hours) with nothing
// written, so an evening's play stays together however late it runs. Searching keeps the notes that
// match, with the scene the party was in at the time.

export type SessionEntry = { id: string; kind: 'note' | 'stage'; text: string; at: string }

export type Session = {
  /** 1 for the first session at the table. */
  number: number
  start: string
  end: string
  entries: SessionEntry[]
}

const GAP_HOURS = 6

/** Entries in sessions, oldest session first, entries in time order. */
export function groupSessions(entries: SessionEntry[], gapHours = GAP_HOURS): Session[] {
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at))
  const sessions: Session[] = []
  for (const entry of sorted) {
    const last = sessions[sessions.length - 1]
    const gap = last ? new Date(entry.at).getTime() - new Date(last.end).getTime() : Infinity
    if (!last || gap > gapHours * 3_600_000) {
      sessions.push({ number: sessions.length + 1, start: entry.at, end: entry.at, entries: [entry] })
    } else {
      last.entries.push(entry)
      last.end = entry.at
    }
  }
  return sessions
}

/** Every word of the search somewhere in the text, ignoring case. */
export function matches(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const lower = text.toLowerCase()
  return words.every((w) => lower.includes(w))
}

/**
 * Sessions with only the notes that match, each with the scene change before it (where the party
 * was), and sessions with no match left out. An empty search keeps everything.
 */
export function searchSessions(sessions: Session[], query: string): Session[] {
  if (!query.trim()) return sessions
  return sessions.flatMap((session) => {
    const kept: SessionEntry[] = []
    let scene: SessionEntry | null = null
    for (const entry of session.entries) {
      if (entry.kind === 'stage') {
        scene = entry
        if (matches(entry.text, query)) kept.push(entry)
        continue
      }
      if (!matches(entry.text, query)) continue
      if (scene && !kept.includes(scene)) kept.push(scene)
      kept.push(entry)
    }
    return kept.some((e) => e.kind === 'note' || matches(e.text, query)) ? [{ ...session, entries: kept }] : []
  })
}

/** The text in pieces, with the searched words marked, for highlighting. */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (words.length === 0) return [{ text, hit: false }]
  const pattern = new RegExp(`(${words.join('|')})`, 'gi')
  return text
    .split(pattern)
    .filter((piece) => piece !== '')
    .map((piece) => ({ text: piece, hit: words.some((w) => new RegExp(`^${w}$`, 'i').test(piece)) }))
}
