// Local development only: a story kept in the page for the DM screen preview.

import { useMemo, useState } from 'react'
import { BLANK_NPC, type Npc, type NpcControls } from '../../live/npcs.ts'
import { sortStory, type Chapter, type Scene, type Story, type StoryControls } from '../../live/story.ts'

const scene = (id: string, chapterId: string, position: number, fields: Partial<Scene>): Scene => ({
  id,
  chapterId,
  title: '',
  place: '',
  readAloud: '',
  reminders: '',
  imageId: null,
  musicId: null,
  ambience: {},
  position,
  rolls: [],
  choices: [],
  things: [],
  fight: null,
  people: [],
  ...fields,
})

function sampleStory(): Story {
  return {
    chapters: [{ id: 'ch1', title: 'Chapter 1: The Ember Road', position: 0 }],
    scenes: [
      scene('sc1', 'ch1', 0, {
        title: 'Arrive at the tavern',
        place: 'The Rusty Flagon, Millbrook',
        readAloud:
          'Rain drums on the shutters. Inside the Rusty Flagon, smoke curls from a hearth big enough to roast an ox, and every head turns as you shake the water from your cloaks.',
        reminders:
          'Brenna the innkeeper knows the merchant left for the old mill. A hooded figure in the corner is watching.',
        rolls: [
          {
            id: 'r1',
            key: 'skill:perception',
            dc: 13,
            dcShown: false,
            outcomeShown: false,
            who: [],
            note: 'to spot the hooded figure',
          },
        ],
        choices: [{ id: 'c1', text: 'they take the mill road', sceneId: 'sc2' }],
        things: [{ id: 't1', kind: 'box', container: 'body', richness: 'ordinary' }],
        people: ['npc-brenna'],
      }),
      scene('sc2', 'ch1', 1, {
        title: 'The mill road',
        place: 'North of Millbrook',
        readAloud: 'The road narrows between black pines. Somewhere ahead, a wheel creaks in the wind.',
        reminders: 'Goblin tracks in the mud (Survival 12). The bridge is rotten.',
        fight: { monsters: [{ index: 'goblin', count: 3 }], mapId: null },
      }),
    ],
  }
}

/** The story in the preview: changes stay on the page. */
export function usePreviewStory(): StoryControls {
  const [story, setStory] = useState<Story>(sampleStory)
  return useMemo<StoryControls>(
    () => ({
      story,
      status: 'ready',
      error: null,
      addChapter: async (title) => {
        const chapter: Chapter = { id: crypto.randomUUID(), title, position: story.chapters.length }
        setStory((now) => sortStory({ ...now, chapters: [...now.chapters, chapter] }))
        return chapter
      },
      renameChapter: (id, title) =>
        setStory((now) => ({ ...now, chapters: now.chapters.map((c) => (c.id === id ? { ...c, title } : c)) })),
      removeChapter: async (id) =>
        setStory((now) => ({
          chapters: now.chapters.filter((c) => c.id !== id),
          scenes: now.scenes.filter((s) => s.chapterId !== id),
        })),
      addScene: async (chapterId, title) => {
        const made = scene(crypto.randomUUID(), chapterId, story.scenes.length, { title })
        setStory((now) => sortStory({ ...now, scenes: [...now.scenes, made] }))
        return made
      },
      changeScene: (id, patch) =>
        setStory((now) => ({ ...now, scenes: now.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
      removeScene: async (id) => setStory((now) => ({ ...now, scenes: now.scenes.filter((s) => s.id !== id) })),
      moveScene: (id, by) =>
        setStory((now) => {
          const one = now.scenes.find((s) => s.id === id)
          if (!one) return now
          const siblings = now.scenes.filter((s) => s.chapterId === one.chapterId)
          const other = siblings[siblings.findIndex((s) => s.id === id) + by]
          if (!other) return now
          return sortStory({
            ...now,
            scenes: now.scenes.map((s) =>
              s.id === one.id
                ? { ...s, position: other.position }
                : s.id === other.id
                  ? { ...s, position: one.position }
                  : s,
            ),
          })
        }),
    }),
    [story],
  )
}

/** People in the preview: Brenna the innkeeper, and whoever you make. */
export function usePreviewNpcs(): NpcControls {
  const [npcs, setNpcs] = useState<Npc[]>([
    {
      ...BLANK_NPC,
      id: 'npc-brenna',
      name: 'Brenna',
      role: 'Innkeeper',
      place: 'The Rusty Flagon',
      voice: 'Warm and loud, calls everyone “love”.',
      wants: 'Her son home safe from the mine.',
      knows: 'The merchant left for the old mill two nights ago.',
      secrets: 'She owes the goblins money.',
      attitude: 'warm',
    },
  ])
  return useMemo<NpcControls>(
    () => ({
      npcs,
      status: 'ready',
      error: null,
      save: async (npc) => {
        const saved = npc.id ? npc : { ...npc, id: crypto.randomUUID() }
        setNpcs((now) => [...now.filter((n) => n.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)))
        return saved
      },
      remove: async (id) => setNpcs((now) => now.filter((n) => n.id !== id)),
    }),
    [npcs],
  )
}
