import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './SceneFade.module.css'

/** How long a new scene takes to fade in over the old one. */
export const SCENE_FADE_MS = 1500

type SceneFadeProps = {
  /** Changes when the scene changes (a new picture, a map going up or down): the new one fades in. */
  sceneKey: string
  /** The scene as it is now, kept live. */
  children: ReactNode
  /**
   * A still of this scene, kept to fade out under the next one. For a picture it's the picture;
   * for a battle map it's the map without its moving parts.
   */
  still: ReactNode
  className?: string
}

/**
 * Scenes fade through: when the scene changes, the old one stays put underneath while the new one
 * fades in over it, starting once its picture has loaded, so nobody sees a flash of nothing. Used on
 * the players' screens and the DM's stage preview, and built so the stream overlay can use it too.
 */
export function SceneFade({ sceneKey, children, still, className }: SceneFadeProps) {
  const [state, setState] = useState<{ key: string; still: ReactNode; under: ReactNode | null; n: number }>({
    key: sceneKey,
    still,
    under: null,
    n: 0,
  })
  // A new scene: the last one's still goes underneath for the fade.
  if (state.key !== sceneKey) setState({ key: sceneKey, still, under: state.still, n: state.n + 1 })
  const fading = state.under !== null
  const layer = useRef<HTMLDivElement>(null)

  // Start the fade once the new scene's picture has loaded (or straight away if it has none).
  useEffect(() => {
    const el = layer.current
    if (!fading || !el) return
    const start = () => {
      el.style.animationPlayState = 'running'
    }
    const loaded = () => {
      const img = el.querySelector('img')
      return img === null ? !el.querySelector('[role="img"]') : img.complete && img.naturalWidth > 0
    }
    if (loaded()) {
      start()
      return
    }
    // Load events don't bubble, but they can be caught on the way down.
    const onLoad = () => loaded() && start()
    el.addEventListener('load', onLoad, true)
    const watch = new MutationObserver(onLoad)
    watch.observe(el, { childList: true, subtree: true })
    // A picture that never comes still lets the scene change.
    const giveUp = setTimeout(start, 5000)
    return () => {
      el.removeEventListener('load', onLoad, true)
      watch.disconnect()
      clearTimeout(giveUp)
    }
  }, [fading, state.n])

  return (
    <div className={cx(styles.fade, className)}>
      {fading && (
        <div key={`under-${state.n}`} className={styles.layer} aria-hidden="true">
          {state.under}
        </div>
      )}
      <div
        key={sceneKey}
        ref={layer}
        className={cx(styles.layer, fading && styles.fresh)}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setState((s) => ({ ...s, under: null }))
        }}
      >
        {children}
      </div>
    </div>
  )
}
