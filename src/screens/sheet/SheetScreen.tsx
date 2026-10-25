import { useEffect, useState } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { href, navigate } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { listMembers } from '../../live/campaigns.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useParty } from '../../live/useParty.ts'
import { SheetPanel, type SheetTabName } from './SheetPanel.tsx'
import styles from './SheetScreen.module.css'

type SheetScreenProps = { campaignId: string; characterId: string }

/** Any character's sheet on its own page: how the DM looks at (and changes) a player's sheet. */
export function SheetScreen({ campaignId, characterId }: SheetScreenProps) {
  const user = useSignedInUser()
  const members = useLoad(() => listMembers(campaignId), [campaignId])
  const party = useParty(campaignId, user.id)
  const [tab, setTab] = useState<SheetTabName>('sheet')

  const character = party.status === 'ready' ? party.characters.find((c) => c.id === characterId) : undefined
  useEffect(() => {
    if (character) document.title = `${character.name} · D&D Table`
  }, [character])

  if (members.status === 'loading' || party.status === 'loading') return <LoadingScreen />
  const error = members.status === 'error' ? members.message : party.status === 'error' ? party.message : null
  if (error || !character || members.status !== 'ready' || party.status !== 'ready') {
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Character sheet" title="This sheet isn't here" />
        <Notice tone="error">{error ?? 'The character may have been deleted, or you are not at this table.'}</Notice>
        <div>
          <ButtonLink href={href(`/c/${campaignId}`)} variant="outline">
            Back to the table&rsquo;s front page
          </ButtonLink>
        </div>
      </Page>
    )
  }

  const me = members.data.find((m) => m.user_id === user.id)
  const canEdit = character.ownerId === user.id || me?.role === 'dm'

  return (
    <main className={styles.screen}>
      <SheetPanel
        className={styles.panel}
        character={character}
        canEdit={canEdit}
        editHref={href(`/c/${campaignId}/character/${character.id}/edit`)}
        tab={tab}
        onTab={setTab}
        onClose={() => navigate(`/c/${campaignId}`)}
        closeLabel="Back"
        onUpdate={(patch) => party.update(character.id, patch)}
      />
      {party.saveError && <Notice tone="error">{party.saveError}</Notice>}
    </main>
  )
}
