// Go here: a scene's picture, music, ambience and name on stage, the notebook filled from it (where
// we are, a short checklist, the key items), and a line in the log. Shared by Screen 1's Story tab
// and Screen 2's Tonight's scenes, so both do exactly the same.

import type { Notebook } from '../../../live/notebook.ts'
import type { Npc } from '../../../live/npcs.ts'
import type { Stage, StagePatch } from '../../../live/stage.ts'
import type { Scene, Story } from '../../../live/story.ts'
import type { DmItem } from '../../../rules/catalogue.ts'
import { entryId } from '../../../rules/character.ts'
import { fillFromScene } from '../../../rules/sceneNotebook.ts'
import type { SrdMonster } from '../../../rules/srd/index.ts'

export type GoHereContext = {
  story: Story
  notebook: Notebook
  /** The DM's own items, for key items and things to hand out. */
  yours: DmItem[]
  npcs: Npc[]
  monsters: SrdMonster[] | null
  stage: Stage
  /** In a fight the battle map stays up; the scene's picture waits behind it. */
  fighting: boolean
}

/** The notebook filled from a scene: where we are, a short checklist, and the key items. */
export function notebookForScene(scene: Scene, ctx: GoHereContext): Notebook {
  const { chapters, scenes } = ctx.story
  const chapterScenes = scenes.filter((s) => s.chapterId === scene.chapterId).sort((a, b) => a.position - b.position)
  return {
    ...fillFromScene(ctx.notebook, scene, {
      chapterTitle: chapters.find((c) => c.id === scene.chapterId)?.title ?? '',
      chapterReminders: chapterScenes[0] && chapterScenes[0].id !== scene.id ? chapterScenes[0].reminders : '',
      sceneTitle: (id) => scenes.find((s) => s.id === id)?.title,
      item: (id) => ctx.yours.find((i) => i.id === id),
      monsterName: (index) => ctx.monsters?.find((m) => m.index === index)?.name ?? index,
      peopleNames: scene.people.flatMap((id) => ctx.npcs.find((n) => n.id === id)?.name ?? []),
      keyItems: ctx.yours.filter((i) => i.key).map((i) => i.name),
      newId: entryId,
    }),
    currentSceneId: scene.id,
  }
}

/** What goes on stage: the scene's name, its picture, its music (from the start), its ambience. */
export function stageForScene(scene: Scene, ctx: GoHereContext, now: number): StagePatch {
  const patch: StagePatch = { sceneName: (scene.title || 'A scene').slice(0, 80), readAloud: '' }
  if (scene.imageId) {
    patch.imageId = scene.imageId
    if (!ctx.fighting) patch.mode = 'scene'
  }
  if (scene.musicId && (scene.musicId !== ctx.stage.musicId || !ctx.stage.musicPlaying)) {
    Object.assign(patch, { musicId: scene.musicId, musicPlaying: true, musicStartedAt: now, musicPosition: 0 })
  }
  if (Object.keys(scene.ambience).length > 0) patch.ambience = scene.ambience
  return patch
}

/** The log's line: "The party is at The Bent Nail (a tavern on the square)." */
export function logForScene(scene: Scene): string {
  return `The party is at ${scene.title || 'a new scene'}${scene.place ? ` (${scene.place})` : ''}.`
}
