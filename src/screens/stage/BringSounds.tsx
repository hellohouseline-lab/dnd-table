import { useState } from 'react'
import styles from './BringSounds.module.css'

type BringSoundsProps = {
  /** Your other tables, by name. */
  tables: { id: string; name: string }[]
  /** Copies that table's music, ambience and effects here; resolves with how many came, or null on a problem. */
  onBring: (fromCampaignId: string) => Promise<number | null>
}

/** Sounds belong to a table: this brings another table's into this one, so each is uploaded once. */
export function BringSounds({ tables, onBring }: BringSoundsProps) {
  const [from, setFrom] = useState(tables[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  async function bring() {
    if (!from) return
    setBusy(true)
    setDone(null)
    const count = await onBring(from)
    setBusy(false)
    if (count !== null) {
      const name = tables.find((t) => t.id === from)?.name ?? 'that table'
      setDone(
        count === 0
          ? `This table already has every sound from ${name}.`
          : `Brought in ${count} sound${count === 1 ? '' : 's'} from ${name}.`,
      )
    }
  }

  return (
    <section className={styles.panel} aria-label="Sounds from your other tables">
      <span className={styles.lead}>Sounds from another of your tables:</span>
      <select aria-label="Which table" value={from} onChange={(event) => setFrom(event.target.value)}>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="button" className={styles.bring} disabled={busy || !from} onClick={() => void bring()}>
        {busy ? 'Bringing them in…' : 'Bring them in'}
      </button>
      {done && (
        <p className={styles.done} role="status">
          {done}
        </p>
      )}
    </section>
  )
}
