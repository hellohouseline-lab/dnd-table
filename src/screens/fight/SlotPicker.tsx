import type { Casting } from './useCasting.ts'
import { levelWords, slotWords } from './useCasting.ts'
import styles from './SlotPicker.module.css'

/** While a spell is being aimed: the slot it uses, and a choice of a higher one to cast it stronger. */
export function SlotPicker({ casting }: { casting: NonNullable<Casting> }) {
  if (casting.slot === 0) return null
  if (casting.slots.length <= 1) return <span className={styles.slot}>Uses a {slotWords(casting.slot)}</span>
  return (
    <label className={styles.slot}>
      Slot
      <select value={casting.slot} onChange={(event) => casting.setSlot(Number(event.target.value))}>
        {casting.slots.map((slot) => (
          <option key={slot} value={slot}>
            {levelWords(slot)}
          </option>
        ))}
      </select>
    </label>
  )
}
