import { useEffect, useState, type ComponentProps } from 'react'
import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { Notice } from '../../components/Notice.tsx'
import { StoredImage } from '../../components/StoredImage.tsx'
import { ReadAloud } from '../../components/ReadAloud.tsx'
import { NpcCard } from '../../components/NpcCard.tsx'
import { NowPlaying } from '../../audio/SoundControls.tsx'
import type { TableAudio } from '../../audio/useTableAudio.ts'
import type { Campaign, Member } from '../../live/campaigns.ts'
import { messageFor } from '../../live/errors.ts'
import {
  sizeText,
  type ArtCategory,
  type Asset,
  type AssetPatch,
  type SoundDetails,
  type StarterArt,
} from '../../live/library.ts'
import type { LibraryControls, StageControls } from '../../live/useStage.ts'
import type { Character } from '../../rules/character.ts'
import { cameraTurn, fightRows } from '../fight/fightRows.ts'
import { CameraColumn } from '../table/TableView.tsx'
import { ArtLibrary } from './ArtLibrary.tsx'
import { MapStage } from './MapStage.tsx'
import { AmbiencePanel, EffectsPanel, MusicPanel } from './SoundPanels.tsx'
import styles from './StageView.module.css'

const FREE_STORAGE_BYTES = 1024 * 1024 * 1024

const LATER: { label: string; title: string }[] = [
  { label: 'Reveal hidden areas', title: 'Arrives in Phase 2' },
  { label: 'Chapter title card', title: 'Arrives in Phase 2' },
]

export type LibraryActions = {
  uploadArt: (file: File, category: ArtCategory) => Promise<Asset>
  uploadSound: (file: File, details: SoundDetails) => Promise<Asset>
  update: (id: string, patch: AssetPatch) => Promise<Asset>
  remove: (asset: Asset) => Promise<void>
  /** Adds one of the maps that come with the table to the library. */
  addStarter?: (starter: StarterArt) => Promise<Asset>
}

/** Sounds are marked stream-safe when uploaded; the table no longer asks about licences or credits. */
const UPLOAD_OPTIONS = { streamSafe: true, credit: '' }

type StageViewProps = {
  campaign: Campaign
  me: Member
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  stage: StageControls
  library: LibraryControls
  actions: LibraryActions
  /** The table's sound in this tab (left out in the previews). */
  audio?: TableAudio
  /** The server's time in milliseconds, for starting music in step. */
  now: () => number
  /** The battle map's tokens, the fight (for monster tokens) and everyone's hands and pings. */
  map: Omit<ComponentProps<typeof MapStage>, 'map' | 'characters' | 'userId' | 'playersMove' | 'onGrid'>
  /** In a fight: back to the Battle screen. */
  onBattle?: () => void
}

