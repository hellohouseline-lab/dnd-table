import { useEffect, useRef, useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { MOODS, type Asset, type Mood, type SoundDetails } from '../../live/library.ts'
import type { Stage, StagePatch } from '../../live/stage.ts'
import styles from './StageView.module.css'

export type SoundUpload = (file: File, details: SoundDetails) => Promise<void>

type UploadOptions = { streamSafe: boolean; credit: string }

function UploadButton({
  label,
  onFile,
  disabled,
}: {
  label: string
  onFile: (file: File) => Promise<void>
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <label className={cx(styles.uploadSmall, (busy || disabled) && styles.busy)}>
      <Icon name="upload" size={14} />
      {busy ? 'Uploading…' : label}
      <input
        ref={input}
        type="file"
        accept=".mp3,.ogg,audio/mpeg,audio/ogg"
        disabled={busy || disabled}
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          setBusy(true)
          await onFile(file)
          setBusy(false)
          if (input.current) input.current.value = ''
        }}
      />
    </label>
  )
}

/** A slider that moves on screen at once but only tells the table when it stops moving. */
function LevelSlider({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [moving, setMoving] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <input
      className={styles.slider}
      type="range"
      min={0}
      max={1}
      step={0.05}
      aria-label={label}
      value={moving ?? value}
      onChange={(event) => {
        const next = Number(event.target.value)
        setMoving(next)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          onCommit(next)
          setMoving(null)
        }, 250)
      }}
    />
  )
}

type MusicPanelProps = {
  music: Asset[]
  stage: Stage
  onChange: (patch: StagePatch) => void
  onUpload: SoundUpload
  onDelete: (asset: Asset) => void
  onToggleSafe: (asset: Asset) => void
  options: UploadOptions
  now: () => number
}

/** Music by mood from design 11: one track at a time, looping, the same moment on every screen. */
export function MusicPanel({
  music,
  stage,
  onChange,
  onUpload,
  onDelete,
  onToggleSafe,
  options,
  now,
}: MusicPanelProps) {
  const playing = music.find((m) => m.id === stage.musicId)
  const [mood, setMood] = useState<Mood>(playing?.mood ?? 'tavern')
  const tracks = music.filter((m) => m.mood === mood)

  function play(track: Asset) {
    onChange({ musicId: track.id, musicPlaying: true, musicStartedAt: now(), musicPosition: 0 })
  }

  function toggle() {
    if (!playing) return
    if (stage.musicPlaying) {
      onChange({ musicPlaying: false, musicPosition: stage.musicStartedAt ? (now() - stage.musicStartedAt) / 1000 : 0 })
    } else {
      onChange({ musicPlaying: true, musicStartedAt: now() - stage.musicPosition * 1000 })
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="music-title">
      <h2 id="music-title" className={styles.panelTitle}>
        Music
      </h2>
      <div className={styles.nowRow}>
        <button
          type="button"
          className={styles.playButton}
          disabled={!playing}
          aria-label={stage.musicPlaying ? 'Pause the music' : 'Play the music'}
          onClick={toggle}
        >
          <Icon name={stage.musicPlaying ? 'pause' : 'play'} size={18} filled />
        </button>
        <div className={styles.nowText}>
          <div className={styles.trackName}>{playing ? playing.name : 'No music on'}</div>
          <div className={styles.trackMeta}>
            {playing
              ? `${MOODS.find((m) => m.key === playing.mood)?.name} · ${playing.streamSafe ? 'stream-safe' : 'not marked stream-safe'}${stage.musicPlaying ? '' : ' · paused'}`
              : 'Pick a track below'}
          </div>
        </div>
        {playing && (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => onChange({ musicId: null, musicPlaying: false })}
          >
            Stop
          </button>
        )}
      </div>
      <LevelSlider
        label="Music volume for everyone"
        value={stage.musicVolume}
        onCommit={(musicVolume) => onChange({ musicVolume })}
      />
      <div className={styles.moods} role="tablist" aria-label="Moods">
        {MOODS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mood === m.key}
            className={cx(styles.mood, mood === m.key && styles.moodOn)}
            onClick={() => setMood(m.key)}
          >
            {m.name}
          </button>
        ))}
      </div>
      <ul className={styles.tracks}>
        {tracks.map((track) => (
          <li key={track.id} className={cx(styles.track, track.id === stage.musicId && styles.trackOn)}>
            <button
              type="button"
              className={styles.trackPlay}
              onClick={() => play(track)}
              title="Play this for everyone"
            >
              <Icon name="play" size={12} filled />
              <span>{track.name}</span>
            </button>
            <button
              type="button"
              className={cx(styles.safe, !track.streamSafe && styles.unsafe)}
              title="Click to change. Only stream-safe music should play while anyone is live."
              onClick={() => onToggleSafe(track)}
            >
              {track.streamSafe ? 'stream-safe' : 'not safe'}
            </button>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${track.name}`}
              onClick={() => onDelete(track)}
            >
              ×
            </button>
          </li>
        ))}
        {tracks.length === 0 && <li className={styles.emptyNote}>No {mood} music yet.</li>}
      </ul>
      <UploadButton
        label={`Add ${MOODS.find((m) => m.key === mood)?.name.toLowerCase()} music`}
        onFile={(file) => onUpload(file, { kind: 'music', mood, ...options })}
      />
    </section>
  )
}

type AmbiencePanelProps = {
  ambience: Asset[]
  stage: Stage
  onChange: (patch: StagePatch) => void
  onUpload: SoundUpload
  onDelete: (asset: Asset) => void
  options: UploadOptions
}

/** Ambience from design 11: loops under the music, several at once, each with its own level. */
export function AmbiencePanel({ ambience, stage, onChange, onUpload, onDelete, options }: AmbiencePanelProps) {
  function setLevel(id: string, level: number) {
    const next = { ...stage.ambience }
    if (level > 0) next[id] = level
    else delete next[id]
    onChange({ ambience: next })
  }

  return (
    <section className={styles.panel} aria-labelledby="ambience-title">
      <h2 id="ambience-title" className={styles.panelTitle}>
        Ambience
      </h2>
      <ul className={styles.levels}>
        {ambience.map((loop) => (
          <li key={loop.id} className={styles.level}>
            <span className={styles.levelName}>{loop.name}</span>
            <LevelSlider
              label={`${loop.name} level`}
              value={stage.ambience[loop.id] ?? 0}
              onCommit={(v) => setLevel(loop.id, v)}
            />
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${loop.name}`}
              onClick={() => onDelete(loop)}
            >
              ×
            </button>
          </li>
        ))}
        {ambience.length === 0 && <li className={styles.emptyNote}>No ambience yet: fire crackle, crowd, rain…</li>}
      </ul>
      <UploadButton label="Add ambience" onFile={(file) => onUpload(file, { kind: 'ambience', ...options })} />
    </section>
  )
}

