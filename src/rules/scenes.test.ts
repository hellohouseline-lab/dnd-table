import { describe, expect, it } from 'vitest'
import { boxWords, parseChoices, parseFight, parsePlannedRolls, parseThings, plannedRollWords } from './scenes.ts'

describe('scene parts', () => {
  it('reads planned rolls, dropping anything odd', () => {
    const rolls = parsePlannedRolls([
      {
        id: 'r1',
        key: 'skill:perception',
        dc: 13,
        outcomeShown: false,
        who: ['c1'],
        note: 'the figure',
      },
      { id: 'r2', key: 'skill:nonsense', dc: 10 },
      'junk',
      { key: 'save:dexterity', dc: 99 },
    ])
    expect(rolls).toHaveLength(2)
    expect(rolls[1]).toMatchObject({ key: 'save:dexterity', dc: 40, outcomeShown: true, who: [] })
    expect(plannedRollWords(rolls[0], ['Wren'])).toBe('Perception, DC 13, outcome kept, Wren')
    expect(plannedRollWords({ ...rolls[1], dc: 12 })).toBe('Dexterity save, DC 12')
  })

  it('reads choices, things and a fight', () => {
    expect(parseChoices([{ id: 'c', text: 'Take the mill road', sceneId: 's2' }, { text: '' }])).toEqual([
      { id: 'c', text: 'Take the mill road', sceneId: 's2' },
    ])
    expect(
      parseThings([
        { id: 'a', kind: 'item', dmItemId: 'seal' },
        { id: 'b', kind: 'box', container: 'body', richness: 'valuable' },
        { id: 'c', kind: 'shop', shopId: 'harl' },
        { id: 'd', kind: 'dragon' },
      ]).map((t) => t.kind),
    ).toEqual(['item', 'box', 'shop'])
    expect(
      parseFight({
        monsters: [
          { index: 'goblin', count: 3 },
          { index: '', count: 2 },
        ],
        mapId: 'm',
      }),
    ).toEqual({
      monsters: [{ index: 'goblin', count: 3 }],
      mapId: 'm',
    })
    expect(parseFight(null)).toBeNull()
    expect(boxWords('chest', 'valuable')).toBe('A valuable chest')
    expect(boxWords('body', 'ordinary')).toBe('An ordinary body')
  })
})
