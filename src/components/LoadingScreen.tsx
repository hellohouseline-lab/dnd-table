import styles from './LoadingScreen.module.css'

/** A calm placeholder while sign-in or a campaign loads. */
export function LoadingScreen({ label = 'Opening the table…' }: { label?: string }) {
  return (
    <main className={styles.loading} aria-busy="true">
      <p className={styles.label}>{label}</p>
    </main>
  )
}
