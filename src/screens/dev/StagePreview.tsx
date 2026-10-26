// Local development only: the stage with made-up people (#/dev/stage). Uploads stay in this browser
// tab and nothing is saved; sound plays here only.

import type { User } from '@supabase/supabase-js'
import { useCallback, useState } from 'react'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import { useTableAudio } from '../../audio/useTableAudio.ts'
import { nameFromFile, type Asset } from '../../live/library.ts'
import { emptyStage, type Stage, type StagePatch } from '../../live/stage.ts'
import type { LibraryControls } from '../../live/useStage.ts'
import { StageView, type LibraryActions } from '../stage/StageView.tsx'
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
      />
    </AuthContext.Provider>
  )
}
