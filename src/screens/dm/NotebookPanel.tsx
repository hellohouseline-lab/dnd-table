import { useState, type KeyboardEvent, type RefObject } from 'react'
import { cx } from '../../components/cx.ts'
import type { Notebook } from '../../live/notebook.ts'
import type { NotebookControls } from '../../live/useNotebook.ts'
import styles from './NotebookPanel.module.css'

type NotebookPanelProps = {
  notebook: NotebookControls
  /** Adds a quick note to the session log. */
  onNote: (text: string) => void
  /** So "Add a note" in the bottom bar can jump straight to the box. */
  noteInput?: RefObject<HTMLInputElement | null>
  className?: string
}

function onEnter(event: KeyboardEvent<HTMLInputElement>, run: () => void) {
  if (event.key === 'Enter') {
    event.preventDefault()
    run()
  }
}

/** The DM's notebook from design 07: where we are, what happens next, key items and a quick note. */
export function NotebookPanel({ notebook: controls, onNote, noteInput, className }: NotebookPanelProps) {
  const { notebook, change } = controls
  const [editing, setEditing] = useState(false)
  const [step, setStep] = useState('')
  const [item, setItem] = useState('')
  const [note, setNote] = useState('')
  const set = (patch: Partial<Notebook>) => change({ ...notebook, ...patch })

  function addStep() {
    if (!step.trim()) return
    set({ nextSteps: [...notebook.nextSteps, { id: crypto.randomUUID(), text: step.trim(), done: false }] })
    setStep('')
  }

  function addItem() {
    if (!item.trim()) return
    set({ keyItems: [...notebook.keyItems, { id: crypto.randomUUID(), name: item.trim(), holder: '' }] })
    setItem('')
  }

  function addNote() {
    if (!note.trim()) return
    onNote(note.trim())
    setNote('')
  }

  return (
    <section className={cx(styles.notebook, className)} aria-label="Your notebook">
      <div className={styles.scroll}>
        <div className={styles.headRow}>
          <h2 className={styles.heading}>Where we are</h2>
          <button type="button" className={styles.small} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
        {editing ? (
          <textarea
            className={styles.story}
            aria-label="Where we are"
            rows={6}
            maxLength={4000}
            autoFocus
            value={notebook.whereWeAre}
            onChange={(event) => set({ whereWeAre: event.target.value })}
          />
        ) : (
          <button type="button" className={styles.storyText} onClick={() => setEditing(true)}>
            {notebook.whereWeAre || 'Write where the story is up to, so you never lose your place. Click to start.'}
          </button>
        )}

        <h2 className={styles.heading}>What happens next</h2>
        <ul className={styles.list}>
          {notebook.nextSteps.map((s) => (
            <li key={s.id} className={styles.step}>
              <label className={cx(styles.check, s.done && styles.done)}>
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={(event) =>
                    set({
                      nextSteps: notebook.nextSteps.map((x) =>
                        x.id === s.id ? { ...x, done: event.target.checked } : x,
                      ),
                    })
                  }
                />
                <span>{s.text}</span>
              </label>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove “${s.text}”`}
                onClick={() => set({ nextSteps: notebook.nextSteps.filter((x) => x.id !== s.id) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          className={styles.add}
          aria-label="Add something that happens next"
          placeholder="Add a step, then press Enter"
          maxLength={200}
          value={step}
          onChange={(event) => setStep(event.target.value)}
          onKeyDown={(event) => onEnter(event, addStep)}
        />

        <h2 className={styles.heading}>Key items to collect</h2>
        <ul className={styles.list}>
          {notebook.keyItems.map((k) => (
            <li key={k.id} className={styles.item}>
              <span className={styles.itemName}>{k.name}</span>
              <input
                className={styles.holder}
                aria-label={`Who has ${k.name}`}
                placeholder="not found"
                maxLength={60}
                value={k.holder}
                onChange={(event) =>
                  set({
                    keyItems: notebook.keyItems.map((x) => (x.id === k.id ? { ...x, holder: event.target.value } : x)),
                  })
                }
              />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${k.name}`}
                onClick={() => set({ keyItems: notebook.keyItems.filter((x) => x.id !== k.id) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          className={styles.add}
          aria-label="Add a key item"
          placeholder="Add an item, then press Enter"
          maxLength={80}
          value={item}
          onChange={(event) => setItem(event.target.value)}
          onKeyDown={(event) => onEnter(event, addItem)}
        />
      </div>

      <div className={styles.quick}>
        <h2 className={styles.heading}>Quick note</h2>
        <div className={styles.quickRow}>
          <input
            ref={noteInput}
            className={styles.quickInput}
            aria-label="Quick note"
            placeholder="Something to remember…"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => onEnter(event, addNote)}
          />
          <button type="button" className={styles.quickAdd} disabled={!note.trim()} onClick={addNote}>
            Add
          </button>
        </div>
        <p className={styles.status} aria-live="polite">
          {controls.error ?? (controls.saving ? 'Saving…' : 'Notes go into the Log tab. Only you see them.')}
        </p>
      </div>
    </section>
  )
}
