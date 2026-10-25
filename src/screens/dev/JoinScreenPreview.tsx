// Local development only (the route exists only under `npm run dev`): the Join screen with
// made-up people, so its look can be checked without signing in. Buttons that save won't work here.
import type { Campaign, Member } from '../../live/campaigns.ts'
import { CampaignView } from '../campaign/CampaignScreen.tsx'

const campaign: Campaign = {
  id: 'preview',
  name: 'The Sunless Citadel',
  dm_id: 'dm',
  party_size: 4,
  starting_level: 1,
  join_code: 'K7QM2P',
  created_at: '2026-10-25T20:00:00Z',
}

const joined = '2026-10-20T20:00:00Z'
const members: Member[] = [
  { campaign_id: 'preview', user_id: 'dm', role: 'dm', display_name: 'Matt', here_tonight: true, joined_at: joined },
  { campaign_id: 'preview', user_id: 'p1', role: 'player', display_name: 'Sam', here_tonight: true, joined_at: joined },
  { campaign_id: 'preview', user_id: 'p2', role: 'player', display_name: 'Alex', here_tonight: false, joined_at: joined },
]

const online = new Set(['dm', 'p1'])
const noop = () => {}

export function JoinScreenPreview({ as }: { as: string }) {
  const me = members.find((member) => member.user_id === (as === 'dm' ? 'dm' : 'p1')) ?? members[1]
  return (
    <CampaignView
      table={campaign}
      members={members}
      me={me}
      online={online}
      siteUrl="http://localhost:5180/dnd-table/"
      onCampaignChanged={noop}
      onMembersChanged={noop}
    />
  )
}
