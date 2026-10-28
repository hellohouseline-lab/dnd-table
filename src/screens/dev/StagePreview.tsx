// Local development only: the stage with made-up people (#/dev/stage). Uploads stay in this browser
// tab and nothing is saved; sound plays here only.

import type { User } from '@supabase/supabase-js'
import { useCallback, useState } from 'react'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import { useTableAudio } from '../../audio/useTableAudio.ts'
import { nameFromFile, starterMapUrl, type Asset } from '../../live/library.ts'
import { emptyStage, type Stage, type StagePatch } from '../../live/stage.ts'
import type { LibraryControls } from '../../live/useStage.ts'
import { StageView, type LibraryActions } from '../stage/StageView.tsx'
import { sampleFight, usePreviewFight } from './previewFight.ts'
import { usePreviewTokens } from './previewTokens.ts'
import { usePreviewStory } from './previewStory.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from './sampleData.ts'

const online = new Set(['dm', 'p1'])
const signedIn: AuthState = { status: 'signedIn', user: { id: 'dm' } as User }

function previewAsset(file: File, patch: Partial<Asset>): Asset {
  const url = URL.createObjectURL(file)
  return {
    id: crypto.randomUUID(),
    campaignId: 'preview',
    kind: 'art',
    category: null,
    mood: null,
    name: nameFromFile(file.name),
    path: url,
    thumbPath: url,
    sizeBytes: file.size,
    streamSafe: true,
    credit: '',
    hotkey: null,
    createdAt: new Date().toISOString(),
    grid: { size: 70, offsetX: 0, offsetY: 0 },
    ...patch,
  }
}

export function StagePreview() {
  const [stage, setStage] = useState<Stage>(() => ({ ...emptyStage('preview'), sceneName: 'Arrive at the tavern' }))
  const [assets, setAssets] = useState<Asset[]>([])
  const change = useCallback((patch: StagePatch) => setStage((now) => ({ ...now, ...patch })), [])
  const put = useCallback(
    (asset: Asset) =>
      setAssets((now) =>
        now.some((a) => a.id === asset.id) ? now.map((a) => (a.id === asset.id ? asset : a)) : [...now, asset],
      ),
    [],
  )
  const drop = useCallback((id: string) => setAssets((now) => now.filter((a) => a.id !== id)), [])
  const library: LibraryControls = { assets, status: 'ready', error: null, put, drop }
  const audio = useTableAudio('preview', 'dm', stage, assets)
  const tokens = usePreviewTokens(stage.mapId)
  const [fightStart] = useState(() => sampleFight(sampleCharacters))
  const fight = usePreviewFight(fightStart)
  // Tonight's scenes: Go here puts the scene's name on stage and marks it Now.
  const story = usePreviewStory()
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null)

  const actions: LibraryActions = {
    uploadArt: async (file, category) => previewAsset(file, { kind: 'art', category }),
    uploadSound: async (file, details) =>
      previewAsset(file, {
        kind: details.kind,
        mood: details.kind === 'music' ? (details.mood ?? 'tavern') : null,
        hotkey: details.kind === 'effect' ? (details.hotkey ?? null) : null,
        streamSafe: details.streamSafe,
        credit: details.credit,
        thumbPath: null,
      }),
    update: async (id, patch) => ({ ...(assets.find((a) => a.id === id) as Asset), ...patch }),
    remove: async () => undefined,
    // The real thing turns the drawing into a picture first; the preview shows the drawing itself.
    // Another table's sounds: the preview makes up two, as if copied.
    otherTables: [{ id: 'other', name: 'Demo Pits' }],
    bringSounds: async () =>
      [
        { name: 'Tavern fiddle', kind: 'music' as const, mood: 'tavern' as const, hotkey: null },
        { name: 'Door creak', kind: 'effect' as const, mood: null, hotkey: 9 },
      ]
        .filter((s) => !assets.some((a) => a.kind === s.kind && a.name === s.name))
        .map((s) => ({
          ...previewAsset(new File([new Uint8Array(1)], `${s.name}.mp3`, { type: 'audio/mpeg' }), {
            kind: s.kind,
            mood: s.mood,
            hotkey: s.hotkey,
            streamSafe: true,
            thumbPath: null,
          }),
          name: s.name,
        })),
    addStarter: async (starter) => {
      const drawing = await (await fetch(starterMapUrl(starter))).blob()
      const file = new File([drawing], starter.file.split('/').pop() ?? starter.name, { type: drawing.type })
      return { ...previewAsset(file, { kind: 'art', category: starter.category }), name: starter.name }
    },
  }

  return (
    <AuthContext.Provider value={signedIn}>
      <StageView
        campaign={sampleCampaign}
        me={sampleMembers[0]}
        members={sampleMembers}
        characters={sampleCharacters}
        online={online}
        stage={{ stage, change, error: null }}
        library={library}
        actions={actions}
        audio={audio}
        now={Date.now}
        map={{ tokens, fight: fight.fight, pointers: { hands: [], pings: [], sendHand: () => {}, sendPing: () => {} } }}
        tonight={{
          story: story.story,
          currentSceneId,
          onGoHere: (scene) => {
            change({ sceneName: scene.title || 'A scene' })
            setCurrentSceneId(scene.id)
          },
        }}
      />
    </AuthContext.Provider>
  )
}
