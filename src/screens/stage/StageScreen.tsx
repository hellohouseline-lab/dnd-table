import { useEffect } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { navigate } from '../../app/router.ts'
import { useTableAudio } from '../../audio/useTableAudio.ts'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { useOnlineIds } from '../../live/campaignChannel.ts'
import { getCampaign, listMembers } from '../../live/campaigns.ts'
import { serverNow, syncClock } from '../../live/clock.ts'
import { deleteAsset, updateAsset, uploadArt, uploadSound } from '../../live/library.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useParty } from '../../live/useParty.ts'
import { useLibrary, useStage } from '../../live/useStage.ts'
import { StageView, type LibraryActions } from './StageView.tsx'

/** The DM's second screen, the stage. Players who open it are sent to their own table screen. */
export function StageScreen({ campaignId }: { campaignId: string }) {
  const user = useSignedInUser()
  const campaign = useLoad(() => getCampaign(campaignId), [campaignId])
  const members = useLoad(() => listMembers(campaignId), [campaignId])
  const party = useParty(campaignId, user.id)
  const online = useOnlineIds(campaignId, user.id)
  const stage = useStage(campaignId, user.id)
  const library = useLibrary(campaignId, user.id)
  const audio = useTableAudio(campaignId, user.id, stage.stage, library.assets)

  const me = members.status === 'ready' ? members.data.find((m) => m.user_id === user.id) : undefined
  const ready = campaign.status === 'ready' && members.status === 'ready' && party.status === 'ready'

  useEffect(() => {
    void syncClock()
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!me) navigate(`/c/${campaignId}`, { replace: true })
    else if (me.role !== 'dm') navigate(`/c/${campaignId}/play`, { replace: true })
  }, [ready, me, campaignId])

  const name = campaign.status === 'ready' ? campaign.data?.name : undefined
  useEffect(() => {
    if (name) document.title = `The Stage · ${name} · D&D Table`
  }, [name])

  if (campaign.status === 'error' || members.status === 'error' || party.status === 'error') {
    const message =
      campaign.status === 'error'
        ? campaign.message
        : members.status === 'error'
          ? members.message
          : party.status === 'error'
            ? party.message
            : ''
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Something went wrong" title="The stage didn't open" />
        <Notice tone="error">{message}</Notice>
      </Page>
    )
  }
  if (!ready || !campaign.data || !me || me.role !== 'dm' || party.status !== 'ready') return <LoadingScreen />

  const actions: LibraryActions = {
    uploadArt: (file, category) => uploadArt(campaignId, file, category),
    uploadSound: (file, details) => uploadSound(campaignId, file, details),
    update: updateAsset,
    remove: deleteAsset,
  }

  return (
    <StageView
      campaign={campaign.data}
      me={me}
      members={members.data}
      characters={party.characters}
      online={online}
      stage={stage}
      library={library}
      actions={actions}
      audio={audio}
      now={serverNow}
    />
  )
}
