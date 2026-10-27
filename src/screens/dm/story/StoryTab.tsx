import { useState } from 'react'
import { cx } from '../../../components/cx.ts'
import { StoredImage } from '../../../components/StoredImage.tsx'
import type { Asset } from '../../../live/library.ts'
import type { Scene, StoryControls } from '../../../live/story.ts'
import { ScenePlans, type SceneActions, type SceneData } from './ScenePlans.tsx'
import styles from './StoryTab.module.css'

type StoryTabProps = {
  story: StoryControls
  /** The scene the party is in now. */
  currentSceneId: string | null
  /** Puts a scene on: its picture, music and name on stage, and marks it Where we are. */
  onGoHere: (scene: Scene) => void
  /** The read-aloud on stage now ('' when none), and showing or hiding it. */
  readAloudOnStage: string
  onShowReadAloud: (text: string) => void
  /** Pictures, music and ambience from the library, to pick for a scene. */
  library: Asset[]
  /** What a scene's planned parts point at, and what their buttons do. */
  data: Omit<SceneData, 'scenes'>
  actions: Omit<SceneActions, 'onOpenScene'>
}

/**
 * The Story tab on Screen 1 (S1a): chapters and their scenes on the left, Where we are marked; the
 * scene on the right with its read-aloud on parchment, reminders, picture, music and ambience,
 * and Go here, which puts it all on at once.
 */
export function StoryTab({
  story,
  currentSceneId,
  onGoHere,
  readAloudOnStage,
  onShowReadAloud,
  library,
  data,
  actions,
}: StoryTabProps) {
  const { chapters, scenes } = story.story
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    scenes.find((s) => s.id === selectedId) ?? scenes.find((s) => s.id === currentSceneId) ?? scenes[0] ?? null

  async function start() {
    const chapter = await story.addChapter('Chapter 1')
    if (chapter) {
      const scene = await story.addScene(chapter.id, 'The first scene')
      if (scene) setSelectedId(scene.id)
    }
  }

  if (story.status === 'loading') return <p className={styles.empty}>Opening your story…</p>
  if (chapters.length === 0) {
    return (
      <div className={styles.start}>
        <h2 className={styles.startTitle}>Your story</h2>
        <p className={styles.startLead}>
          Split your adventure into chapters and scenes: what to read out, what the party might miss, and the picture
          and music for each. Then <strong>Go here</strong> puts a scene on in one click.
        </p>
        <button type="button" className={styles.primary} onClick={() => void start()}>
          Start your story
        </button>
        {story.error && <p className={styles.problem}>{story.error}</p>}
      </div>
    )
  }

  return (
    <div className={styles.tab}>
      <nav className={styles.outline} aria-label="Chapters and scenes">
        {chapters.map((chapter) => (
          <section key={chapter.id} className={styles.chapter} aria-label={chapter.title || 'A chapter'}>
            <input
              className={styles.chapterTitle}
              value={chapter.title}
              placeholder="Chapter title"
              aria-label="Chapter title"
              onChange={(e) => story.renameChapter(chapter.id, e.target.value)}
            />
            <ol className={styles.scenes}>
              {scenes
                .filter((s) => s.chapterId === chapter.id)
                .map((scene) => (
                  <li key={scene.id}>
                    <button
                      type="button"
                      className={cx(styles.sceneButton, selected?.id === scene.id && styles.sceneOn)}
                      aria-current={selected?.id === scene.id}
                      onClick={() => setSelectedId(scene.id)}
                    >
                      <span className={styles.sceneName}>{scene.title || 'A scene'}</span>
                      {scene.id === currentSceneId && <span className={styles.here}>Where we are</span>}
                    </button>
                  </li>
                ))}
            </ol>
            <span className={styles.chapterButtons}>
              <button
                type="button"
                className={styles.link}
                onClick={() => void story.addScene(chapter.id, 'A new scene').then((s) => s && setSelectedId(s.id))}
              >
                New scene
              </button>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  if (window.confirm(`Remove ${chapter.title || 'this chapter'} and all its scenes?`))
                    void story.removeChapter(chapter.id)
                }}
              >
                Remove chapter
              </button>
            </span>
          </section>
        ))}
        <button
          type="button"
          className={styles.secondary}
          onClick={() => void story.addChapter(`Chapter ${chapters.length + 1}`)}
        >
          New chapter
        </button>
        {story.error && <p className={styles.problem}>{story.error}</p>}
      </nav>

      {selected ? (
        <ScenePanel
          key={selected.id}
          scene={selected}
          here={selected.id === currentSceneId}
          story={story}
          library={library}
          readAloudShown={readAloudOnStage !== '' && readAloudOnStage === selected.readAloud}
          onGoHere={() => onGoHere(selected)}
          onShowReadAloud={onShowReadAloud}
          data={{ ...data, scenes }}
          actions={{ ...actions, onOpenScene: setSelectedId }}
        />
      ) : (
        <p className={styles.empty}>No scenes in this chapter yet. Press New scene.</p>
      )}
    </div>
  )
}

