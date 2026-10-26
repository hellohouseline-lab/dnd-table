import { describe, expect, it } from 'vitest'
import { musicOffset } from '../audio/musicOffset.ts'
import { nameFromFile, sizeText, soundType } from './library.ts'
import { rowToNotebook } from './notebook.ts'
import { rowToStage } from './stage.ts'

describe('the library', () => {
  it('names an upload after its file', () => {
    expect(nameFromFile('tavern_night-02.webp')).toBe('Tavern night 02')
    expect(nameFromFile('.mp3')).toBe('Untitled')
  })

  it('writes sizes in plain words', () => {
    expect(sizeText(0)).toBe('nothing yet')
    expect(sizeText(640 * 1024)).toBe('640 KB')
    expect(sizeText(12.4 * 1024 * 1024)).toBe('12.4 MB')
  })

  it('accepts MP3 and OGG sound files only', () => {
    expect(soundType(new File([], 'inn.mp3'))).toBe('audio/mpeg')
    expect(soundType(new File([], 'rain.ogg'))).toBe('audio/ogg')
    expect(soundType(new File([], 'song.wav', { type: 'audio/wav' }))).toBeNull()
  })
})

describe('the stage', () => {
  it('reads a saved stage, keeping only ambience that is turned up', () => {
    const stage = rowToStage({
      campaign_id: 'c1',
      scene_name: 'Arrive at the tavern',
      image_id: 'a1',
      music_id: 'm1',
      music_playing: true,
      music_started_at: '2026-10-26T20:00:00Z',
      music_position: 0,
      music_volume: 0.7,
      ambience: { fire: 0.5, rain: 0, crowd: 3, bad: 'loud' },
      map_id: null,
      mode: 'scene',
      players_move_tokens: true,
      read_aloud: '',
      updated_at: '2026-10-26T20:00:00Z',
    })
    expect(stage).toMatchObject({
      sceneName: 'Arrive at the tavern',
      musicStartedAt: Date.parse('2026-10-26T20:00:00Z'),
    })
    expect(stage.ambience).toEqual({ fire: 0.5, crowd: 1 })
  })

  it('plays every browser from the same moment of a looping track', () => {
    const start = 1_000_000
    expect(musicOffset({ playing: true, startedAt: start, position: 0 }, 60, start + 75_000)).toBe(15)
    expect(musicOffset({ playing: false, startedAt: start, position: 42 }, 60, start + 75_000)).toBe(42)
    expect(musicOffset({ playing: true, startedAt: start, position: 0 }, 0, start + 5_000)).toBe(0)
  })
})

describe('the notebook', () => {
  it('reads what was saved and ignores anything broken', () => {
    const notebook = rowToNotebook({
      campaign_id: 'c1',
      where_we_are: 'At the tavern',
      next_steps: [{ id: '1', text: 'Meet the innkeeper', done: true }, 'nonsense'],
      key_items: [{ id: 'k', name: 'Silver key' }],
      box_settings: {},
      current_scene_id: null,
      updated_at: '2026-10-26T20:00:00Z',
    })
    expect(notebook.nextSteps).toEqual([{ id: '1', text: 'Meet the innkeeper', done: true }])
    expect(notebook.keyItems).toEqual([{ id: 'k', name: 'Silver key', holder: '' }])
  })
})
