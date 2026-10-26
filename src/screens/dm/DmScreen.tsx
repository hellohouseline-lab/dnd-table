import { useEffect, useState } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { navigate } from '../../app/router.ts'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { parseDiceStyle, type DiceStyle } from '../../dice/style.ts'
import { useOnlineIds } from '../../live/campaignChannel.ts'
import { getCampaign, listMembers } from '../../live/campaigns.ts'
import { grantLevelUp } from '../../live/characters.ts'
import { messageFor } from '../../live/errors.ts'
import { saveDiceStyle } from '../../live/rolls.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useParty } from '../../live/useParty.ts'
import { useRollLog } from '../../live/useRollLog.ts'
import { useRollRequest } from '../../live/useRollRequest.ts'
import { useNotebook } from '../../live/useNotebook.ts'
import { useLibrary, useLogEvents, useStage } from '../../live/useStage.ts'
import { useTableAudio } from '../../audio/useTableAudio.ts'
import { useFight } from '../../live/useFight.ts'
import { DmView } from './DmView.tsx'

/** The DM's screen. Players who open it are sent to their own table screen. */
export function DmScreen({ campaignId }: { campaignId: string }) {
  const user = useSignedInUser()
  const campaign = useLoad(() => getCampaign(campaignId), [campaignId])
  const members = useLoad(() => listMembers(campaignId), [campaignId])
  const party = useParty(campaignId, user.id)
  const online = useOnlineIds(campaignId, user.id)
  const log = useRollLog(campaignId, user.id)
  const asking = useRollRequest(campaignId, user.id, true)
  const notebook = useNotebook(campaignId)
  const events = useLogEvents(campaignId, user.id)
  const { stage } = useStage(campaignId, user.id)
  const library = useLibrary(campaignId, user.id)
  const audio = useTableAudio(campaignId, user.id, stage, library.assets)
  const fight = useFight(campaignId, user.id)
  const [chosenStyle, setChosenStyle] = useState<DiceStyle | null>(null)
  const [styleError, setStyleError] = useState<string | null>(null)

  // Someone who arrives after the screen opened shows up in the party and camera column.
  const memberList = members.status === 'ready' ? members.data : null
  const reloadMembers = members.reload
  useEffect(() => {
    if (memberList && [...online].some((id) => !memberList.some((member) => member.user_id === id))) reloadMembers()
  }, [online, memberList, reloadMembers])

  const me = memberList?.find((member) => member.user_id === user.id)
  const ready = campaign.status === 'ready' && members.status === 'ready' && party.status === 'ready'

  useEffect(() => {
    if (!ready) return
    if (!me) navigate(`/c/${campaignId}`, { replace: true })
    else if (me.role !== 'dm') navigate(`/c/${campaignId}/play`, { replace: true })
  }, [ready, me, campaignId])

  const name = campaign.status === 'ready' ? campaign.data?.name : undefined
  useEffect(() => {
    if (name) document.title = `DM screen · ${name} · D&D Table`
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
        <PageHeader eyebrow="Something went wrong" title="The DM screen didn't open" />
        <Notice tone="error">{message}</Notice>
      </Page>
    )
  }
  if (!ready || !campaign.data || !me || me.role !== 'dm' || party.status !== 'ready') return <LoadingScreen />

  const diceStyle = chosenStyle ?? parseDiceStyle(me.dice_style)
  function changeDiceStyle(style: DiceStyle) {
    setChosenStyle(style)
    setStyleError(null)
    saveDiceStyle(campaignId, user.id, style).catch((error: unknown) => setStyleError(messageFor(error)))
  }

  return (
    <DmView
      campaign={campaign.data}
      me={me}
      members={members.data}
      characters={party.characters}
      online={online}
      onUpdate={party.update}
      onLevelUp={(ids) => {
        setStyleError(null)
        grantLevelUp(ids).catch((caught: unknown) => setStyleError(messageFor(caught)))
      }}
      saveError={party.saveError ?? styleError}
      log={log}
      diceStyle={diceStyle}
      onDiceStyleChange={changeDiceStyle}
      asking={asking}
      notebook={notebook}
      events={events}
      sceneName={stage.sceneName}
      audio={audio}
      fight={fight}
      maps={library.assets.filter((a) => a.kind === 'art' && a.category === 'maps')}
      mapOnStage={stage.mode === 'map' ? stage.mapId : null}
    />
  )
}
