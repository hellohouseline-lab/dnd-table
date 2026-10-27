import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { Scene, Story } from '../../live/story.ts'
import styles from './TonightsScenes.module.css'

type TonightsScenesProps = {
  story: Story
  /** The scene the party is in now (from the notebook), marked "Now". */
  currentSceneId: string | null
  /** Go here: the same as on Screen 1's Story tab. */
  onGoHere: (scene: Scene) => void
  className?: string
}

/**
 * Tonight's scenes on Screen 2: the chapter you're in, each scene with Go here, so the DM can move
 * the story on from the stage. The chapter the party is in comes up first; any other can be picked.
 */
export function TonightsScenes({ story, currentSceneId, onGoHere, className }: TonightsScenesProps) {
  const chapters = [...story.chapters].sort((a, b) => a.position - b.position)
  const current = story.scenes.find((s) => s.id === currentSceneId) ?? null
  // Before the first Go here: the first chapter that isn't the campaign's own notes.
  const firstPlayable = chapters.find((c) => !/^campaign notes$/i.test(c.title)) ?? chapters[0]
  const [picked, setPicked] = useState<string | null>(null)
  const chapterId = picked ?? current?.chapterId ?? firstPlayable?.id ?? null
  const scenes = story.scenes.filter((s) => s.chapterId === chapterId).sort((a, b) => a.position - b.position)

  return (
    <section className={cx(styles.panel, className)} aria-labelledby="tonight-title">
      <h2 id="tonight-title" className={styles.title}>
        Tonight&rsquo;s scenes
      </h2>
      {chapters.length === 0 ? (
        <p className={styles.hint}>
          Your scenes show here once you add them on Screen 1&rsquo;s Story tab. Go here puts up a scene&rsquo;s picture
          and music and fills your notebook.
        </p>
      ) : (
        <>
          {chapters.length > 1 && (
            <select
              className={styles.chapter}
              aria-label="Chapter"
              value={chapterId ?? ''}
              onChange={(event) => setPicked(event.target.value)}
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          <ol className={styles.scenes}>
            {scenes.map((scene) => {
              const now = scene.id === currentSceneId
              return (
                <li key={scene.id} className={cx(styles.scene, now && styles.now)}>
                  <span className={styles.name}>
                    {scene.title || 'A scene'}
                    {now && <span className={styles.badge}>Now</span>}
                  </span>
                  <button
                    type="button"
                    className={styles.go}
                    title="Its picture and music go up for everyone, and your notebook fills in"
                    aria-label={`Go here: ${scene.title || 'a scene'}`}
                    onClick={() => onGoHere(scene)}
                  >
                    Go here
                  </button>
                </li>
              )
            })}
            {scenes.length === 0 && <li className={styles.hint}>No scenes in this chapter yet.</li>}
          </ol>
        </>
      )}
    </section>
  )
}
