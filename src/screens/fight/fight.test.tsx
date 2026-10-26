import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FightControls } from '../../live/useFight.ts'
import { sampleFight } from '../dev/previewFight.ts'
import { sampleCharacters, sampleFighter, sampleWizard } from '../dev/sampleData.ts'
import { EncounterTab } from './EncounterTab.tsx'
import { fightRows } from './fightRows.ts'
import { FRESH_TURN } from '../../rules/turn.ts'
import { InitiativePrompt, InitiativeRibbon, YourTurn } from './PlayerCombat.tsx'

const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const fight = sampleFight(sampleCharacters)

const controls: FightControls = {
  fight,
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
  events: [],
  attack: () => Promise.reject(new Error('No fight')),
  act: noop,
  undo: noop,
  prompts: [],
  strike: () => Promise.reject(new Error('No fight')),
  letGo: noop,
  deathSave: () => Promise.reject(new Error('No fight')),
  cast: () => Promise.reject(new Error('No fight')),
  concentrationSave: () => Promise.reject(new Error('No fight')),
  applyFeature: () => Promise.reject(new Error('No fight')),
  takeBack: () => Promise.reject(new Error('No fight')),
}

describe('the turn order', () => {
  it('shows the DM real names and hit points, in initiative order', () => {
    const rows = fightRows(fight, sampleCharacters, 'dm')
    expect(rows.map((r) => [r.name, r.combatant.initiative, r.status])).toEqual([
      ['Thorin Ironfist', 18, 'acting'],
      ['Goblin A', 15, 'next'],
      ['Goblin B', 9, null],
      ['Elowen', null, null],
    ])
    expect(rows[2]).toMatchObject({ unrevealed: true, hp: { current: 3, max: 7 }, health: 'bloodied' })
  })

  it('shows players an unknown creature and how hurt it looks, never its hit points', () => {
    const rows = fightRows(fight, sampleCharacters, 'player')
    expect(rows[2]).toMatchObject({ name: 'Unknown creature 2', hp: null, health: 'bloodied' })
    expect(rows[1].name).toBe('Goblin A')
  })
})

describe('the Encounter tab', () => {
  const html = text(
    renderToStaticMarkup(
      <EncounterTab
        campaignId="preview"
        fight={fight}
        controls={controls}
        characters={sampleCharacters}
        monsters={null}
        selectedId={null}
        onSelect={noop}
        onCharacterHp={noop}
        onAttack={noop}
        onCharacterAttack={noop}
        onRollInitiative={noop}
        onOpenSheet={noop}
      />,
    ),
  )

  it('lists the turn order with hit points and who is acting', () => {
    expect(html).toMatch(/18 Thorin Ironfist 25 ft 17\/20 Acting/)
    expect(html).toMatch(/15 Goblin A 7\/7 Next/)
    expect(html).toMatch(/Goblin B · players see “Unknown creature 2” 3\/7 Bloodied/)
    expect(html).toMatch(/– Elowen 12\/14 Roll for them/)
  })

  it('shows who is acting now', () => {
    expect(html).toMatch(/Acting now Thorin Ironfist AC 18 · HP 17\/20/)
  })
})

describe('the player in a fight', () => {
  it('asks for initiative with their bonus', () => {
    const html = text(renderToStaticMarkup(<InitiativePrompt character={sampleWizard} mode="normal" onRoll={noop} />))
    expect(html).toMatch(/Roll initiative .* Your bonus \+2 With disadvantage/)
  })

  it('shows the turn order as players know it', () => {
    const html = text(renderToStaticMarkup(<InitiativeRibbon rows={fightRows(fight, sampleCharacters, 'player')} />))
    expect(html).toContain('18 Thorin Ironfist 15 Goblin A 9 Unknown creature 2 ? Elowen')
  })

  it('shows what is left of this turn, as the server keeps it', () => {
    const html = text(
      renderToStaticMarkup(
        <YourTurn
          turn={{ ...FRESH_TURN, feetMoved: 15 }}
          speed={sampleFighter.speed}
          perAction={1}
          myTurn
          started
          onAct={noop}
          onEndTurn={noop}
        />,
      ),
    )
    expect(html).toMatch(
      /Your turn Action Ready Bonus action Ready Reaction Ready Movement 10 of 25 ft Dash Disengage Dodge End turn/,
    )
  })

  it('counts attacks left with Extra Attack, and Dash adds movement', () => {
    const html = text(
      renderToStaticMarkup(
        <YourTurn
          turn={{ ...FRESH_TURN, actionUsed: true, attacksMade: 1, extraFeet: 25 }}
          speed={25}
          perAction={2}
          myTurn
          started
          onAct={noop}
          onEndTurn={noop}
        />,
      ),
    )
    expect(html).toMatch(/Action 1 attack left/)
    expect(html).toMatch(/Movement 50 of 50 ft/)
  })
})
