import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { AreaTone } from '../../live/areas.ts'
import type { AreaShape } from '../../rules/areas.ts'
import styles from './Fight.module.css'
import own from './AreaDialog.module.css'

export type AreaDraft = { shape: AreaShape; sizeFt: number; label: string; tone: AreaTone; hidden: boolean }

const SHAPES: { shape: AreaShape; name: string; size: string }[] = [
  { shape: 'sphere', name: 'Circle', size: 'Radius' },
  { shape: 'cube', name: 'Square', size: 'Side' },
  { shape: 'cone', name: 'Cone', size: 'Length' },
  { shape: 'line', name: 'Line', size: 'Length' },
]

const TONES: { tone: AreaTone; name: string; hint: string }[] = [
  { tone: 'harm', name: 'Harmful', hint: 'Fire, acid, a breath weapon' },
  { tone: 'block', name: 'Blocks sight', hint: 'Darkness, fog, smoke' },
  { tone: 'help', name: 'Helpful', hint: 'A healing circle, sanctuary' },
]

/**
 * The DM's Add an area: a shape for a dragon's breath, a fog bank or a pit, then where it goes on
 * the map. Players see it unless it's hidden; click it on the map to take it off.
 */
export function AreaDialog({ onPlace, onCancel }: { onPlace: (draft: AreaDraft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<AreaDraft>({ shape: 'sphere', sizeFt: 20, label: '', tone: 'harm', hidden: false })
  const sizeWord = SHAPES.find((s) => s.shape === draft.shape)?.size ?? 'Size'
  return (
    <section className={styles.dialog} role="dialog" aria-labelledby="area-title">
      <h2 id="area-title" className={styles.dialogTitle}>
        Add an area
      </h2>
      <div className={own.row} role="group" aria-label="Shape">
        {SHAPES.map((s) => (
          <button
            key={s.shape}
            type="button"
            className={cx(own.choice, draft.shape === s.shape && own.chosen)}
            aria-pressed={draft.shape === s.shape}
            onClick={() => setDraft({ ...draft, shape: s.shape })}
          >
            {s.name}
          </button>
        ))}
      </div>
      <label className={own.field}>
        <span>{sizeWord} in feet</span>
        <input
          type="number"
          min={5}
          max={500}
          step={5}
          value={draft.sizeFt}
          onChange={(event) =>
            setDraft({ ...draft, sizeFt: Math.max(5, Math.min(500, Number(event.target.value) || 5)) })
          }
        />
      </label>
      <label className={own.field}>
        <span>Name on the map</span>
        <input
          type="text"
          maxLength={60}
          placeholder="Dragon's breath"
          value={draft.label}
          onChange={(event) => setDraft({ ...draft, label: event.target.value })}
        />
      </label>
      <div className={own.row} role="group" aria-label="How it looks">
        {TONES.map((t) => (
          <button
            key={t.tone}
            type="button"
            title={t.hint}
            className={cx(own.choice, own[t.tone], draft.tone === t.tone && own.chosen)}
            aria-pressed={draft.tone === t.tone}
            onClick={() => setDraft({ ...draft, tone: t.tone })}
          >
            {t.name}
          </button>
        ))}
      </div>
      <label className={own.check}>
        <input
          type="checkbox"
          checked={draft.hidden}
          onChange={(event) => setDraft({ ...draft, hidden: event.target.checked })}
        />
        Hide it from the players for now
      </label>
      <p className={styles.hint}>
        Next, click on the map where it goes. Click an area on the map later to take it off.
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.primary} onClick={() => onPlace(draft)}>
          Put it on the map
        </button>
      </div>
    </section>
  )
}
