import { cx } from '../components/cx.ts'
import type { RolledDie } from '../rules/dice.ts'
import styles from './DiceFaces.module.css'

type DiceFacesProps = {
  dice: RolledDie[]
  /** The d20 that counts, so a natural 20 or 1 can glow. */
  natural?: number | null
  size?: 'small' | 'large'
}

/** The dice as small numbered tiles. A dropped die (advantage or disadvantage) is faded and struck out. */
export function DiceFaces({ dice, natural = null, size = 'small' }: DiceFacesProps) {
  return (
    <span className={cx(styles.faces, styles[size])}>
      {dice.map((die, i) => {
        const counts = !die.dropped && die.sides === 20 && natural !== null && die.value === natural
        return (
          <span
            key={i}
            className={cx(
              styles.die,
              die.sides === 20 && styles.d20,
              die.dropped && styles.dropped,
              counts && natural === 20 && styles.nat20,
              counts && natural === 1 && styles.nat1,
            )}
            title={`d${die.sides}${die.dropped ? ', not counted' : ''}`}
          >
            {die.value}
          </span>
        )
      })}
    </span>
  )
}
