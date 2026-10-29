import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { sampleFight } from '../screens/dev/previewFight.ts'
import { sampleCharacters, sampleMembers } from '../screens/dev/sampleData.ts'
import { cameraTurn, fightRows } from '../screens/fight/fightRows.ts'
import { CameraColumn } from '../screens/table/TableView.tsx'
import { CallContext, type TableCall } from './callContext.ts'
import { CameraCheck } from './CameraCheck.tsx'

const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

function fakeCall(changes: Partial<TableCall> = {}): TableCall {
  return {
    campaignId: 'preview',
    userId: 'p1',
    cameraKey: 'abcdef0123456789abcdef01',
    joined: false,
    camera: false,
    mic: false,
    devices: { camera: '', microphone: '' },
    owner: false,
    hearing: false,
    needsClick: false,
    status: 'off',
    problem: null,
    calls: new Map(),
    volumeOf: () => 1,
    setVolume: noop,
    join: async () => undefined,
    leave: noop,
    setCamera: noop,
    setMic: noop,
    setDevices: noop,
    setMicLevel: noop,
    renewCameraKey: async () => undefined,
    ...changes,
  }
}

const withCall = (call: TableCall, children: ReactNode) =>
  renderToStaticMarkup(<CallContext.Provider value={call}>{children}</CallContext.Provider>)

const column = (call: TableCall, online = new Set(['dm', 'p1'])) =>
  withCall(call, <CameraColumn members={sampleMembers} characters={sampleCharacters} online={online} myId="p1" />)

describe('the camera column in a call', () => {
  it('offers to join from your own tile, and says who is not in the call', () => {
    const html = text(column(fakeCall()))
    expect(html).toContain('Join voice and camera')
    expect(html).toMatch(/Not in the call Matt/)
    expect(html).toMatch(/Not here yet Elowen/)
  })

  it('shows someone in the call with their camera, without sound in a tab that does not play the call', () => {
    const html = column(fakeCall({ calls: new Map([['dm', { camera: true, mic: true }]]) }))
    const src = /<iframe[^>]*src="([^"]+)"/.exec(html)?.[1].replaceAll('&amp;', '&') ?? ''
    expect(src).toContain('view=dndpreviewdm')
    expect(src).toContain('password=abcdef0123456789abcdef01')
    expect(src).toContain('&noaudio')
    expect(text(html)).toContain('Connecting…')
    expect(html).not.toContain('voice, on your screen')
  })

  it('gives each voice its own volume where the call plays, and shows a camera that is off', () => {
    const html = column(
      fakeCall({ hearing: true, owner: true, calls: new Map([['dm', { camera: false, mic: false }]]) }),
    )
    expect(html).not.toContain('noaudio')
    expect(html).toContain('aria-label="Matt’s voice, on your screen"')
    expect(text(html)).toContain('100%')
    expect(text(html)).toContain('Camera off')
    expect(html).toContain('aria-label="Muted"')
  })

  it('gives you mute, camera and leave buttons once you have joined, and shows when you are muted', () => {
    const html = column(fakeCall({ joined: true, camera: true, mic: false, status: 'live', owner: true }))
    expect(html).toContain('aria-label="Unmute (M)"')
    expect(html).toContain('aria-label="Turn your camera off"')
    expect(html).toContain('aria-label="Leave the call"')
    expect(html).toContain('aria-label="Muted"')
  })

  it('lets you turn your own microphone up to double for everyone, once you have joined', () => {
    expect(column(fakeCall())).not.toContain('Your microphone, for everyone')
    const html = column(
      fakeCall({ joined: true, status: 'live', owner: true, devices: { camera: '', microphone: '', micLevel: 150 } }),
    )
    expect(html).toContain('aria-label="Your microphone, for everyone"')
    expect(html).toContain('max="200"')
    expect(text(html)).toContain('150%')
  })

  it('asks for a click before voices play', () => {
    expect(text(column(fakeCall({ joined: true, status: 'live', owner: true, needsClick: true })))).toContain(
      'Click anywhere to hear everyone',
    )
  })
})

describe('the camera column in a fight', () => {
  const rows = fightRows(sampleFight(sampleCharacters), sampleCharacters, 'player')
  const turn = cameraTurn(rows, 'dm')

  it('follows the turn order, with the DM last for the monsters', () => {
    expect(turn).toEqual({ order: ['p1', 'p2', 'dm'], acting: 'p1', next: 'dm' })
  })

  it('glows on whoever is acting and says who is next', () => {
    const html = withCall(
      fakeCall(),
      <CameraColumn
        members={sampleMembers}
        characters={sampleCharacters}
        online={new Set()}
        myId="p1"
        badges={{ p1: '18' }}
        turn={turn}
      />,
    )
    const names = [...text(html).matchAll(/(Thorin Ironfist|Elowen|Matt) /g)].map((m) => m[1])
    expect(names.filter((n, i) => names.indexOf(n) === i)).toEqual(['Thorin Ironfist', 'Elowen', 'Matt'])
    expect(text(html)).toContain('Sam · acting now')
    expect(text(html)).toContain('Dungeon Master · monsters · next')
    expect(html).toMatch(/>DM</)
  })
})

describe('the camera check on the Join screen', () => {
  it('lets you check your camera and join', () => {
    const html = text(withCall(fakeCall(), <CameraCheck />))
    expect(html).toContain('Check my camera')
    expect(html).toContain('Voice and camera Not joined yet')
    expect(html).toContain('Join voice and camera')
    expect(html).not.toContain('Make new camera links')
  })

  it('shows you are connected, with mute, camera and leave, and gives the DM new camera links', () => {
    const html = text(
      withCall(fakeCall({ joined: true, camera: true, mic: true, owner: true, status: 'live' }), <CameraCheck isDm />),
    )
    expect(html).toContain('Voice and camera Connected')
    expect(html).toMatch(/Mute Camera off Leave the call/)
    expect(html).toContain('Press M on any screen to mute or unmute.')
    expect(html).toContain('Make new camera links')
  })

  it('says why the camera would not start', () => {
    const html = text(withCall(fakeCall({ problem: 'Another app is using your camera.' }), <CameraCheck />))
    expect(html).toContain('Another app is using your camera.')
  })
})
