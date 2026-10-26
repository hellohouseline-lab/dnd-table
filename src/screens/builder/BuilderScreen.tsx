import { useEffect } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { href } from '../../app/router.ts'
import { getCampaign, listMembers } from '../../live/campaigns.ts'
import { listCharacters } from '../../live/characters.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useSrd } from '../../live/useSrd.ts'
import { loadRaces, loadSpells } from '../../rules/srd/index.ts'
import { BuilderView } from './BuilderView.tsx'
import { useDraft } from './useDraft.ts'

/**
 * The character builder on the live site. While it's being built (C2b to C2e) anyone at the table
 * can open it to try the steps so far; nothing is saved to the table yet, only kept in the browser.
 */
export function BuilderScreen({ campaignId }: { campaignId: string }) {
  const user = useSignedInUser()
  const data = useLoad(
    () => Promise.all([getCampaign(campaignId), listMembers(campaignId), listCharacters(campaignId)]),
    [campaignId],
  )
  const races = useSrd(loadRaces)
  const spells = useSrd(loadSpells)
  const [draft, setDraft] = useDraft(`dnd-table-builder-${campaignId}-${user.id}`)

  const [campaign, members, characters] = data.status === 'ready' ? data.data : [null, [], []]
  const me = members.find((m) => m.user_id === user.id)
  const hasCharacter = characters.some((c) => c.ownerId === user.id)

  useEffect(() => {
    document.title = 'Make your character · D&D Table'
  }, [])

  return (
    <BuilderView
      draft={draft}
      onDraft={setDraft}
      races={races}
      spells={spells}
      campaignName={campaign?.name}
      exitHref={href(`/c/${campaignId}/${me?.role === 'dm' ? 'dm' : 'play'}`)}
      formHref={me?.role === 'player' && !hasCharacter ? href(`/c/${campaignId}/character/new`) : null}
    />
  )
}
