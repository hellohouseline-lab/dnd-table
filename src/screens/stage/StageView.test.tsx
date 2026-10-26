import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Asset } from '../../live/library.ts'
import { emptyStage } from '../../live/stage.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from '../dev/sampleData.ts'
import { StageView } from './StageView.tsx'

const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

function asset(id: string, patch: Partial<Asset>): Asset {
  return {
    id,
    campaignId: 'preview',
    kind: 'art',
    category: null,
    mood: null,
    name: id,
    path: `preview/${id}`,
    thumbPath: null,
    sizeBytes: 1024 * 1024,
    streamSafe: true,
    credit: '',
    hotkey: null,
    createdAt: '2026-10-26T20:00:00Z',
    ...patch,
  }
}

const assets = [
  asset('Tavern', { kind: 'art', category: 'places' }),
  asset('Merry inn', { kind: 'music', mood: 'tavern' }),
  asset('Risky tune', { kind: 'music', mood: 'tavern', streamSafe: false }),
  asset('Fire crackle', { kind: 'ambience' }),
  asset('Door creak', { kind: 'effect', hotkey: 1 }),
]

function render() {
  const stage = {
    ...emptyStage('preview'),
    sceneName: 'Arrive at the tavern',
    imageId: 'Tavern',
    musicId: 'Merry inn',
    musicPlaying: true,
    musicStartedAt: 0,
  }
  return text(
    renderToStaticMarkup(
      <StageView
        campaign={sampleCampaign}
        me={sampleMembers[0]}
        members={sampleMembers}
        characters={sampleCharacters}
        online={new Set(['dm'])}
        stage={{ stage, change: noop, error: null }}
        library={{ assets, status: 'ready', error: null, put: noop, drop: noop }}
        actions={{
          uploadArt: async () => assets[0],
          uploadSound: async () => assets[1],
          update: async () => assets[0],
          remove: async () => undefined,
        }}
        now={() => 0}
      />,
    ),
  )
}

describe('the stage screen', () => {
  const html = render()

  it('shows what everyone sees and the art library', () => {
    expect(html).toMatch(/What everyone sees Tavern/)
    expect(html).toMatch(/Art library Places Moments People Maps/)
    expect(html).toContain('On stage')
  })

  it('shows the music playing, by mood, and which tracks are stream-safe', () => {
    expect(html).toMatch(/Merry inn Tavern · stream-safe/)
    expect(html).toMatch(/Risky tune not safe/)
  })

  it('shows ambience levels and the sound effects pad on keys 1 to 9', () => {
    expect(html).toContain('Fire crackle')
    expect(html).toMatch(/Door creak 1 × Empty 2/)
    expect(html).toContain('Add a sound effect on key 2')
  })

  it('keeps the later features visible but switched off', () => {
    expect(html).toContain('Switch to battle map')
    expect(html).toMatch(/Library: 5\.0 MB of the 1 GB free storage/)
  })
})