type EffectsPanelProps = {
  effects: Asset[]
  onPlay: (asset: Asset) => void
  onUpload: SoundUpload
  onDelete: (asset: Asset) => void
  options: UploadOptions
}

/** The sound effects pad from design 11, on keys 1 to 9. */
export function EffectsPanel({ effects, onPlay, onUpload, onDelete, options }: EffectsPanelProps) {
  const freeKey = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((key) => !effects.some((e) => e.hotkey === key)) ?? null
  return (
    <section className={styles.panel} aria-labelledby="effects-title">
      <h2 id="effects-title" className={styles.panelTitle}>
        Sound effects
      </h2>
      <div className={styles.pad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((key) => {
          const effect = effects.find((e) => e.hotkey === key)
          return effect ? (
            <div key={key} className={styles.padSlot}>
              <button
                type="button"
                className={styles.padButton}
                onClick={() => onPlay(effect)}
                title={`Play for everyone (key ${key})`}
              >
                <span className={styles.padName}>{effect.name}</span>
                <span className={styles.padKey}>{key}</span>
              </button>
              <button
                type="button"
                className={cx(styles.remove, styles.padRemove)}
                aria-label={`Remove ${effect.name}`}
                onClick={() => onDelete(effect)}
              >
                ×
              </button>
            </div>
          ) : (
            <div key={key} className={cx(styles.padButton, styles.padEmpty)}>
              <span className={styles.padName}>Empty</span>
              <span className={styles.padKey}>{key}</span>
            </div>
          )
        })}
      </div>
      <UploadButton
        label={freeKey ? `Add a sound effect on key ${freeKey}` : 'All nine keys are taken'}
        disabled={!freeKey}
        onFile={(file) => onUpload(file, { kind: 'effect', hotkey: freeKey, ...options })}
      />
    </section>
  )
}
