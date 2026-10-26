import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_DICE_STYLE } from '../../dice/style.ts'
import type { Roll } from '../../live/rolls.ts'
import { sampleCharacters } from '../dev/sampleData.ts'
import { RollsForDm } from './RollsForDm.tsx'

const thorin = sampleCharacters[0]

function rollForDm(natural: number, other: number): Roll {
  return {
    id: `roll-${natural}`,
    campaignId: 'c',
    rollerId: thorin.ownerId,
    characterId: thorin.id,
    label: 'A roll for the DM',
    kind: 'check',
    mode: 'advantage',
    dice: [
      { sides: 20, value: natural, dropped: false },
      { sides: 20, value: other, dropped: true },
    ],
    modifier: 0,
    parts: [],
    total: natural,
    natural,
    damage: null,
    secret: false,
    style: DEFAULT_DICE_STYLE,
    createdAt: '2026-10-27T10:00:00Z',
    requestId: null,
    passed: null,
    passedByDice: null,
    forDm: true,
  }
}

describe("the DM's rolls for you", () => {
  it('shows who rolled, how, and asks what it was', () => {
    const html = renderToStaticMarkup(
      <RollsForDm rolls={[rollForDm(14, 6)]} characters={sampleCharacters} onSettle={() => {}} />,
    )
    expect(html).toContain('Thorin Ironfist rolled for you with advantage')
    expect(html).toContain('Rolled 14')
    expect(html).toContain('What was it?')
    expect(html).toContain('Constitution save')
    expect(html).toContain('Let it go')
  })

  it('makes a fuss of a natural 20 and a natural 1', () => {
    const html = renderToStaticMarkup(
      <RollsForDm rolls={[rollForDm(20, 3), rollForDm(1, 1)]} characters={sampleCharacters} onSettle={() => {}} />,
    )
    expect(html).toContain('Natural 20!')
    expect(html).toContain('Natural 1')
  })

  it('shows nothing when no one has rolled', () => {
    expect(renderToStaticMarkup(<RollsForDm rolls={[]} characters={sampleCharacters} onSettle={() => {}} />)).toBe('')
  })
})
