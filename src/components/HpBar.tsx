import styles from './HpBar.module.css'

/** The red hit point bar, with temporary hit points shown as a pale extension. */
export function HpBar({ current, max, temp = 0, height = 8 }: { current: number; max: number; temp?: number; height?: number }) {
  const total = Math.max(max, current + temp, 1)
  return (
    <div className={styles.track} style={{ height, borderRadius: height / 2 }} aria-hidden="true">
      <div className={styles.fill} style={{ width: `${(current / total) * 100}%` }} />
      {temp > 0 && <div className={styles.temp} style={{ width: `${(temp / total) * 100}%` }} />}
    </div>
  )
}
