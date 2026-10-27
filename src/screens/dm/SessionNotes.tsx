import { useEffect, useMemo, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { LogEvent } from '../../live/notebook.ts'
import { groupSessions, highlight, searchSessions, type SessionEntry } from '../../rules/sessions.ts'
import styles from './SessionNotes.module.css'

type SessionNotesProps = {
  /** Every note and scene change at the table, from the database; left out in the previews. */
  load?: () => Promise<LogEvent[]>
  /** The latest log entries, live: notes written since the page opened appear at once. */
  recent: LogEvent[]
}

const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

const toEntry = (event: LogEvent): SessionEntry[] =>
  event.kind === 'note' || event.kind === 'stage'
    ? [{ id: event.id, kind: event.kind, text: event.text, at: event.createdAt }]
    : []

/**
 * The DM's quick notes from every session, newest session first, with the scene changes between
 * them. Search finds notes by every word typed, keeping the scene each was written in.
 */
export function SessionNotes({ load, recent }: SessionNotesProps) {
  const [older, setOlder] = useState<LogEvent[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(load ? 'loading' : 'ready')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!load) return
    let live = true
    load().then(
      (list) => {
        if (!live) return
        setOlder(list)
        setStatus('ready')
      },
      () => live && setStatus('error'),
    )
    return () => {
      live = false
    }
  }, [load])

  const sessions = useMemo(() => {
    const byId = new Map<string, SessionEntry>()
    for (const event of [...older, ...recent]) for (const entry of toEntry(event)) byId.set(entry.id, entry)
    return groupSessions([...byId.values()])
  }, [older, recent])
  const found = searchSessions(sessions, query).reverse()
  const noteCount = found.reduce((n, s) => n + s.entries.filter((e) => e.kind === 'note').length, 0)

  return (
    <section className={styles.panel} aria-label="Session notes">
      <div className={styles.bar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search your notes: a name, a place, an item…"
          aria-label="Search your notes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className={styles.count}>
          {query.trim()
            ? `${noteCount} ${noteCount === 1 ? 'note' : 'notes'} found`
            : `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`}
        </span>
      </div>

      {status === 'loading' && <p className={styles.empty}>Fetching your notes…</p>}
      {status === 'error' && (
        <p className={styles.empty}>Older notes couldn&rsquo;t be fetched. Showing tonight&rsquo;s.</p>
      )}
      {status !== 'loading' && found.length === 0 && (
        <p className={styles.empty}>
          {query.trim()
            ? 'Nothing matches. Try one word, or a name.'
            : 'No notes yet. Add a quick note during play and it lands here, by session.'}
        </p>
      )}

      {found.map((session, i) => (
        <details key={session.number} className={styles.session} open={i === 0 || Boolean(query.trim())}>
          <summary>
            <span className={styles.number}>Session {session.number}</span>
            <span className={styles.date}>{day.format(new Date(session.start))}</span>
          </summary>
          <ul className={styles.entries}>
            {session.entries.map((entry) => (
              <li key={entry.id} className={cx(styles.entry, entry.kind === 'stage' && styles.scene)}>
                <span className={styles.time}>{time.format(new Date(entry.at))}</span>
                <span className={styles.text}>
                  {highlight(entry.text, query).map((piece, j) =>
                    piece.hit ? <mark key={j}>{piece.text}</mark> : <span key={j}>{piece.text}</span>,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
