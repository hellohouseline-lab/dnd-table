import { useEffect, useState } from 'react'
import { fileUrl } from '../live/files.ts'
import { cx } from './cx.ts'
import styles from './StoredImage.module.css'

type StoredImageProps = {
  path: string | null
  alt: string
  className?: string
  /** Shown while loading, or if the picture can't be had. */
  fallback?: string
}

/** A picture from the private art bucket, kept in the browser after the first download. */
export function StoredImage({ path, alt, className, fallback }: StoredImageProps) {
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!path) return
    let live = true
    let tries = 0
    // Try again a few times if the picture couldn't be had (it may only just have gone on stage).
    const load = () =>
      fileUrl('art', path).then((url) => {
        if (!live) return
        setLoaded({ path, url })
        if (!url && ++tries < 5) setTimeout(load, 1500)
      })
    void load()
    return () => {
      live = false
    }
  }, [path])

  const url = loaded && loaded.path === path ? loaded.url : null
  if (!url) {
    return (
      <span className={cx(styles.empty, className)} role="img" aria-label={alt}>
        {fallback}
      </span>
    )
  }
  return <img className={cx(styles.image, className)} src={url} alt={alt} draggable={false} />
}
