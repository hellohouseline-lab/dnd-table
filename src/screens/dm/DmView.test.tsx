import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RequestControls } from '../../live/useRollRequest.ts'
import type { FightControls } from '../../live/useFight.ts'
import { DEFAULT_DICE_STYLE } from '../../dice/style.ts'
import type { Roll } from '../../live/rolls.ts'
import { sampleNotebook } from '../dev/previewNotebook.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from '../dev/sampleData.ts'
import { DmView } from './DmView.tsx'

const noop = () => {}
const noFight: FightControls = {
  fight: null,
  status: 'ready',
  error: null,
  start: async () => null,
  addMonsters: async () => null,
  rollInitiative: async () => null,
  next: noop,
  setMonsterHp: noop,
  reveal: noop,
  setConditions: noop,
  remove: noop,
  end: noop,
}
const nobodyAsked: RequestControls = {
  request: null,
  answers: [],
  dc: null,
  error: null,
  ask: async () => true,
  override: noop,
  close: noop,
  putAnswer: noop,
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

const secretRoll: Roll = {
  id: 'r1',
  campaignId: 'preview',
  rollerId: 'dm',
  characterId: null,
  label: '1d20',
  kind: 'free',
  mode: 'normal',
  dice: [{ sides: 20, value: 9, dropped: false }],
  modifier: 0,
  parts: [],
  total: 9,
  natural: 9,
  damage: null,
  secret: true,
  style: DEFAULT_DICE_STYLE,
  createdAt: '2026-10-25T20:00:00Z',
  requestId: null,
  passed: null,
  passedByDice: null,
}

function render(startTab: 'party' | 'log') {
  return text(
    renderToStaticMarkup(
      <DmView
        campaign={sampleCampaign}
        me={sampleMembers[0]}
        members={sampleMembers}
        characters={sampleCharacters}
        online={new Set(['dm'])}
        onUpdate={noop}
        log={{ status: 'ready', rolls: [secretRoll] }}
        diceStyle={DEFAULT_DICE_STYLE}
        onDiceStyleChange={noop}
        asking={nobodyAsked}
        notebook={{ notebook: sampleNotebook(), status: 'ready', change: noop, saving: false, error: null }}
        events={{ events: [], add: noop, error: null }}
        sceneName="Arrive at the tavern"
        fight={noFight}
        startTab={startTab}
      />,
    ),
  )
}

describe('the DM screen', () => {
  it('shows a card for each character with what the DM glances at', () => {
    const html = render('party')
    expect(html).toMatch(/Thorin Ironfist Sam 17\/20/)
    expect(html).toMatch(/AC 18 Notices 13\+/)
    expect(html).toMatch(/Elowen Alex 12\/14/)
    expect(html).toContain('Spells left: 2 of 3')
    expect(html).toContain('Damage or heal')
  })

  it('shows the roll log, secret rolls included, on the Log tab', () => {
    const html = render('log')
    expect(html).toMatch(/Matt \(DM\) 1d20 Secret/)
    expect(html).toContain('Rolls and notes, tonight and before')
  })

  it('shows the notebook and the scene now', () => {
    const html = render('party')
    expect(html).toMatch(/Scene now: Arrive at the tavern/)
    expect(html).toMatch(/Where we are Edit The party has just reached the tavern/)
    expect(html).toMatch(/Silver key/)
    expect(html).toContain('Quick note')
  })

  it('gives the DM their own dice, with rolling behind the screen', () => {
    expect(render('party')).toContain('Your dice Obsidian, gold numbers')
  })
})
