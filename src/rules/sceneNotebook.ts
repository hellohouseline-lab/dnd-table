// Go here fills the DM's notebook from the scene: where the party is, a short checklist of what can
// happen here, and the campaign's key items. Steps the DM wrote stay; steps from the last scene go.

import { findAskable } from './askable.ts'
import type { Choice, Fight, PlannedRoll, Thing } from './scenes.ts'

export type Step = {
  id: string
  text: string
  done: boolean
  /** The scene it came from; none if the DM wrote it. */ scene?: string
}
export type KeyItemLine = { id: string; name: string; holder: string }

export type SceneForNotebook = {
  id: string
  title: string
  place: string
  reminders: string
  rolls: PlannedRoll[]
  choices: Choice[]
  things: Thing[]
  fight: Fight | null
}

export type NotebookContext = {
  chapterTitle: string
  /** The reminders of the chapter's first scene, where a chapter's Goal and Ends when are kept. */
  chapterReminders: string
  sceneTitle: (id: string) => string | undefined
  item: (id: string) => { name: string; key: boolean } | undefined
  monsterName: (index: string) => string
  peopleNames: string[]
  /** Every key item in the campaign. */
  keyItems: string[]
  newId: () => string
}

const STEP_LENGTH = 120

function line(reminders: string, label: RegExp): string {
  for (const l of reminders.split('\n')) {
    const found = new RegExp(`^\\s*(?:[-*]\\s+)?${label.source}\\s*:\\s*(.+)$`, 'i').exec(l)
    if (found) return found[1].trim()
  }
  return ''
}

const cut = (text: string) => (text.length > STEP_LENGTH ? `${text.slice(0, STEP_LENGTH - 1).trimEnd()}…` : text)
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** "Perception DC 13: to find the trail" */
function rollStep(roll: PlannedRoll): string {
  const name = findAskable(roll.key)?.name ?? roll.key
  return `${name} DC ${roll.dc}${roll.note ? `: ${roll.note}` : ''}`
}

/** The checklist for a scene, in the order things tend to happen. */
export function sceneSteps(scene: SceneForNotebook, ctx: NotebookContext): string[] {
  const steps: string[] = []
  if (ctx.peopleNames.length > 0) steps.push(`Meet ${ctx.peopleNames.join(', ').replace(/, ([^,]*)$/, ' and $1')}`)
  for (const roll of scene.rolls) steps.push(rollStep(roll))
  for (const thing of scene.things) {
    if (thing.kind !== 'item') continue
    const item = ctx.item(thing.dmItemId)
    if (item) steps.push(`${item.key ? 'Key item' : 'Give'}: ${item.name}`)
  }
  if (scene.fight && scene.fight.monsters.length > 0) {
    steps.push(`Fight: ${scene.fight.monsters.map((m) => `${m.count} ${ctx.monsterName(m.index)}`).join(', ')}`)
  }
  for (const choice of scene.choices) {
    const to = choice.sceneId ? ctx.sceneTitle(choice.sceneId) : undefined
    steps.push(to ? `${choice.text} → ${to}` : choice.text)
  }
  const ends = line(scene.reminders, /ends when/) || line(ctx.chapterReminders, /ends when/)
  if (ends) steps.push(`Ends when: ${ends}`)
  return steps.map(cut)
}

/** Where we are: the scene and place, its chapter, and the goal. */
export function whereWeAre(scene: SceneForNotebook, ctx: NotebookContext): string {
  const goal = line(scene.reminders, /goal/) || line(ctx.chapterReminders, /goal/)
  return [
    `${scene.title || 'A scene'}${scene.place ? ` (${scene.place})` : ''}`,
    ctx.chapterTitle,
    goal && `Goal: ${goal}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * The notebook after Go here. Where we are is rewritten; the DM's own steps stay, steps from other
 * scenes go, and going to the same scene again keeps what's ticked. Key items are filled from the
 * campaign the first time; after that only this scene's key items are added, so one the DM took off
 * stays off.
 */
export function fillFromScene<N extends { whereWeAre: string; nextSteps: Step[]; keyItems: KeyItemLine[] }>(
  notebook: N,
  scene: SceneForNotebook,
  ctx: NotebookContext,
): N {
  const own = notebook.nextSteps.filter((s) => !s.scene)
  const before = notebook.nextSteps.filter((s) => s.scene === scene.id)
  const fresh = sceneSteps(scene, ctx).map((text): Step => ({
    id: ctx.newId(),
    text,
    done: before.some((s) => s.done && s.text === text),
    scene: scene.id,
  }))

  const sceneKeys = scene.things.flatMap((t) => {
    const item = t.kind === 'item' ? ctx.item(t.dmItemId) : undefined
    return item?.key ? [item.name] : []
  })
  const wanted = notebook.keyItems.length === 0 ? [...ctx.keyItems, ...sceneKeys] : sceneKeys
  const keyItems = [...notebook.keyItems]
  for (const name of wanted) {
    if (!keyItems.some((k) => same(k.name, name))) keyItems.push({ id: ctx.newId(), name, holder: '' })
  }

  return { ...notebook, whereWeAre: whereWeAre(scene, ctx), nextSteps: [...fresh, ...own], keyItems }
}
