import { GoldDivider } from './GoldDivider.tsx'
import styles from './PageHeader.module.css'

type PageHeaderProps = {
  /** Small gold line above the title, e.g. "Take your seat at the table". */
  eyebrow: string
  title: string
  subtitle?: string
  note?: string
}

/** The centred heading block from the Join screen: eyebrow, big title, gold rule, italic line. */
export function PageHeader({ eyebrow, title, subtitle, note }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1 className={styles.title}>{title}</h1>
      <GoldDivider />
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {note && <p className={styles.note}>{note}</p>}
    </header>
  )
}
