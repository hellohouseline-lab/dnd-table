import { useState } from 'react'
import { cx } from '../components/cx.ts'
import { Icon } from '../components/Icon.tsx'
import type { TableAudio } from './useTableAudio.ts'
import styles from './SoundControls.module.css'

/**
 * "Now playing" from design 02, with this listener's own volume. Browsers only play sound after a
 * click on the page, so until then it asks for one.
 */
export function NowPlaying({ audio, className }: { audio: TableAudio; className?: string }) {
  const [open, setOpen] = useState(false)
  if (!audio.owner) {
    return (
      <div className={cx(styles.chip, className)} title="Another tab in this browser is playing the table's sound">
        <Icon name="volume" size={16} />
        <span>Sound plays in your other tab</span>
      </div>
    )
  }
  return (
    <div className={cx(styles.wrap, className)}>
      {audio.locked ? (
        <button type="button" className={cx(styles.chip, styles.locked)}>
          <Icon name="volume" size={16} />
          <span>Click here to turn the table&rsquo;s sound on</span>
        </button>
      ) : (
        <div className={styles.chip}>
          <Icon name="music" size={16} />
          <span>{audio.nowPlaying ? `Now playing: ${audio.nowPlaying.name}` : 'No music playing'}</span>
          <button
            type="button"
            className={styles.volumeButton}
            aria-label="Your volume"
            aria-expanded={open}
            title="Your own volume: it doesn't change anyone else's"
            onClick={() => setOpen(!open)}
          >
            <Icon name="volume" size={16} />
          </button>
        </div>
      )}
      {open && !audio.locked && (
        <label className={styles.volume}>
          <span>Your volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audio.volume}
            onChange={(event) => audio.setVolume(Number(event.target.value))}
          />
          <span className={styles.percent}>{Math.round(audio.volume * 100)}%</span>
        </label>
      )}
    </div>
  )
}