/** Screen 11, the stage: what everyone sees and hears, the art library, music, ambience and effects. */
export function StageView({
  campaign,
  me,
  members,
  characters,
  online,
  stage: controls,
  library,
  actions,
  audio,
  now,
  map: mapProps,
  onBattle,
}: StageViewProps) {
  const { stage, change } = controls
  const [problem, setProblem] = useState<string | null>(null)
  const [sceneName, setSceneName] = useState<string | null>(null)
  const art = library.assets.filter((a) => a.kind === 'art')
  const onStage = art.find((a) => a.id === stage.imageId) ?? null
  const battleMap = art.find((a) => a.id === stage.mapId) ?? null
  const showingMap = stage.mode === 'map' && battleMap !== null
  const effects = library.assets.filter((a) => a.kind === 'effect')
  const used = library.assets.reduce((sum, a) => sum + a.sizeBytes, 0)

  // Keys 1 to 9 fire the sound effects, unless you're typing.
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select') || event.metaKey || event.ctrlKey || event.altKey) return
      const effect = effects.find((e) => String(e.hotkey) === event.key)
      if (effect) audio?.playEffect(effect)
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [effects, audio])

  async function attempt<T>(work: () => Promise<T>): Promise<T | null> {
    setProblem(null)
    try {
      return await work()
    } catch (caught) {
      setProblem(messageFor(caught))
      return null
    }
  }

  async function uploadArt(files: File[], category: ArtCategory) {
    for (const file of files) {
      const added = await attempt(() => actions.uploadArt(file, category))
      if (added) library.put(added)
    }
  }

  async function uploadSound(file: File, details: SoundDetails) {
    const added = await attempt(() => actions.uploadSound(file, details))
    if (added) library.put(added)
  }

  async function remove(asset: Asset) {
    if (!window.confirm(`Remove “${asset.name}” from the library? This can’t be undone.`)) return
    if (asset.id === stage.imageId) change({ imageId: null })
    if (asset.id === stage.musicId) change({ musicId: null, musicPlaying: false })
    if (asset.id in stage.ambience) {
      const next = { ...stage.ambience }
      delete next[asset.id]
      change({ ambience: next })
    }
    const done = await attempt(() => actions.remove(asset))
    if (done !== null) library.drop(asset.id)
  }

  async function updateAsset(asset: Asset, patch: AssetPatch) {
    library.put({ ...asset, ...patch })
    const updated = await attempt(() => actions.update(asset.id, patch))
    if (updated) library.put(updated)
  }

  function saveSceneName() {
    if (sceneName !== null && sceneName !== stage.sceneName) change({ sceneName: sceneName.trim() })
    setSceneName(null)
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>The Stage</h1>
        <span className={styles.live}>
          <span className={styles.liveDot} aria-hidden="true" /> Live to every player
        </span>
        <span className={styles.spacer} />
        {audio && <NowPlaying audio={audio} />}
        {onBattle && (
          <button type="button" className={styles.screenButton} onClick={onBattle}>
            Back to the battle
          </button>
        )}
        <a className={styles.screenButton} href={href(`/c/${campaign.id}/dm`)}>
          Screen 1: Story
        </a>
      </header>

      <div className={styles.body}>
        <aside className={styles.column}>
          <section className={styles.panel} aria-labelledby="scene-title">
            <h2 id="scene-title" className={styles.panelTitle}>
              Scene now
            </h2>
            <input
              className={styles.sceneInput}
              aria-label="Scene now"
              placeholder="Arrive at the tavern"
              maxLength={80}
              value={sceneName ?? stage.sceneName}
              onChange={(event) => setSceneName(event.target.value)}
              onBlur={saveSceneName}
              onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
            />
            <p className={styles.hint}>Shown in your header. Players don&rsquo;t see it.</p>
          </section>
          <section className={cx(styles.panel, styles.later)} aria-labelledby="scenes-title">
            <h2 id="scenes-title" className={styles.panelTitle}>
              Tonight&rsquo;s scenes
            </h2>
            <p className={styles.hint}>
              Scenes that bundle a picture, music and the people in them, ready to switch with one click, arrive in
              Phase 2. For now, pick a picture and music here.
            </p>
          </section>
          <p className={cx(styles.hint, styles.storage)}>
            Sounds: MP3 or OGG up to 15 MB. Storage used: {sizeText(used)} of the 1 GB free (
            {Math.round((used / FREE_STORAGE_BYTES) * 100)}%).
          </p>
        </aside>

        <div className={styles.centre}>
          <section className={styles.preview} aria-labelledby="sees-title">
            <div className={styles.previewBar}>
              <h2 id="sees-title" className={styles.panelTitle}>
                What everyone sees
              </h2>
              <span className={styles.hint}>
                {showingMap ? `Battle map: ${battleMap.name}` : onStage ? onStage.name : 'Nothing on stage'}
              </span>
            </div>
            {showingMap ? (
              <MapStage
                {...mapProps}
                map={battleMap}
                characters={characters}
                userId={me.user_id}
                playersMove={stage.playersMoveTokens}
                onGrid={(patch) => void updateAsset(battleMap, patch)}
              />
            ) : (
              <div className={styles.screenPreview}>
                {stage.npcName && (
                  <NpcCard
                    name={stage.npcName}
                    role={stage.npcRole}
                    portrait={art.find((a) => a.id === stage.npcImageId) ?? null}
                    className={styles.npc}
                    onHide={() => change({ npcName: '', npcRole: '', npcImageId: null })}
                  />
                )}
                {stage.readAloud && (
                  <ReadAloud
                    text={stage.readAloud}
                    className={styles.readAloud}
                    onClose={() => change({ readAloud: '' })}
                  />
                )}
                {onStage ? (
                  <StoredImage path={onStage.path} alt={`On stage: ${onStage.name}`} />
                ) : (
                  <div className={styles.nothing}>
                    <span className={styles.nothingTitle}>[ The table ]</span>
                    <span>Pick a picture from the library below and it appears behind everyone&rsquo;s screen.</span>
                  </div>
                )}
              </div>
            )}
          </section>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.control}
              disabled={!stage.imageId && !showingMap}
              onClick={() => change({ imageId: null, mode: 'scene' })}
            >
              Clear the stage
            </button>
            <button
              type="button"
              className={styles.control}
              disabled={!battleMap}
              title={battleMap ? undefined : 'Pick a map from Maps in the library first'}
              onClick={() => change({ mode: showingMap ? 'scene' : 'map' })}
            >
              {showingMap ? 'Back to the picture' : 'Switch to battle map'}
            </button>
            <button
              type="button"
              className={cx(styles.control, stage.playersMoveTokens && styles.controlOn)}
              aria-pressed={stage.playersMoveTokens}
              onClick={() => change({ playersMoveTokens: !stage.playersMoveTokens })}
            >
              Players move their own tokens: {stage.playersMoveTokens ? 'on' : 'off'}
            </button>
            {LATER.map((later) => (
              <button key={later.label} type="button" className={styles.control} disabled title={later.title}>
                {later.label}
              </button>
            ))}
          </div>
          {(problem || controls.error || library.error) && (
            <Notice tone="error">{problem ?? controls.error ?? library.error}</Notice>
          )}
          <ArtLibrary
            art={art}
            onStage={showingMap ? stage.mapId : stage.imageId}
            onShow={(asset) =>
              asset.category === 'maps'
                ? change({ mapId: asset.id, mode: 'map' })
                : change({ imageId: asset.id, mode: 'scene' })
            }
            onUpload={uploadArt}
            onDelete={(asset) => void remove(asset)}
            onAddStarter={async (starter) => {
              const add = actions.addStarter
              const added = add ? await attempt(() => add(starter)) : null
              if (added) library.put(added)
            }}
          />
        </div>

        <div className={styles.column}>
          <MusicPanel
            music={library.assets.filter((a) => a.kind === 'music')}
            stage={stage}
            onChange={change}
            onUpload={uploadSound}
            onDelete={(asset) => void remove(asset)}
            options={UPLOAD_OPTIONS}
            now={now}
          />
          <AmbiencePanel
            ambience={library.assets.filter((a) => a.kind === 'ambience')}
            stage={stage}
            onChange={change}
            onUpload={uploadSound}
            onDelete={(asset) => void remove(asset)}
            options={UPLOAD_OPTIONS}
          />
          <EffectsPanel
            effects={effects}
            onPlay={(asset) => audio?.playEffect(asset)}
            onUpload={uploadSound}
            onDelete={(asset) => void remove(asset)}
            options={UPLOAD_OPTIONS}
          />
        </div>
      </div>

      <CameraColumn
        className={styles.cameras}
        members={members}
        characters={characters}
        online={online}
        myId={me.user_id}
        turn={mapProps.fight ? cameraTurn(fightRows(mapProps.fight, characters, 'dm'), me.user_id) : null}
      />
    </main>
  )
}
