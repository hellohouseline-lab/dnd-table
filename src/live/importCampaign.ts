// Paste your notes (S1d): a read campaign (src/rules/campaignFile.ts) written into the campaign as
// the DM's people, items, chapters and scenes. Names are matched loosely to what's already there
// (people and items you made, the library's pictures, music and maps, shops, and the free rules'
// monsters), so pasting twice doesn't make two Brennas.

import { choiceTarget, matchName, type CampaignPlan } from '../rules/campaignFile.ts'
import type { DmItem } from '../rules/catalogue.ts'
import type { Character } from '../rules/character.ts'
import type { Fight, PlannedRoll, Thing } from '../rules/scenes.ts'
import type { Shop } from '../rules/shops.ts'
import type { SrdMonster } from '../rules/srd/index.ts'
import type { Json } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import type { Asset } from './library.ts'
import type { Npc } from './npcs.ts'
import type { Story } from './story.ts'
import { supabase } from './supabase.ts'

export type ImportContext = {
  monsters: SrdMonster[]
  library: Asset[]
  shops: Shop[]
  characters: Character[]
  npcs: Npc[]
  items: DmItem[]
  story: Story
}

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

const short = () => crypto.randomUUID().slice(0, 8)

/** Writes a read campaign into this campaign. Resolves with what was added, in words. */
export async function importCampaign(campaignId: string, plan: CampaignPlan, ctx: ImportContext): Promise<string> {
  // People: the People list, plus anyone a scene names who isn't in it.
  const peopleNames = new Set(plan.people.map((p) => p.name.toLowerCase()))
  const extraPeople = plan.chapters
    .flatMap((c) => c.scenes.flatMap((s) => s.people))
    .filter(
      (name) =>
        !peopleNames.has(name.toLowerCase()) &&
        !matchName(plan.people, (p) => p.name, name) &&
        !matchName(ctx.npcs, (n) => n.name, name),
    )
  const npcIds = new Map<string, string>()
  let newPeople = 0
  for (const person of [...plan.people, ...[...new Set(extraPeople)].map((name) => ({ name }))]) {
    const known = matchName(ctx.npcs, (n) => n.name, person.name)
    if (known) {
      npcIds.set(person.name.toLowerCase(), known.id)
      continue
    }
    const p = person as Partial<CampaignPlan['people'][number]> & { name: string }
    const { data, error } = await db()
      .from('npcs')
      .insert({
        campaign_id: campaignId,
        name: p.name.slice(0, 80),
        role: (p.role ?? '').slice(0, 80),
        place: (p.place ?? '').slice(0, 120),
        voice: (p.voice ?? '').slice(0, 500),
        wants: (p.wants ?? '').slice(0, 1000),
        knows: (p.knows ?? '').slice(0, 2000),
        secrets: (p.secrets ?? '').slice(0, 2000),
        attitude: p.attitude ?? 'neutral',
        portrait_id: p.portrait
          ? (matchName(
              ctx.library.filter((a) => a.kind === 'art' && a.category !== 'maps'),
              (a) => a.name,
              p.portrait,
            )?.id ?? null)
          : null,
      })
      .select('id')
      .single()
    if (error) throw fromDatabaseError(error)
    npcIds.set(p.name.toLowerCase(), data.id)
    newPeople += 1
  }
  const npcFor = (name: string) =>
    npcIds.get(name.toLowerCase()) ?? matchName(ctx.npcs, (n) => n.name, name)?.id ?? null

  // Items: the Items list, plus anything a scene gives that isn't in it.
  const itemNames = new Set(plan.items.map((i) => i.name.toLowerCase()))
  const extraItems = plan.chapters
    .flatMap((c) => c.scenes.flatMap((s) => s.gives))
    .filter((name) => !itemNames.has(name.toLowerCase()) && !matchName(ctx.items, (i) => i.name, name))
  const itemIds = new Map<string, string>()
  let newItems = 0
  for (const item of [...plan.items, ...[...new Set(extraItems)].map((name) => ({ name }))]) {
    const known = matchName(ctx.items, (i) => i.name, item.name)
    if (known) {
      itemIds.set(item.name.toLowerCase(), known.id)
      continue
    }
    const it = item as Partial<CampaignPlan['items'][number]> & { name: string }
    const { data, error } = await db()
      .from('dm_items')
      .insert({
        campaign_id: campaignId,
        name: it.name.slice(0, 60),
        description: (it.description ?? '').slice(0, 1000),
        type: it.type ?? 'other',
        rarity: it.rarity ?? null,
        key: it.key ?? false,
      })
      .select('id')
      .single()
    if (error) throw fromDatabaseError(error)
    itemIds.set(it.name.toLowerCase(), data.id)
    newItems += 1
  }

  // Chapters and scenes, after the ones already there.
  const asset = (name: string, kind: Asset['kind'], maps = false) =>
    name
      ? (matchName(
          ctx.library.filter((a) => a.kind === kind && (kind !== 'art' || (a.category === 'maps') === maps)),
          (a) => a.name,
          name,
        )?.id ?? null)
      : null
  let chapterAt = ctx.story.chapters.reduce((top, c) => Math.max(top, c.position), -1) + 1
  const made: {
    id: string
    number: string
    title: string
    choices: CampaignPlan['chapters'][number]['scenes'][number]['choices']
  }[] = []
  for (const chapter of plan.chapters) {
    const { data: row, error } = await db()
      .from('story_chapters')
      .insert({ campaign_id: campaignId, title: chapter.title.slice(0, 120), position: chapterAt++ })
      .select('id')
      .single()
    if (error) throw fromDatabaseError(error)
    let sceneAt = 0
    for (const scene of chapter.scenes) {
      const rolls: PlannedRoll[] = scene.rolls.flatMap((r) =>
        r.key
          ? [
              {
                id: short(),
                key: r.key,
                dc: r.dc,
                dcShown: r.dcShown,
                outcomeShown: r.outcomeShown,
                who: r.who.flatMap((name) => {
                  const c = matchName(ctx.characters, (x) => x.name, name)
                  return c ? [c.id] : []
                }),
                note: r.note,
              },
            ]
          : [],
      )
      const things: Thing[] = [
        ...scene.gives.flatMap((name): Thing[] => {
          const id = itemIds.get(name.toLowerCase()) ?? matchName(ctx.items, (i) => i.name, name)?.id
          return id ? [{ id: short(), kind: 'item', dmItemId: id }] : []
        }),
        ...scene.boxes.map((b): Thing => ({ id: short(), kind: 'box', container: b.container, richness: b.richness })),
        ...scene.shops.flatMap((name): Thing[] => {
          const shop = matchName(ctx.shops, (s) => s.name, name)
          return shop ? [{ id: short(), kind: 'shop', shopId: shop.id }] : []
        }),
      ]
      const monsters = scene.fight.flatMap((f) => {
        const m = matchName(ctx.monsters, (x) => x.name, f.name)
        return m ? [{ index: m.index, count: f.count }] : []
      })
      const missing = scene.fight.filter((f) => !matchName(ctx.monsters, (x) => x.name, f.name))
      const fight: Fight | null = scene.fight.length > 0 ? { monsters, mapId: asset(scene.map, 'art', true) } : null
      const reminders = [
        scene.reminders,
        ...scene.rolls.filter((r) => !r.key).map((r) => `Roll: ${r.text}${r.note ? ` (${r.note})` : ''}`),
        ...(missing.length > 0
          ? [`Fight also has (not in the free rules): ${missing.map((m) => `${m.count} × ${m.name}`).join(', ')}`]
          : []),
      ]
        .filter(Boolean)
        .join('\n')
      const { data: sceneRow, error: sceneError } = await db()
        .from('story_scenes')
        .insert({
          campaign_id: campaignId,
          chapter_id: row.id,
          title: scene.title.slice(0, 120),
          place: scene.place.slice(0, 120),
          read_aloud: scene.readAloud.slice(0, 8000),
          reminders: reminders.slice(0, 8000),
          image_id: asset(scene.picture, 'art'),
          music_id: asset(scene.music, 'music'),
          position: sceneAt++,
          rolls: rolls as unknown as Json,
          things: things as unknown as Json,
          fight: fight as unknown as Json,
          people: scene.people.flatMap((name) => {
            const id = npcFor(name)
            return id ? [id] : []
          }),
        })
        .select('id')
        .single()
      if (sceneError) throw fromDatabaseError(sceneError)
      made.push({ id: sceneRow.id, number: scene.number, title: scene.title, choices: scene.choices })
    }
  }

  // Choices last, once every scene they lead to exists.
  const before = ctx.story.scenes.map((s) => ({ id: s.id, number: '', title: s.title }))
  for (const scene of made) {
    if (scene.choices.length === 0) continue
    const choices = scene.choices.map((c) => ({
      id: short(),
      text: c.text,
      sceneId: (choiceTarget(made, c.to) ?? choiceTarget(before, c.to))?.id ?? null,
    }))
    const { error } = await db()
      .from('story_scenes')
      .update({ choices: choices as unknown as Json })
      .eq('id', scene.id)
    if (error) throw fromDatabaseError(error)
  }

  const scenes = made.length
  return [
    `${plan.chapters.length} chapter${plan.chapters.length === 1 ? '' : 's'}`,
    `${scenes} scene${scenes === 1 ? '' : 's'}`,
    `${newPeople} new ${newPeople === 1 ? 'person' : 'people'}`,
    `${newItems} new item${newItems === 1 ? '' : 's'}`,
  ].join(', ')
}
