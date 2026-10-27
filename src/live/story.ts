// Story mode (S1a): the DM's chapters and scenes, loaded once and saved as they're written. Only the
// DM can read or write them (supabase/migrations/20261027240000_story.sql).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  parseChoices,
  parseFight,
  parsePlannedRolls,
  parseThings,
  type Choice,
  type Fight,
  type PlannedRoll,
  type Thing,
} from '../rules/scenes.ts'
import type { Json, Tables, TablesUpdate } from './database.types.ts'
import { fromDatabaseError, messageFor, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type Chapter = { id: string; title: string; position: number }

export type Scene = {
  id: string
  chapterId: string
  title: string
  place: string
  readAloud: string
  reminders: string
  imageId: string | null
  musicId: string | null
  /** Ambience loops and their levels, 0 to 1. */
  ambience: Record<string, number>
  position: number
  /** What's planned: rolls, choices that lead on, things to hand out, and a fight. */
  rolls: PlannedRoll[]
  choices: Choice[]
  things: Thing[]
  fight: Fight | null
}

export type ScenePatch = Partial<Omit<Scene, 'id'>>

export type Story = { chapters: Chapter[]; scenes: Scene[] }

export const EMPTY_STORY: Story = { chapters: [], scenes: [] }

/** What the DM can do with the story; each change shows at once and saves a moment later. */
export type StoryControls = {
  story: Story
  status: 'loading' | 'ready' | 'error'
  error: string | null
  addChapter: (title: string) => Promise<Chapter | null>
  renameChapter: (id: string, title: string) => void
  removeChapter: (id: string) => Promise<void>
  addScene: (chapterId: string, title: string) => Promise<Scene | null>
  changeScene: (id: string, patch: ScenePatch) => void
  removeScene: (id: string) => Promise<void>
  /** Moves a scene up or down within its chapter. */
  moveScene: (id: string, by: -1 | 1) => void
}

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

function rowToChapter(row: Tables<'story_chapters'>): Chapter {
  return { id: row.id, title: row.title, position: row.position }
}

function rowToScene(row: Tables<'story_scenes'>): Scene {
  const ambience: Record<string, number> = {}
  if (row.ambience && typeof row.ambience === 'object' && !Array.isArray(row.ambience)) {
    for (const [id, level] of Object.entries(row.ambience)) {
      const value = Number(level)
      if (Number.isFinite(value) && value > 0) ambience[id] = Math.min(1, value)
    }
  }
  return {
    id: row.id,
    chapterId: row.chapter_id,
    title: row.title,
    place: row.place,
    readAloud: row.read_aloud,
    reminders: row.reminders,
    imageId: row.image_id,
    musicId: row.music_id,
    ambience,
    position: row.position,
    rolls: parsePlannedRolls(row.rolls),
    choices: parseChoices(row.choices),
    things: parseThings(row.things),
    fight: parseFight(row.fight),
  }
}

function patchToRow(patch: ScenePatch): TablesUpdate<'story_scenes'> {
  const row: TablesUpdate<'story_scenes'> = { updated_at: new Date().toISOString() }
  if (patch.chapterId !== undefined) row.chapter_id = patch.chapterId
  if (patch.title !== undefined) row.title = patch.title.slice(0, 120)
  if (patch.place !== undefined) row.place = patch.place.slice(0, 120)
  if (patch.readAloud !== undefined) row.read_aloud = patch.readAloud.slice(0, 8000)
  if (patch.reminders !== undefined) row.reminders = patch.reminders.slice(0, 8000)
  if (patch.imageId !== undefined) row.image_id = patch.imageId
  if (patch.musicId !== undefined) row.music_id = patch.musicId
  if (patch.ambience !== undefined) row.ambience = patch.ambience
  if (patch.position !== undefined) row.position = patch.position
  if (patch.rolls !== undefined) row.rolls = patch.rolls as unknown as Json
  if (patch.choices !== undefined) row.choices = patch.choices as unknown as Json
  if (patch.things !== undefined) row.things = patch.things as unknown as Json
  if (patch.fight !== undefined) row.fight = patch.fight as unknown as Json
  return row
}

/** Chapters and scenes in order. */
export function sortStory(story: Story): Story {
  return {
    chapters: [...story.chapters].sort((a, b) => a.position - b.position),
    scenes: [...story.scenes].sort((a, b) => a.position - b.position),
  }
}

/** The DM's story, kept on this screen and saved as it changes. */
export function useStory(campaignId: string): StoryControls {
  const [story, setStory] = useState<Story>(EMPTY_STORY)
  const [status, setStatus] = useState<StoryControls['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  // Text is saved a moment after the last key, one timer per scene.
  const pending = useRef(new Map<string, { patch: ScenePatch; timer: number }>())

  useEffect(() => {
    if (!supabase) return
    let live = true
    Promise.all([
      supabase.from('story_chapters').select('*').eq('campaign_id', campaignId),
      supabase.from('story_scenes').select('*').eq('campaign_id', campaignId),
    ]).then(([chapters, scenes]) => {
      if (!live) return
      if (chapters.error || scenes.error) {
        setStatus('error')
        setError(messageFor(fromDatabaseError((chapters.error ?? scenes.error)!)))
        return
      }
      setStory(sortStory({ chapters: chapters.data.map(rowToChapter), scenes: scenes.data.map(rowToScene) }))
      setStatus('ready')
    })
    return () => {
      live = false
    }
  }, [campaignId])

  // Anything not yet saved goes when the screen closes.
  useEffect(() => {
    const waiting = pending.current
    return () => {
      for (const [id, { patch, timer }] of waiting) {
        window.clearTimeout(timer)
        void db().from('story_scenes').update(patchToRow(patch)).eq('id', id)
      }
    }
  }, [])

  const run = useCallback(async (task: () => PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    try {
      const { error: problem } = await task()
      if (problem) throw fromDatabaseError(problem)
      setError(null)
    } catch (caught) {
      setError(messageFor(caught))
    }
  }, [])

  return useMemo<StoryControls>(
    () => ({
      story,
      status,
      error,
      addChapter: async (title) => {
        const position = story.chapters.reduce((top, c) => Math.max(top, c.position), -1) + 1
        const { data, error: problem } = await db()
          .from('story_chapters')
          .insert({ campaign_id: campaignId, title: title.slice(0, 120), position })
          .select('*')
          .single()
        if (problem) {
          setError(messageFor(fromDatabaseError(problem)))
          return null
        }
        const chapter = rowToChapter(data)
        setStory((now) => sortStory({ ...now, chapters: [...now.chapters, chapter] }))
        return chapter
      },
      renameChapter: (id, title) => {
        setStory((now) => ({ ...now, chapters: now.chapters.map((c) => (c.id === id ? { ...c, title } : c)) }))
        void run(() =>
          db()
            .from('story_chapters')
            .update({ title: title.slice(0, 120) })
            .eq('id', id),
        )
      },
      removeChapter: async (id) => {
        setStory((now) => ({
          chapters: now.chapters.filter((c) => c.id !== id),
          scenes: now.scenes.filter((s) => s.chapterId !== id),
        }))
        await run(() => db().from('story_chapters').delete().eq('id', id))
      },
      addScene: async (chapterId, title) => {
        const position =
          story.scenes.filter((s) => s.chapterId === chapterId).reduce((top, s) => Math.max(top, s.position), -1) + 1
        const { data, error: problem } = await db()
          .from('story_scenes')
          .insert({ campaign_id: campaignId, chapter_id: chapterId, title: title.slice(0, 120), position })
          .select('*')
          .single()
        if (problem) {
          setError(messageFor(fromDatabaseError(problem)))
          return null
        }
        const scene = rowToScene(data)
        setStory((now) => sortStory({ ...now, scenes: [...now.scenes, scene] }))
        return scene
      },
      changeScene: (id, patch) => {
        setStory((now) => ({ ...now, scenes: now.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
        const waiting = pending.current.get(id)
        if (waiting) window.clearTimeout(waiting.timer)
        const merged = { ...waiting?.patch, ...patch }
        const timer = window.setTimeout(() => {
          pending.current.delete(id)
          void run(() => db().from('story_scenes').update(patchToRow(merged)).eq('id', id))
        }, 700)
        pending.current.set(id, { patch: merged, timer })
      },
      removeScene: async (id) => {
        const waiting = pending.current.get(id)
        if (waiting) window.clearTimeout(waiting.timer)
        pending.current.delete(id)
        setStory((now) => ({ ...now, scenes: now.scenes.filter((s) => s.id !== id) }))
        await run(() => db().from('story_scenes').delete().eq('id', id))
      },
      moveScene: (id, by) => {
        const scene = story.scenes.find((s) => s.id === id)
        if (!scene) return
        const siblings = story.scenes.filter((s) => s.chapterId === scene.chapterId)
        const at = siblings.findIndex((s) => s.id === id)
        const other = siblings[at + by]
        if (!other) return
        setStory((now) =>
          sortStory({
            ...now,
            scenes: now.scenes.map((s) =>
              s.id === scene.id
                ? { ...s, position: other.position }
                : s.id === other.id
                  ? { ...s, position: scene.position }
                  : s,
            ),
          }),
        )
        void run(() => db().from('story_scenes').update({ position: other.position }).eq('id', scene.id))
        void run(() => db().from('story_scenes').update({ position: scene.position }).eq('id', other.id))
      },
    }),
    [story, status, error, campaignId, run],
  )
}

/** A story that does nothing, for tests. */
export const NO_STORY: StoryControls = {
  story: EMPTY_STORY,
  status: 'ready',
  error: null,
  addChapter: async () => null,
  renameChapter: () => {},
  removeChapter: async () => {},
  addScene: async () => null,
  changeScene: () => {},
  removeScene: async () => {},
  moveScene: () => {},
}
