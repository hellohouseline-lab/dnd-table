import { describe, expect, it } from 'vitest'
import type { Member } from '../live/campaigns.ts'
import type { Roll } from '../live/rolls.ts'
import { sampleFighter } from '../screens/dev/sampleData.ts'
import { colorsetFor } from './diceTray.ts'
import { facesFor, throwNotation } from './notation.ts'
import { damageLine, naturalNote, naturalTitle, partsText, sumText, whoRolled } from './rollText.ts'
import { DEFAULT_DICE_STYLE, describeDiceStyle, parseDiceStyle } from './style.ts'

describe('throwNotation', () => {
  it('lists dice of one kind together, with the faces they land on', () => {
    expect(
      throwNotation([
        { sides: 20, value: 14 },
        { sides: 8, value: 3 },
        { sides: 20, value: 7 },
      ]),
    ).toBe('2d20+1d8@14,7,3')
  })

  it('throws a d100 as a tens die and a units die', () => {
    expect(facesFor({ sides: 100, value: 57 })).toEqual([
      { type: 'd100', value: 50 },
      { type: 'd10', value: 7 },
    ])
    // 07 is "00" and 7; 100 is "00" and "0"; 10 is 10 and "0".
    expect(facesFor({ sides: 100, value: 7 }).map((face) => face.value)).toEqual([100, 7])
    expect(facesFor({ sides: 100, value: 100 }).map((face) => face.value)).toEqual([100, 10])
    expect(facesFor({ sides: 100, value: 10 }).map((face) => face.value)).toEqual([10, 10])
  })

  it('keeps a d100 units die with any other d10s', () => {
    expect(
      throwNotation([
        { sides: 10, value: 4 },
        { sides: 100, value: 42 },
      ]),
    ).toBe('2d10+1d100@4,2,40')
  })
})

describe('dice looks', () => {
  it('describes a look in words', () => {
    expect(describeDiceStyle(DEFAULT_DICE_STYLE)).toBe('Obsidian, gold numbers')
    expect(describeDiceStyle({ material: 'glass', colour: 'ruby', numbers: 'white' })).toBe('Ruby glass, white numbers')
  })

  it('fills in anything missing or unknown', () => {
    expect(parseDiceStyle({})).toEqual(DEFAULT_DICE_STYLE)
    expect(parseDiceStyle(null)).toEqual(DEFAULT_DICE_STYLE)
    expect(parseDiceStyle({ material: 'jelly', colour: 'sapphire' })).toEqual({
      ...DEFAULT_DICE_STYLE,
      colour: 'sapphire',
    })
  })

  it('makes glass see-through and gives each throw its own colour set', () => {
    const glass = colorsetFor({ material: 'glass', colour: 'ruby', numbers: 'gold' })
    const again = colorsetFor({ material: 'glass', colour: 'ruby', numbers: 'gold' })
    expect(glass.background).toMatch(/^rgba\(163, 25, 45, 0\.6\)$/)
    expect(glass.material).toBe('glass')
    expect(glass.name).not.toBe(again.name)
    expect(colorsetFor({ material: 'stone', colour: 'slate', numbers: 'white' })).toMatchObject({
      texture: 'paper',
      material: 'wood',
    })
  })
})

const baseRoll: Roll = {
  id: 'r1',
  campaignId: 'preview',
  rollerId: 'p1',
  characterId: null,
  label: 'Perception check',
  kind: 'check',
  mode: 'normal',
  dice: [{ sides: 20, value: 14, dropped: false }],
  modifier: 3,
  parts: [
    { label: 'Wisdom', value: 1 },
    { label: 'Proficiency', value: 2 },
  ],
  total: 17,
  natural: 14,
  damage: null,
  secret: false,
  style: DEFAULT_DICE_STYLE,
  createdAt: '2026-10-25T20:00:00Z',
  requestId: null,
  passed: null,
  passedByDice: null,
  forDm: false,
}

describe('roll words', () => {
  const members = [
    { user_id: 'dm', display_name: 'Matt', role: 'dm' },
    { user_id: 'p1', display_name: 'Sam', role: 'player' },
  ] as Member[]

  it('names the character, the person, or the DM', () => {
    expect(whoRolled({ rollerId: 'p1', characterId: sampleFighter.id }, members, [sampleFighter])).toBe(
      sampleFighter.name,
    )
    expect(whoRolled({ rollerId: 'p1', characterId: null }, members, [])).toBe('Sam')
    expect(whoRolled({ rollerId: 'dm', characterId: null }, members, [])).toBe('Matt (DM)')
  })

  it('writes the sum with a true minus sign', () => {
    expect(sumText(baseRoll)).toBe('14 + 3')
    expect(sumText({ ...baseRoll, modifier: -1 })).toBe('14 − 1')
    expect(sumText({ ...baseRoll, modifier: 0 })).toBe('14')
  })

  it('lists the parts of the bonus, and conditions by name', () => {
    expect(partsText([...baseRoll.parts, { label: 'Poisoned: disadvantage', value: 0 }])).toBe(
      'Wisdom +1, Proficiency +2, Poisoned: disadvantage',
    )
  })

  it('says what a natural means for each kind of roll', () => {
    expect(naturalTitle({ ...baseRoll, natural: 14 })).toBeNull()
    expect(naturalTitle({ ...baseRoll, natural: 20 })).toBe('Natural 20')
    expect(naturalNote({ ...baseRoll, natural: 20 })).toMatch(/total still decides/)
    expect(naturalTitle({ ...baseRoll, kind: 'attack', natural: 20 })).toBe('Critical hit')
    expect(naturalNote({ ...baseRoll, kind: 'attack', natural: 1 })).toMatch(/always misses/)
  })

  it('describes an attack’s damage, or the miss', () => {
    const attack: Roll = {
      ...baseRoll,
      kind: 'attack',
      damage: {
        dice: [{ sides: 8, value: 6, dropped: false }],
        modifier: 3,
        total: 9,
        type: 'slashing',
        critical: false,
      },
    }
    expect(damageLine(attack)).toBe('9 slashing damage')
    expect(damageLine({ ...attack, natural: 1, damage: null })).toMatch(/Misses/)
    expect(damageLine(baseRoll)).toBeNull()
  })
})
