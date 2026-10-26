import { useEffect } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { href } from '../../app/router.ts'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { getCampaign, listMembers } from '../../live/campaigns.ts'
import { listCharacters, saveCharacterBuild } from '../../live/characters.ts'
import { messageFor } from '../../live/errors.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useSrd } from '../../live/useSrd.ts'
import {
  loadBackgrounds,
  loadClasses,
  loadEquipment,
  loadFeatures,
  loadRaces,
  loadSpells,
} from '../../rules/srd/index.ts'
import { ManageView } from './ManageView.tsx'

type ManageScreenProps = { campaignId: string; characterId: string }

/** Change your character: your own, or any in the campaign as the DM. */
export function ManageScreen({ campaignId, characterId }: ManageScreenProps) {
  const user = useSignedInUser()
  const loaded = useLoad(
    () => Promise.all([listMembers(campaignId), listCharacters(campaignId), getCampaign(campaignId)]),
    [campaignId],
  )
  const classes = useSrd(loadClasses)
  const races = useSrd(loadRaces)
  const backgrounds = useSrd(loadBackgrounds)
  const equipment = useSrd(loadEquipment)
  const features = useSrd(loadFeatures)
  const spells = useSrd(loadSpells)

  useEffect(() => {
    document.title = 'Change your character · D&D Table'
  }, [])

  if (loaded.status === 'error') {
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Something went wrong" title="Your character didn't open" />
        <Notice tone="error">{loaded.message}</Notice>
      </Page>
    )
  }
  if (loaded.status !== 'ready' || !classes || !races || !backgrounds || !equipment || !features || !spells) {
    return <LoadingScreen />
  }

  const [members, characters, campaign] = loaded.data
  const isDm = members.find((m) => m.user_id === user.id)?.role === 'dm'
  const character = characters.find((c) => c.id === characterId)
  if (!character || (character.ownerId !== user.id && !isDm)) {
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Character" title="You can't change this character" />
        <Notice tone="error">Players can only change their own character. The DM can change any.</Notice>
        <a href={href(`/c/${campaignId}`)}>Back to the table&rsquo;s front page</a>
      </Page>
    )
  }

  return (
    <ManageView
      character={character}
      data={{ classes, races, backgrounds, equipment, features, spells }}
      exitHref={href(
        character.ownerId === user.id ? `/c/${campaignId}/play` : `/c/${campaignId}/sheet/${character.id}`,
      )}
      formHref={href(`/c/${campaignId}/character/${character.id}/form`)}
      canAddGear={isDm || (campaign?.players_add_gear ?? true)}
      onSave={async (build) => {
        try {
          await saveCharacterBuild(character, build)
          return null
        } catch (caught) {
          return messageFor(caught)
        }
      }}
    />
  )
}