function ScenePanel({
  scene,
  here,
  story,
  library,
  readAloudShown,
  onGoHere,
  onShowReadAloud,
  data,
  actions,
}: {
  scene: Scene
  here: boolean
  story: StoryControls
  library: Asset[]
  readAloudShown: boolean
  onGoHere: () => void
  onShowReadAloud: (text: string) => void
  data: SceneData
  actions: SceneActions
}) {
  const change = (patch: Parameters<StoryControls['changeScene']>[1]) => story.changeScene(scene.id, patch)
  const art = library.filter((a) => a.kind === 'art' && a.category !== 'maps')
  const music = library.filter((a) => a.kind === 'music')
  const ambience = library.filter((a) => a.kind === 'ambience')
  const picture = art.find((a) => a.id === scene.imageId) ?? null

  return (
    <article className={styles.scene} aria-label={`Scene: ${scene.title || 'untitled'}`}>
      <header className={styles.sceneHead}>
        <div className={styles.titles}>
          <input
            className={styles.title}
            value={scene.title}
            placeholder="The scene's title"
            aria-label="Scene title"
            onChange={(e) => change({ title: e.target.value })}
          />
          <input
            className={styles.place}
            value={scene.place}
            placeholder="Where it is (the Rusty Flagon, the old mill road)"
            aria-label="Where it is"
            onChange={(e) => change({ place: e.target.value })}
          />
        </div>
        <button type="button" className={styles.goHere} onClick={onGoHere}>
          {here ? 'Go here again' : 'Go here'}
        </button>
      </header>

      <section className={styles.block} aria-label="Read aloud">
        <div className={styles.blockHead}>
          <h3 className={styles.blockTitle}>Read aloud</h3>
          <button
            type="button"
            className={styles.link}
            disabled={!scene.readAloud.trim()}
            onClick={() => onShowReadAloud(readAloudShown ? '' : scene.readAloud)}
          >
            {readAloudShown ? 'Take it off the stage' : 'Show the read-aloud'}
          </button>
        </div>
        <textarea
          className={styles.parchment}
          value={scene.readAloud}
          rows={6}
          placeholder="What you read out when they arrive. Smoke curls from the hearth…"
          aria-label="Read aloud text"
          onChange={(e) => change({ readAloud: e.target.value })}
        />
        {readAloudShown && <p className={styles.note}>Everyone can read this on the stage now.</p>}
      </section>

      <section className={styles.block} aria-label="Reminders">
        <h3 className={styles.blockTitle}>Reminders (only you see these)</h3>
        <textarea
          className={styles.reminders}
          value={scene.reminders}
          rows={5}
          placeholder="Where they can go next, what they might miss, what's true but unsaid."
          aria-label="Reminders"
          onChange={(e) => change({ reminders: e.target.value })}
        />
      </section>

      <ScenePlans scene={scene} onChange={change} data={data} actions={actions} />

      <section className={styles.block} aria-label="Picture and sound">
        <h3 className={styles.blockTitle}>Picture and sound</h3>
        <div className={styles.media}>
          <div className={styles.thumb}>
            {picture ? (
              <StoredImage path={picture.thumbPath ?? picture.path} alt={picture.name} />
            ) : (
              <span>No picture</span>
            )}
          </div>
          <div className={styles.pickers}>
            <label className={styles.field}>
              <span>Picture</span>
              <select value={scene.imageId ?? ''} onChange={(e) => change({ imageId: e.target.value || null })}>
                <option value="">Keep what&rsquo;s on stage</option>
                {art.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Music</span>
              <select value={scene.musicId ?? ''} onChange={(e) => change({ musicId: e.target.value || null })}>
                <option value="">Keep what&rsquo;s playing</option>
                {music.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.mood ? ` (${a.mood})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {ambience.length > 0 && (
              <fieldset className={styles.ambience}>
                <legend>Ambience</legend>
                {ambience.map((a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      checked={(scene.ambience[a.id] ?? 0) > 0}
                      onChange={(e) => {
                        const next = { ...scene.ambience }
                        if (e.target.checked) next[a.id] = 0.6
                        else delete next[a.id]
                        change({ ambience: next })
                      }}
                    />
                    {a.name}
                  </label>
                ))}
              </fieldset>
            )}
            {library.length === 0 && (
              <p className={styles.note}>Upload pictures and music on Screen 2 (the Stage) to pick them here.</p>
            )}
          </div>
        </div>
      </section>

      <footer className={styles.sceneFoot}>
        <button type="button" className={styles.link} onClick={() => story.moveScene(scene.id, -1)}>
          Move up
        </button>
        <button type="button" className={styles.link} onClick={() => story.moveScene(scene.id, 1)}>
          Move down
        </button>
        <span className={styles.grow} />
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            if (window.confirm(`Remove ${scene.title || 'this scene'}?`)) void story.removeScene(scene.id)
          }}
        >
          Remove scene
        </button>
      </footer>
    </article>
  )
}
