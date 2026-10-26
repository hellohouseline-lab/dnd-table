// Renders the Join screen's pieces with made-up people, to catch mistakes in what they show.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Campaign, Member } from '../../live/campaigns.ts'
import { sampleFighter } from '../dev/sampleData.ts'
import { AtTheTablePanel, CameraPanel } from './AsidePanels.tsx'
import { DmDetailsPanel, DmInvitePanel, DmPartyPanel } from './DmPanels.tsx'
import { PlayerChoices } from './PlayerChoices.tsx'

const campaign: Campaign = {
  id: 'c1',
  name: 'The Sunless Citadel',
  dm_id: 'dm',
  party_size: 4,
  starting_level: 1,
  join_code: 'K7QM2P',
  camera_key: 'abcdef0123456789abcdef01',
  created_at: '2026-10-25T20:00:00Z',
}

function member(user_id: string, display_name: string, role: 'dm' | 'player', here_tonight = true): Member {
  return {
    campaign_id: 'c1',
    user_id,
    camera_id: `dndtest${user_id}`,
    display_name,
    role,
    here_tonight,
    joined_at: '2026-10-25T20:00:00Z',
    dice_style: {},
  }
}

const members = [member('dm', 'Matt', 'dm'), member('p1', 'Sam', 'player'), member('p2', 'Alex', 'player', false)]
const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('At the table now', () => {
  const html = text(
    renderToStaticMarkup(
      <AtTheTablePanel
        members={members}
        characters={[sampleFighter]}
        online={new Set(['dm'])}
        myId="p1"
        partySize={4}
      />,
    ),
  )

  it('marks the DM and you', () => {
    expect(html).toContain('Matt (DM)')
    expect(html).toContain('Sam · you')
  })

  it('names each player’s character', () => {
    expect(html).toContain('Sam · you · Thorin Ironfist')
  })

  it('says who is here, who is expected and who is out tonight', () => {
    expect(html).toMatch(/Matt \(DM\) Here/)
    expect(html).toMatch(/Thorin Ironfist Not here yet/)
    expect(html).toMatch(/Alex Not tonight/)
  })

  it('shows the empty seats left in the party', () => {
    expect(html.match(/Empty seat/g)).toHaveLength(2)
  })
})

describe('The DM panels', () => {
  it('show the code and the invite link', () => {
    const html = text(
      renderToStaticMarkup(
        <DmInvitePanel campaign={campaign} siteUrl="https://hellohouseline-lab.github.io/dnd-table/" onRenewed={noop} />,
      ),
    )
    expect(html).toContain('K7QM2P')
    expect(html).toContain('https://hellohouseline-lab.github.io/dnd-table/#/join/K7QM2P')
  })

  it('list the players with Here tonight and Remove, but not the DM', () => {
    const html = text(
      renderToStaticMarkup(
        <DmPartyPanel campaign={campaign} members={members} characters={[sampleFighter]} online={new Set()} onChanged={noop} />,
      ),
    )
    expect(html).toContain('2 of 4 players have joined')
    expect(html.match(/Here tonight/g)).toHaveLength(2)
    expect(html.match(/Remove/g)).toHaveLength(2)
    expect(html).not.toContain('Matt')
  })

  it('show each player’s character with a link to the sheet, or that they have none yet', () => {
    const html = renderToStaticMarkup(
      <DmPartyPanel campaign={campaign} members={members} characters={[sampleFighter]} online={new Set()} onChanged={noop} />,
    )
    expect(text(html)).toContain('Sam · Thorin Ironfist')
    expect(text(html)).toContain('Alex · no character yet')
    expect(html).toContain('href="#/c/c1/sheet/fighter"')
  })

  it('fill the details form with the campaign as it is', () => {
    const html = renderToStaticMarkup(<DmDetailsPanel campaign={campaign} onSaved={noop} />)
    expect(html).toContain('value="The Sunless Citadel"')
  })
})

describe('The player cards', () => {
  it('offer to create a character when the player has none', () => {
    const html = renderToStaticMarkup(<PlayerChoices campaignId="c1" />)
    expect(text(html)).toContain('Create your character')
    expect(html).toContain('href="#/c/c1/character/new"')
  })

  it('show the character card with Take your seat once there is one', () => {
    const html = renderToStaticMarkup(<PlayerChoices campaignId="c1" character={sampleFighter} />)
    expect(text(html)).toContain('Thorin Ironfist')
    expect(text(html)).toContain('Level 2 · Hill Dwarf · Fighter')
    expect(text(html)).toContain('17/20')
    expect(html).toContain('href="#/c/c1/play"')
  })

  it('keep the wizard card from the design, switched off until Phase 2', () => {
    const html = renderToStaticMarkup(<PlayerChoices campaignId="c1" />)
    expect(html).toContain('Forge a new character')
    expect(html.match(/disabled=""/g)).toHaveLength(1)
  })

  it('keep the camera box from the design, with voice and camera in place of the VDO.Ninja link', () => {
    const html = text(renderToStaticMarkup(<CameraPanel />))
    expect(html).toContain('Camera preview 16:9')
    expect(html).toContain('Voice and camera Not joined yet')
    expect(html).toContain('The same feed appears in everyone’s camera column and in every streamer’s overlay.')
  })
})
