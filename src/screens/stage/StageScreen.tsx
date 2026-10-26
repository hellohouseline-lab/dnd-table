import { useEffect, useMemo, useState } from 'react'
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
import {
  addStarterMap,
  deleteAsset,
  updateAsset,
  uploadArt,
  uploadSound,
  type Asset,
  type AssetPatch,
} from '../../live/library.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useParty } from '../../live/useParty.ts'
import { useLibrary, useStage } from '../../live/useStage.ts'
import { useFight, useMapPointers, useTokens } from '../../live/useFight.ts'
import { useRollRequest } from '../../live/useRollRequest.ts'
import { useAreas } from '../../live/areas.ts'
import { heal, takeDamage } from '../../rules/maths/hitPoints.ts'
import type { Character } from '../../rules/character.ts'
import { BattleView } from '../battle/BattleView.tsx'
import { StageView, type LibraryActions } from './StageView.tsx'
import { useRollsForDm } from '../../live/useRollsForDm.ts'
import { RollsForDm } from '../rolls/RollsForDm.tsx'
import styles from './StageScreen.module.css'

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
  const fight = useFight(campaignId, user.id)
  const tokens = useTokens(campaignId, user.id, stage.stage.mapId)
  const areas = useAreas(campaignId, user.id, stage.stage.mode === 'map' ? stage.stage.mapId : null)
  const asking = useRollRequest(campaignId, user.id, true)
  const forDm = useRollsForDm(campaignId, user.id)

  const me = members.status === 'ready' ? members.data.find((m) => m.user_id === user.id) : undefined
  const pointerName = useMemo(() => ({ userId: user.id, name: me ? `${me.display_name} (DM)` : 'DM' }), [user.id, me])
  const pointers = useMapPointers(campaignId, pointerName)
  // In a fight this screen is the Battle screen, unless the DM chose to look at the stage for a moment.
  const [stageDuring, setStageDuring] = useState<string | null>(null)
  const fighting = fight.fight
  const battle = fighting !== null && stageDuring !== fighting.encounter.id
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
    addStarter: (starter) => addStarterMap(campaignId, starter),
  }

  function changeHp(character: Character, change: number) {
    const before = { current: character.currentHp, max: character.maxHp, temp: character.tempHp }
    const after = change < 0 ? takeDamage(before, -change) : heal(before, change)
    if (party.status === 'ready') party.update(character.id, { currentHp: after.current, tempHp: after.temp })
  }

  function changeGrid(map: Asset, patch: AssetPatch) {
    library.put({ ...map, ...patch })
    void updateAsset(map.id, patch).then(library.put, () => undefined)
  }

  if (battle && fighting) {
    return (
      <BattleView
        campaignId={campaignId}
        campaignName={campaign.data.name}
        me={me}
        members={members.data}
        characters={party.characters}
        online={online}
        fight={fighting}
        controls={fight}
        tokens={tokens}
        stage={stage}
        maps={library.assets.filter((a) => a.kind === 'art' && a.category === 'maps')}
        pointers={pointers}
        onCharacterHp={changeHp}
        onUpdate={(id, patch) => party.status === 'ready' && party.update(id, patch)}
        asking={asking}
        areas={areas}
        onGrid={changeGrid}
        onAddStarter={async (starter) => {
          const added = await addStarterMap(campaignId, starter)
          library.put(added)
          return added
        }}
        onShowStage={() => setStageDuring(fighting.encounter.id)}
      />
    )
  }

  return (
    <>
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
        map={{ tokens, fight: fight.fight, pointers }}
        onBattle={fighting ? () => setStageDuring(null) : undefined}
      />
      <RollsForDm className={styles.forDm} rolls={forDm.rolls} characters={party.characters} onSettle={forDm.settle} />
    </>
  )
}
