import { useEffect } from 'react'
import { useSignedInUser } from '../../app/authContext.ts'
import { href, navigate } from '../../app/router.ts'
import { LoadingScreen } from '../../components/LoadingScreen.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { listCharacters, saveCharacterBuild, saveTrackers } from '../../live/characters.ts'
import { messageFor } from '../../live/errors.ts'
import { throwDice } from '../../live/rolls.ts'
import { useLoad } from '../../live/useLoad.ts'
import { useSrd } from '../../live/useSrd.ts'
import type { DieSides } from '../../rules/dice.ts'
import { freeRoll } from '../../rules/rolls.ts'
import { loadClasses, loadFeatures, loadSpells } from '../../rules/srd/index.ts'
import { LevelUpView } from './LevelUpView.tsx'

/** A player takes the level their DM has let them reach. */
export function LevelUpScreen({ campaignId }: { campaignId: string }) {
  const user = useSignedInUser()
  const characters = useLoad(() => listCharacters(campaignId), [campaignId])
  const classes = useSrd(loadClasses)
  const features = useSrd(loadFeatures)
  const spells = useSrd(loadSpells)

  useEffect(() => {
    document.title = 'Level up · D&D Table'
  }, [])

  const back = href(`/c/${campaignId}/play`)
  if (characters.status === 'error') {
    return (
      <Page width="narrow">
        <PageHeader eyebrow="Something went wrong" title="Levelling up didn't open" />
        <Notice tone="error">{characters.message}</Notice>
      </Page>
    )
  }
  if (characters.status !== 'ready' || !classes || !features || !spells) return <LoadingScreen />
  const character = characters.data.find((c) => c.ownerId === user.id)
  const cls = classes.find((c) => c.name.toLowerCase() === character?.className.trim().toLowerCase())
  if (!character || character.levelUpTo === null || character.levelUpTo <= character.level || !cls) {
    return (
      <Page width="narrow">
        <PageHeader
          eyebrow="Level up"
          title={!character ? 'No character yet' : !cls ? 'A class from another book' : 'Not yet'}
        />
        <Notice tone="info">
          {!character
            ? 'Make your character first.'
            : !cls
              ? `Levelling up here works for the free rules' classes. Ask your DM to help you add level ${character.level + 1} on your sheet.`
              : 'Your DM hasn’t let you level up yet. When they do, a gold Level up! appears on your table screen.'}
        </Notice>
        <a href={back}>Back to the table</a>
      </Page>
    )
  }

  return (
    <LevelUpView
      character={character}
      cls={cls}
      features={features}
      spells={spells}
      exitHref={back}
      onRollHp={async () => {
        try {
          const roll = await throwDice(campaignId, {
            ...freeRoll([{ sides: cls.hitDie as DieSides, count: 1 }], { characterId: character.id }),
            label: `Hit points for level ${character.level + 1}`,
          })
          return roll.total
        } catch {
          return null
        }
      }}
      onSave={async (build, gain) => {
        try {
          const saved = await saveCharacterBuild(character, build)
          await saveTrackers(character.id, { currentHp: Math.min(saved.maxHp, character.currentHp + gain) })
          navigate(`/c/${campaignId}/play`, { replace: true })
          return null
        } catch (caught) {
          return messageFor(caught)
        }
      }}
    />
  )
}
