import { useEffect, useMemo, useState } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { navigate } from '../../app/router.ts'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { parseDiceStyle, type DiceStyle } from '../../dice/style.ts'
import { useOnlineIds } from '../../live/campaignChannel.ts'
import { listMembers } from '../../live/campaigns.ts'
import { messageFor } from '../../live/errors.ts'
import { saveDiceStyle } from '../../live/rolls.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useParty } from '../../live/useParty.ts'
import { useRollRequest } from '../../live/useRollRequest.ts'
import { useLibrary, useStage, useStageImage } from '../../live/useStage.ts'
import { useTableAudio } from '../../audio/useTableAudio.ts'
import { useFight, useMapPointers, useTokens } from '../../live/useFight.ts'
import { useAreas } from '../../live/areas.ts'
import { TableView } from './TableView.tsx'

/** The player's table screen. The DM is sent to the DM screen; a player without a character, to make one. */
export function TableScreen({ campaignId }: { campaignId: string }) {
  const user = useSignedInUser()
  const members = useLoad(() => listMembers(campaignId), [campaignId])
  const party = useParty(campaignId, user.id)
  const online = useOnlineIds(campaignId, user.id)
  const asking = useRollRequest(campaignId, user.id, false)
  const { stage } = useStage(campaignId, user.id)
  const library = useLibrary(campaignId, user.id)
  const stageImage = useStageImage(stage.imageId, library.assets)
  const audio = useTableAudio(campaignId, user.id, stage, library.assets)
  const fight = useFight(campaignId, user.id)
  const mapId = stage.mode === 'map' ? stage.mapId : null
  const battleMap = useStageImage(mapId, library.assets)
  const tokens = useTokens(campaignId, user.id, mapId)
  const areas = useAreas(campaignId, user.id, mapId)
  const [chosenStyle, setChosenStyle] = useState<DiceStyle | null>(null)
  const [styleError, setStyleError] = useState<string | null>(null)

  const me = members.status === 'ready' ? members.data.find((m) => m.user_id === user.id) : undefined
  const character = party.status === 'ready' ? party.characters.find((c) => c.ownerId === user.id) : undefined
  const pointerName = useMemo(
    () => ({ userId: user.id, name: character?.name ?? 'A player' }),
    [user.id, character?.name],
  )
  const pointers = useMapPointers(campaignId, pointerName)
  const ready = members.status === 'ready' && party.status === 'ready'

  useEffect(() => {
    if (!ready) return
    if (!me) navigate(`/c/${campaignId}`, { replace: true })
    else if (me.role === 'dm') navigate(`/c/${campaignId}/dm`, { replace: true })
    else if (!character) navigate(`/c/${campaignId}/character/new`, { replace: true })
  }, [ready, me, character, campaignId])

  useEffect(() => {
    if (character) document.title = `${character.name} · D&D Table`
  }, [character])

  if (members.status === 'error' || party.status === 'error') {
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Something went wrong" title="The table didn't open" />
        <Notice tone="error">
          {members.status === 'error' ? members.message : party.status === 'error' ? party.message : ''}
        </Notice>
      </Page>
    )
  }
  if (!ready || !me || !character || party.status !== 'ready') return <LoadingScreen />

  const diceStyle = chosenStyle ?? parseDiceStyle(me.dice_style)
  function changeDiceStyle(style: DiceStyle) {
    setChosenStyle(style)
    setStyleError(null)
    saveDiceStyle(campaignId, user.id, style).catch((error: unknown) => setStyleError(messageFor(error)))
  }

  return (
    <TableView
      campaignId={campaignId}
      me={me}
      character={character}
      members={members.data}
      characters={party.characters}
      online={online}
      onUpdate={party.update}
      saveError={party.saveError ?? styleError ?? fight.error ?? tokens.error}
      diceStyle={diceStyle}
      onDiceStyleChange={changeDiceStyle}
      asking={asking}
      stageImage={stageImage}
      audio={audio}
      combat={{
        fight: fight.fight,
        rollInitiative: fight.rollInitiative,
        endTurn: fight.next,
        events: fight.events,
        attack: fight.attack,
        act: fight.act,
        prompts: fight.prompts,
        strike: fight.strike,
        letGo: fight.letGo,
        deathSave: fight.deathSave,
        cast: fight.cast,
        concentrationSave: fight.concentrationSave,
        applyFeature: fight.applyFeature,
        takeBack: fight.takeBack,
        areas: areas.areas,
        map: battleMap,
        tokens,
        playersMove: stage.playersMoveTokens,
        pointers,
      }}
    />
  )
}
