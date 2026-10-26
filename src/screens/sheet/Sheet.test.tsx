// Renders the sheet and table screen with the sample characters, to catch mistakes in what they show.
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_DICE_STYLE } from '../../dice/style.ts'
import { describe, expect, it } from 'vitest'
import type { RequestControls } from '../../live/useRollRequest.ts'
import { sampleCharacters, sampleFighter, sampleMembers, sampleWizard } from '../dev/sampleData.ts'
import { TableView } from '../table/TableView.tsx'
import { PowersTab } from './PowersTab.tsx'
import { SheetTab } from './SheetTab.tsx'

const noop = () => {}
const nobodyAsked: RequestControls = {
  request: null,
  answers: [],
  dc: null,
  error: null,
  ask: async () => true,
  override: noop,
  accept: noop,
  close: noop,
  putAnswer: noop,
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('the Sheet tab', () => {
  const html = text(renderToStaticMarkup(<SheetTab character={sampleFighter} canEdit onUpdate={noop} />))

  it('shows the worked-out attack for a weapon from the rules', () => {
    expect(html).toMatch(/Longsword \+5 1d8\+3 slashing \(1d10\+3 two hands\)/)
    expect(html).toMatch(/Handaxe 20\/60 ft \+5 1d6\+3 slashing/)
  })

  it('shows saves, skills and passive Perception', () => {
    expect(html).toMatch(/Strength \+5/)
    expect(html).toMatch(/Athletics \(STR\) \+5/)
    expect(html).toMatch(/Perception 13/)
  })

  it('shows hit points, hit dice and the controls for the owner', () => {
    expect(html).toMatch(/Hit points 17 \/ 20/)
    expect(html).toContain('d10, 2 of 2 left')
    expect(html).toContain('Damage')
    expect(html).toContain('Add a condition')
  })

  it('hides the controls from someone who can’t change the character', () => {
    const readOnly = renderToStaticMarkup(<SheetTab character={sampleFighter} canEdit={false} onUpdate={noop} />)
    expect(readOnly).not.toContain('>Damage</button>')
    expect(readOnly).not.toContain('Add a condition')
    expect(readOnly).not.toMatch(/<button[^>]*aria-label="Hit dice left/)
  })
})

describe('the Powers tab', () => {
  it('shows features with their uses and when they come back', () => {
    const html = text(renderToStaticMarkup(<PowersTab character={sampleFighter} canEdit onUpdate={noop} />))
    expect(html).toContain('Second Wind')
    expect(html).toContain('Back after a short or long rest')
    expect(html).toContain('No spellcasting')
  })

  it('shows the spell numbers, slots and spells for a caster', () => {
    const markup = renderToStaticMarkup(<PowersTab character={sampleWizard} canEdit onUpdate={noop} />)
    const html = text(markup)
    expect(html).toMatch(/Save DC 13/)
    expect(html).toMatch(/Attack \+5/)
    expect(html).toContain('1st level slots')
    expect(markup).toContain('aria-label="1st level slots left: 3 of 4"')
    expect(html).toMatch(/Cantrips Fire Bolt/)
    expect(html).toContain('Magic Missile')
  })
})

describe('the table screen', () => {
  const html = text(
    renderToStaticMarkup(
      <TableView
        campaignId="c1"
        me={sampleMembers[1]}
        character={sampleFighter}
        members={sampleMembers}
        characters={sampleCharacters}
        online={new Set(['p1'])}
        onUpdate={noop}
        diceStyle={{ material: 'glass', colour: 'ruby', numbers: 'gold' }}
        onDiceStyleChange={noop}
        asking={nobodyAsked}
      />,
    ),
  )

  it('shows your character plate as in the design', () => {
    expect(html).toContain('Thorin Ironfist')
    expect(html).toContain('Level 2 · Sam (you)')
    expect(html).toMatch(/Hit points 17 \/ 20/)
    expect(html).toMatch(/AC 18 Speed 25 Init\. \+1 Percep\. 13/)
  })

  it('shows your dice and your hand of cards', () => {
    expect(html).toContain('Your dice Ruby glass, gold numbers')
    expect(html).toMatch(/Attack Longsword \+5 · 1d8\+3/)
  })

  it('shows everyone in the camera column with their character’s HP', () => {
    expect(html).toMatch(/Matt Dungeon Master/)
    expect(html).toMatch(/Elowen Alex 12\/14/)
  })

  it('shows conditions on the plate', () => {
    const wizardView = text(
      renderToStaticMarkup(
        <TableView
          campaignId="c1"
          me={sampleMembers[2]}
          character={sampleWizard}
          members={sampleMembers}
          characters={sampleCharacters}
          online={new Set()}
          onUpdate={noop}
          diceStyle={DEFAULT_DICE_STYLE}
          onDiceStyleChange={noop}
          asking={nobodyAsked}
        />,
      ),
    )
    expect(wizardView).toContain('Conditions: Poisoned')
  })

  it('shows the death saves at 0 hit points outside a fight, with a roll', () => {
    const down = { ...sampleFighter, currentHp: 0, deathSaveSuccesses: 1, deathSaveFailures: 2 }
    const dyingView = text(
      renderToStaticMarkup(
        <TableView
          campaignId="c1"
          me={sampleMembers[1]}
          character={down}
          members={sampleMembers}
          characters={sampleCharacters}
          online={new Set(['p1'])}
          onUpdate={noop}
          diceStyle={DEFAULT_DICE_STYLE}
          onDiceStyleChange={noop}
          asking={nobodyAsked}
        />,
      ),
    )
    expect(dyingView).toContain('Dying')
    expect(dyingView).toContain('Roll a death save')
  })
})
