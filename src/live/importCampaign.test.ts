import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseCampaign } from '../rules/campaignFile.ts'
import { SHORT_LAYOUT } from '../rules/campaignFile.fixture.ts'
import { CAMPAIGN_EXAMPLE } from '../rules/campaignTemplate.ts'
import { loadMonsters, type SrdMonster } from '../rules/srd/index.ts'
import type { Asset } from './library.ts'

// A stand-in database that remembers what was written.
const written: { table: string; op: 'insert' | 'update'; row: Record<string, unknown>; id?: string }[] = []
let next = 0
vi.mock('./supabase.ts', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        const id = `${table}-${++next}`
        written.push({ table, op: 'insert', row, id })
        return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) }
      },
      update: (row: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          written.push({ table, op: 'update', row, id })
          return { error: null }
        },
      }),
    }),
  },
}))

let monsters: SrdMonster[]
beforeAll(async () => {
  monsters = await loadMonsters()
})

const art = (name: string, category: Asset['category']): Asset =>
  ({
    id: `asset-${name}`,
    campaignId: 'c',
    kind: 'art',
    category,
    mood: null,
    name,
    path: `c/${name}`,
    thumbPath: null,
    sizeBytes: 0,
    streamSafe: true,
    credit: '',
    hotkey: null,
    createdAt: '',
  }) as Asset

describe('writing a pasted campaign', () => {
  it('makes people, items, chapters and scenes, linking them by name', async () => {
    const { importCampaign } = await import('./importCampaign.ts')
    const plan = parseCampaign(SHORT_LAYOUT)
    const added = await importCampaign('c', plan, {
      monsters,
      library: [art('Tavern', 'places'), art('Forest road', 'maps')],
      shops: [],
      characters: [],
      npcs: [],
      items: [],
      story: { chapters: [], scenes: [] },
    })
    expect(added).toBe('2 chapters, 3 scenes, 2 new people, 2 new items')

    const inserts = (table: string) => written.filter((w) => w.table === table && w.op === 'insert')
    expect(inserts('npcs').map((w) => w.row.name)).toEqual(['Brenna', 'Snaggle'])
    expect(inserts('dm_items').map((w) => w.row.key)).toEqual([true, true])
    expect(inserts('story_chapters').map((w) => w.row.position)).toEqual([0, 1])

    const [flagon, road, mill] = inserts('story_scenes')
    expect(flagon.row).toMatchObject({
      title: 'The Rusty Flagon',
      image_id: 'asset-Tavern',
      people: [inserts('npcs')[0].id],
    })
    expect(flagon.row.rolls).toHaveLength(2)
    expect(road.row.fight).toEqual({ monsters: [{ index: 'goblin', count: 3 }], mapId: 'asset-Forest road' })
    expect(mill.row.fight).toEqual({
      monsters: [
        { index: 'hobgoblin', count: 1 },
        { index: 'goblin', count: 4 },
      ],
      mapId: null,
    })
    expect((mill.row.things as { kind: string }[]).map((t) => t.kind)).toEqual(['item', 'item', 'box'])

    // Choices point at the scenes made.
    const choice = written.find((w) => w.table === 'story_scenes' && w.op === 'update' && w.id === flagon.id)
    expect(choice?.row.choices).toMatchObject([{ text: 'they take the mill road', sceneId: road.id }])
  })

  it('reads the campaign template: choices by scene number and to endings, portraits by name', async () => {
    const { importCampaign } = await import('./importCampaign.ts')
    written.length = 0
    const plan = parseCampaign(CAMPAIGN_EXAMPLE)
    plan.people[0].portrait = 'Tobin'
    const added = await importCampaign('c', plan, {
      monsters,
      library: [art('Tobin', 'people'), art('Cliff path', 'maps')],
      shops: [],
      characters: [],
      npcs: [],
      items: [],
      story: { chapters: [{ id: 'old', title: 'Old', position: 4 }], scenes: [] },
    })
    expect(added).toBe('4 chapters, 6 scenes, 2 new people, 1 new item')
    const inserts = (table: string) => written.filter((w) => w.table === table && w.op === 'insert')
    expect(inserts('npcs')[0].row.portrait_id).toBe('asset-Tobin')
    expect(inserts('story_chapters').map((w) => w.row.position)).toEqual([5, 6, 7, 8])

    const scenes = inserts('story_scenes')
    const byTitle = (title: string) => scenes.find((w) => w.row.title === title)!
    expect(byTitle('The Cliff Path').row.fight).toEqual({
      monsters: [
        { index: 'sahuagin', count: 2 },
        { index: 'merfolk', count: 2 },
      ],
      mapId: 'asset-Cliff path',
    })
    expect(byTitle('The Bell Chapel').row.fight).toMatchObject({ monsters: [{ index: 'sea-hag', count: 1 }] })
    const choicesOf = (title: string) =>
      written.find((w) => w.op === 'update' && w.id === byTitle(title).id)?.row.choices as { sceneId: string }[]
    expect(choicesOf('The Gull and Anchor').map((c) => c.sceneId)).toEqual([byTitle('The Cliff Path').id])
    expect(choicesOf('The Bell Chapel').map((c) => c.sceneId)).toEqual([
      byTitle('Silence the bell').id,
      byTitle("The keeper's bargain").id,
    ])
  })
})
