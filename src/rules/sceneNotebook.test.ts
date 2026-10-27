import { describe, expect, it } from 'vitest'
import {
  fillFromScene,
  type KeyItemLine,
  type NotebookContext,
  type SceneForNotebook,
  type Step,
} from './sceneNotebook.ts'

const inn: SceneForNotebook = {
  id: 'inn',
  title: 'The Gull and Anchor',
  place: 'The village inn',
  reminders: 'Goal: The party learns about the bell and suspects the chapel.\nEnds when: They climb to the chapel.',
  rolls: [{ id: 'r', key: 'skill:perception', dc: 13, outcomeShown: true, who: [], note: 'find the trail' }],
  choices: [{ id: 'c', text: 'Follow the pearls', sceneId: 'path' }],
  things: [{ id: 't', kind: 'item', dmItemId: 'key' }],
  fight: null,
}
const path: SceneForNotebook = {
  ...inn,
  id: 'path',
  title: 'The Cliff Path',
  place: '',
  reminders: '',
  rolls: [],
  choices: [],
  things: [],
  fight: { monsters: [{ index: 'sahuagin', count: 2 }], mapId: null },
}

let n = 0
const ctx: NotebookContext = {
  chapterTitle: 'Chapter 1: The village',
  chapterReminders: '',
  sceneTitle: (id) => (id === 'path' ? 'The Cliff Path' : undefined),
  item: (id) => (id === 'key' ? { name: 'Chapel key', key: true } : undefined),
  monsterName: (index) => (index === 'sahuagin' ? 'Sahuagin' : index),
  peopleNames: ['Old Tobin', 'Marra'],
  keyItems: ['Chapel key', 'Bell rope'],
  newId: () => `id${n++}`,
}
const empty = { whereWeAre: 'old', nextSteps: [] as Step[], keyItems: [] as KeyItemLine[] }

describe('fillFromScene', () => {
  it('writes where we are and a short checklist', () => {
    const filled = fillFromScene(empty, inn, ctx)
    expect(filled.whereWeAre).toBe(
      'The Gull and Anchor (The village inn)\nChapter 1: The village\nGoal: The party learns about the bell and suspects the chapel.',
    )
    expect(filled.nextSteps.map((s) => s.text)).toEqual([
      'Meet Old Tobin and Marra',
      'Perception DC 13: find the trail',
      'Key item: Chapel key',
      'Follow the pearls → The Cliff Path',
      'Ends when: They climb to the chapel.',
    ])
    expect(filled.keyItems.map((k) => k.name)).toEqual(['Chapel key', 'Bell rope'])
  })

  it('keeps the DM’s own steps and what’s ticked, and drops the last scene’s steps', () => {
    const own = { id: 'mine', text: 'Ask about the storm', done: false }
    const first = fillFromScene({ ...empty, nextSteps: [own] }, inn, ctx)
    const ticked = { ...first, nextSteps: first.nextSteps.map((s) => ({ ...s, done: s.text.startsWith('Meet') })) }
    const again = fillFromScene(ticked, inn, ctx)
    expect(again.nextSteps.find((s) => s.text.startsWith('Meet'))?.done).toBe(true)
    expect(again.nextSteps.at(-1)).toEqual(own)

    const next = fillFromScene(again, path, { ...ctx, peopleNames: [], chapterReminders: inn.reminders })
    expect(next.nextSteps.map((s) => s.text)).toEqual([
      'Fight: 2 Sahuagin',
      'Ends when: They climb to the chapel.',
      'Ask about the storm',
    ])
    expect(next.whereWeAre).toContain('Goal: The party learns')
  })

  it('leaves off a key item the DM took off, unless this scene hands it out', () => {
    const kept = { ...empty, keyItems: [{ id: 'k', name: 'Bell rope', holder: 'Ana' }] }
    expect(fillFromScene(kept, path, ctx).keyItems.map((k) => k.name)).toEqual(['Bell rope'])
    expect(fillFromScene(kept, inn, ctx).keyItems).toEqual([
      { id: 'k', name: 'Bell rope', holder: 'Ana' },
      expect.objectContaining({ name: 'Chapel key', holder: '' }),
    ])
  })
})
