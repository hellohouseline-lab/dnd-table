import { useEffect, useState } from 'react'
import { portraitUrl } from '../live/characters.ts'
import { cx } from './cx.ts'
import styles from './Portrait.module.css'

type PortraitProps = {
  path: string | null
  size?: number
  /** 'dark' for panels, 'parchment' for parchment cards. */
  tone?: 'dark' | 'parchment'
  name?: string
}

/** A character's portrait in a gold-ringed medallion, or the word "Portrait" until one is added. */
export function Portrait({ path, size = 60, tone = 'dark', name }: PortraitProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    if (path) void portraitUrl(path).then((signed) => current && setUrl(signed))
    return () => {
      current = false
    }
  }, [path])

  const shown = path ? url : null
  return (
    <div className={cx(styles.portrait, styles[tone])} style={{ width: size, height: size }}>
      {shown ? (
        <img className={styles.image} src={shown} alt={name ? `Portrait of ${name}` : 'Portrait'} />
      ) : (
        <span className={styles.placeholder} style={{ fontSize: Math.max(10, size / 6) }}>
          Portrait
        </span>
      )}
    </div>
  )
}
