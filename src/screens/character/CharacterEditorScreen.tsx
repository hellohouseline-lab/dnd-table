import { useEffect } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { href, navigate } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { SiteFooter } from '../../components/SiteFooter.tsx'
import { listMembers } from '../../live/campaigns.ts'
import { createCharacter, listCharacters, saveCharacterBuild } from '../../live/characters.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useSrd } from '../../live/useSrd.ts'
import { newBuild, type Character, type CharacterBuild } from '../../rules/character.ts'
import { loadBackgrounds, loadClasses, loadRaces } from '../../rules/srd/index.ts'
import { CharacterForm } from './CharacterForm.tsx'

type EditorProps = { campaignId: string; characterId?: string }

/**
 * Create your character (no characterId) or edit one: your own, or any as the DM.
 * Phase 1 has no wizard, so this is the plain "type your sheet in" form.
 */
export function CharacterEditorScreen({ campaignId, characterId }: EditorProps) {
  const user = useSignedInUser()
  const data = useLoad(() => Promise.all([listMembers(campaignId), listCharacters(campaignId)]), [campaignId])
  const srd = {
    classes: useSrd(loadClasses),
    races: useSrd(loadRaces),
    backgrounds: useSrd(loadBackgrounds),
  }

  const [members, characters] = data.status === 'ready' ? data.data : [[], []]
  const me = members.find((m) => m.user_id === user.id)
  const isDm = me?.role === 'dm'
  const mine = characters.find((c) => c.ownerId === user.id)
  const editing = characterId ? characters.find((c) => c.id === characterId) : undefined

  // Someone making a second character is sent to edit their first instead.
  useEffect(() => {
    if (data.status === 'ready' && !characterId && mine) {
      navigate(`/c/${campaignId}/character/${mine.id}/edit`, { replace: true })
    }
  }, [data.status, characterId, mine, campaignId])

  if (data.status === 'loading' || (!characterId && mine)) return <LoadingScreen />
  if (data.status === 'error') return <Problem title="The form didn't open" message={data.message} campaignId={campaignId} />

  if (!me || (characterId && !editing) || (editing && editing.ownerId !== user.id && !isDm) || (!characterId && isDm)) {
    return (
      <Problem
        title="You can't change this character"
        message={
          !characterId && isDm
            ? 'Players make their own characters. Ask them to open the table and choose Create your character.'
            : 'Players can only change their own character. The DM can change any.'
        }
        campaignId={campaignId}
      />
    )
  }

  const backTo = editing && editing.ownerId !== user.id ? `/c/${campaignId}/sheet/${editing.id}` : `/c/${campaignId}/play`

  async function save(build: CharacterBuild) {
    if (editing) await saveCharacterBuild(editing, build)
    else await createCharacter(campaignId, user.id, build)
    navigate(backTo, { replace: true })
  }

  return (
    <Page>
      <PageHeader
        eyebrow={editing ? 'Edit character' : 'Your character'}
        title={editing?.name ?? 'A new character'}
        subtitle="Type in your character. The table works out every bonus for you."
      />
      <CharacterForm
        initial={editing ? toBuild(editing) : newBuild()}
        srd={srd}
        character={editing}
        saveLabel={editing ? 'Save changes' : 'Save and take your seat'}
        cancelHref={href(editing ? backTo : `/c/${campaignId}`)}
        onSave={save}
      />
      <SiteFooter />
    </Page>
  )
}

function toBuild(character: Character): CharacterBuild {
  const {
    id: _id,
    campaignId: _campaignId,
    ownerId: _ownerId,
    currentHp: _currentHp,
    tempHp: _tempHp,
    hitDiceUsed: _hitDiceUsed,
    deathSaveSuccesses: _deathSaveSuccesses,
    deathSaveFailures: _deathSaveFailures,
    stable: _stable,
    dead: _dead,
    conditions: _conditions,
    exhaustion: _exhaustion,
    inspiration: _inspiration,
    concentration: _concentration,
    portraitPath: _portraitPath,
    updatedAt: _updatedAt,
    ...build
  } = character
  return build
}

function Problem({ title, message, campaignId }: { title: string; message: string; campaignId: string }) {
  return (
    <Page width="narrow">
      <PageHeader eyebrow="Character" title={title} />
      <Notice tone="error">{message}</Notice>
      <div>
        <ButtonLink href={href(`/c/${campaignId}`)} variant="outline">
          Back to the table&rsquo;s front page
        </ButtonLink>
      </div>
      <SiteFooter />
    </Page>
  )
}
