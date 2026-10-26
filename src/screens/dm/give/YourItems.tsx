import { useState } from 'react'
import type { GivingControls } from '../../../live/giving.ts'
import { RARITIES, TYPE_TAGS, type DmItem, type Rarity, type TypeTag } from '../../../rules/catalogue.ts'
import own from '../GiveDialog.module.css'
import styles from '../RestDialog.module.css'
import { Status, type StatusLine } from './Status.tsx'

const BLANK: DmItem = { id: '', name: '', description: '', type: 'other', rarity: null, key: false }

/**
 * Your items: things you make once (a name, what it is, tags, key item or not) and give whenever.
 * Only you see them until one is in a player's pack.
 */
export function YourItems({ giving, onDone }: { giving: GivingControls; onDone: () => void }) {
  const [draft, setDraft] = useState<DmItem>(BLANK)
  const [status, setStatus] = useState<StatusLine | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const problem = await giving.saveItem(draft)
    setBusy(false)
    setStatus(
      problem
        ? { ok: false, text: problem }
        : { ok: true, text: `${draft.name.trim()} is saved. Find it under Your items.` },
    )
    if (!problem) setDraft(BLANK)
  }

  return (
    <div className={own.makeColumns}>
      <form
        className={own.makeForm}
        aria-label={draft.id ? 'Change your item' : 'Make an item'}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className={own.field}>
          <span className={styles.legend}>Name</span>
          <input
            value={draft.name}
            maxLength={60}
            placeholder="The Raven Seal"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className={own.field}>
          <span className={styles.legend}>What it is</span>
          <textarea
            value={draft.description}
            maxLength={1000}
            rows={4}
            placeholder="A black wax seal stamped with a raven. The mayor would give anything to have it back."
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <div className={own.makeRow}>
          <label className={own.field}>
            <span className={styles.legend}>Type</span>
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as TypeTag })}>
              {TYPE_TAGS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className={own.field}>
            <span className={styles.legend}>Rarity</span>
            <select
              value={draft.rarity ?? ''}
              onChange={(e) => setDraft({ ...draft, rarity: (e.target.value || null) as Rarity | null })}
            >
              <option value="">Not magic</option>
              {RARITIES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.person}>
          <input type="checkbox" checked={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.checked })} />
          Key item: it matters to the story (giving it fills in who has it in your notebook)
        </label>
        <Status status={status} />
        <div className={styles.buttons}>
          {draft.id && (
            <button type="button" className={styles.secondary} onClick={() => setDraft(BLANK)}>
              Make a new one instead
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={onDone}>
            Back to giving
          </button>
          <button type="submit" className={styles.primary} disabled={!draft.name.trim() || busy}>
            {draft.id ? 'Save changes' : 'Save the item'}
          </button>
        </div>
      </form>

      <div>
        <h3 className={styles.legend}>Your items ({giving.yours.length})</h3>
        {giving.yours.length === 0 ? (
          <p className={styles.note}>None yet. Make one for every key item in your story.</p>
        ) : (
          <ul className={own.yoursList}>
            {giving.yours.map((item) => (
              <li key={item.id}>
                <span className={own.name}>
                  {item.name}
                  {item.key && <span className={own.keyTag}>key item</span>}
                </span>
                <span className={own.words}>{item.description}</span>
                <span className={own.yoursButtons}>
                  <button type="button" className={own.link} onClick={() => setDraft(item)}>
                    Change
                  </button>
                  <button
                    type="button"
                    className={own.link}
                    onClick={() => {
                      if (window.confirm(`Throw away ${item.name}? Anyone carrying one keeps it.`))
                        void giving.deleteItem(item.id)
                    }}
                  >
                    Throw away
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
