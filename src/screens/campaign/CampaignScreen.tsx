import { useEffect } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { href } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { SiteFooter } from '../../components/SiteFooter.tsx'
import { useOnlineIds } from '../../live/campaignChannel.ts'
import { getCampaign, listMembers, type Campaign, type Member } from '../../live/campaigns.ts'
import { siteUrl } from '../../live/supabase.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useParty } from '../../live/useParty.ts'
import type { Character } from '../../rules/character.ts'
import columns from '../columns.module.css'
import { AtTheTablePanel, CameraPanel } from './AsidePanels.tsx'
import { describeParty, welcomeWord } from './describeParty.ts'
import { DmDetailsPanel, DmInvitePanel, DmPartyPanel, DmScreenPanel } from './DmPanels.tsx'
import { PlayerChoices } from './PlayerChoices.tsx'

/** Screen 01, "Join": the campaign's front door. Players pick a character; the DM invites and manages the party. */
export function CampaignScreen({ campaignId }: { campaignId: string }) {
  const user = useSignedInUser()
  const campaign = useLoad(() => getCampaign(campaignId), [campaignId])
  const members = useLoad(() => listMembers(campaignId), [campaignId])
  const online = useOnlineIds(campaignId, user.id)
  const party = useParty(campaignId, user.id)

  // When someone new comes online, fetch the list again so their name appears.
  const memberList = members.status === 'ready' ? members.data : null
  const reloadMembers = members.reload
  useEffect(() => {
    if (memberList && [...online].some((id) => !memberList.some((member) => member.user_id === id))) reloadMembers()
  }, [online, memberList, reloadMembers])

  const name = campaign.status === 'ready' ? campaign.data?.name : undefined
  useEffect(() => {
    if (name) document.title = `${name} · D&D Table`
  }, [name])

  if (campaign.status === 'loading' || members.status === 'loading' || party.status === 'loading')
    return <LoadingScreen />

  if (campaign.status === 'error' || members.status === 'error') {
    const message = campaign.status === 'error' ? campaign.message : members.status === 'error' ? members.message : ''
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Something went wrong" title="The table didn't open" />
        <Notice tone="error">{message}</Notice>
        <SiteFooter />
      </Page>
    )
  }

  const me = members.data.find((member) => member.user_id === user.id)
  if (!campaign.data || !me) {
    return (
      <Page width="narrow">
        <PageHeader
          eyebrow="No seat here"
          title="This table isn't open to you"
          subtitle="You may not have joined it yet, or the DM may have taken you off the list."
        />
        <div style={{ textAlign: 'center' }}>
          <ButtonLink href={href('/')} variant="outline">
            Your tables
          </ButtonLink>
        </div>
        <SiteFooter />
      </Page>
    )
  }

  return (
    <CampaignView
      table={campaign.data}
      members={members.data}
      me={me}
      characters={party.status === 'ready' ? party.characters : []}
      online={online}
      siteUrl={siteUrl()}
      onCampaignChanged={campaign.reload}
      onMembersChanged={members.reload}
    />
  )
}

type CampaignViewProps = {
  table: Campaign
  members: Member[]
  me: Member
  characters: Character[]
  online: ReadonlySet<string>
  siteUrl: string
  onCampaignChanged: () => void
  onMembersChanged: () => void
}

/** What the Join screen shows once everything has loaded. */
export function CampaignView({
  table,
  members,
  me,
  characters,
  online,
  siteUrl,
  onCampaignChanged,
  onMembersChanged,
}: CampaignViewProps) {
  const dm = members.find((member) => member.role === 'dm')
  const isDm = me.role === 'dm'

  return (
    <Page>
      <PageHeader
        eyebrow="Take your seat at the table"
        title={table.name}
        subtitle={describeParty(table.party_size, dm?.display_name ?? 'the DM', table.starting_level)}
        note="Signed in with your email link. No password needed."
      />

      <div className={columns.columns}>
        <section className={columns.main} aria-labelledby="welcome-heading">
          <h2 id="welcome-heading" className={columns.sectionTitle}>
            {welcomeWord(me.joined_at)}, {me.display_name}. {isDm ? 'Invite your players' : 'Choose your character'}
          </h2>
          {isDm ? (
            <>
              <DmScreenPanel campaign={table} />
              <DmInvitePanel campaign={table} siteUrl={siteUrl} onRenewed={onCampaignChanged} />
              <DmPartyPanel
                campaign={table}
                members={members}
                characters={characters}
                online={online}
                onChanged={onMembersChanged}
              />
              <DmDetailsPanel campaign={table} onSaved={onCampaignChanged} />
            </>
          ) : (
            <PlayerChoices campaignId={table.id} character={characters.find((c) => c.ownerId === me.user_id)} />
          )}
        </section>

        <aside className={columns.side}>
          <AtTheTablePanel
            members={members}
            characters={characters}
            online={online}
            myId={me.user_id}
            partySize={table.party_size}
          />
          <CameraPanel isDm={isDm} />
        </aside>
      </div>

      <SiteFooter />
    </Page>
  )
}
