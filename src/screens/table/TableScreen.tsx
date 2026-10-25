import { useEffect } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { navigate } from '../../app/router.ts'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { useOnlineIds } from '../../live/campaignChannel.ts'
import { listMembers } from '../../live/campaigns.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useParty } from '../../live/useParty.ts'
import { TableView } from './TableView.tsx'

/**
 * The player's table screen. The DM's screens come in milestone 5, so the DM is sent back to the
 * Join screen; a player without a character is sent to make one.
 */
export function TableScreen({ campaignId }: { campaignId: string }) {
  const user = useSignedInUser()
  const members = useLoad(() => listMembers(campaignId), [campaignId])
  const party = useParty(campaignId, user.id)
  const online = useOnlineIds(campaignId, user.id)

  const me = members.status === 'ready' ? members.data.find((m) => m.user_id === user.id) : undefined
  const character = party.status === 'ready' ? party.characters.find((c) => c.ownerId === user.id) : undefined
  const ready = members.status === 'ready' && party.status === 'ready'

  useEffect(() => {
    if (!ready) return
    if (!me || me.role === 'dm') navigate(`/c/${campaignId}`, { replace: true })
    else if (!character) navigate(`/c/${campaignId}/character/new`, { replace: true })
  }, [ready, me, character, campaignId])

  useEffect(() => {
    if (character) document.title = `${character.name} · D&D Table`
  }, [character])

  if (members.status === 'error' || party.status === 'error') {
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Something went wrong" title="The table didn't open" />
        <Notice tone="error">{members.status === 'error' ? members.message : party.status === 'error' ? party.message : ''}</Notice>
      </Page>
    )
  }
  if (!ready || !me || !character || party.status !== 'ready') return <LoadingScreen />

  return (
    <TableView
      campaignId={campaignId}
      me={me}
      character={character}
      members={members.data}
      characters={party.characters}
      online={online}
      onUpdate={party.update}
      saveError={party.saveError}
    />
  )
}
