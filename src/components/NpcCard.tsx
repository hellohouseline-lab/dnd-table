import type { Asset } from '../live/library.ts'
import { cx } from './cx.ts'
import styles from './NpcCard.module.css'
import { StoredImage } from './StoredImage.tsx'

type NpcCardProps = {
  name: string
  role: string
  portrait: Asset | null
  className?: string
  /** For the DM: takes them off the stage. */
  onHide?: () => void
}

/** Show an NPC: their portrait and a name card, for everyone (and the stream). */
export function NpcCard({ name, role, portrait, className, onHide }: NpcCardProps) {
  return (
    <section className={cx(styles.card, className)} aria-label={`On stage: ${name}`}>
      {portrait && (
        <div className={styles.portrait}>
          <StoredImage path={portrait.path} alt={`${name}'s portrait`} />
        </div>
      )}
      <div className={styles.plate}>
        <div className={styles.name}>{name}</div>
        {role && <div className={styles.role}>{role}</div>}
        {onHide && (
          <button type="button" className={styles.hide} onClick={onHide}>
            Hide
          </button>
        )}
      </div>
    </section>
  )
}
