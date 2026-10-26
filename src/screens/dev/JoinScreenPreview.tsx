// Local development only (the routes exist only under `npm run dev`): screens with made-up people,
// so their look can be checked without signing in. Buttons that save won't work here.
import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import { localRoll } from '../../dice/localRoll.ts'
import { parseDiceStyle, type DiceStyle } from '../../dice/style.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { Token } from '../../live/combat.ts'
import { newBuild, type Character } from '../../rules/character.ts'
import { feetBetween } from '../../rules/combat.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { movementLeft } from '../../rules/turn.ts'
import { CampaignView } from '../campaign/CampaignScreen.tsx'
import { CharacterForm } from '../character/CharacterForm.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { TableView } from '../table/TableView.tsx'
import { judgePreview, previewAnswer, previewRequest, usePreviewAsking } from './previewAsking.ts'
import { sampleFight, usePreviewFight } from './previewFight.ts'
import { previewMap, previewMapTokens, usePreviewTokens } from './previewTokens.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from './sampleData.ts'
import { useSrd } from '../../live/useSrd.ts'
import { loadBackgrounds, loadClasses, loadRaces } from '../../rules/srd/index.ts'

const online = new Set(['dm', 'p1'])
const noop = () => {}

function SignedInAs({ userId, children }: { userId: string; children: ReactNode }) {
  const signedIn: AuthState = { status: 'signedIn', user: { id: userId } as User }
  return <AuthContext.Provider value={signedIn}>{children}</AuthContext.Provider>
}

/** #/dev/join/dm, #/dev/join/player and #/dev/join/new (a player with no character yet). */
export function JoinScreenPreview({ as }: { as: string }) {
  const me = sampleMembers.find((member) => member.user_id === (as === 'dm' ? 'dm' : 'p1')) ?? sampleMembers[1]
  return (
    <SignedInAs userId={me.user_id}>
      <CampaignView
        table={sampleCampaign}
        members={sampleMembers}
        me={me}
        characters={as === 'new' ? [] : sampleCharacters}
        online={online}
        siteUrl="http://localhost:5180/dnd-table/"
        onCampaignChanged={noop}
        onMembersChanged={noop}
      />
    </SignedInAs>
  )
}

/**
 * #/dev/table: the table screen. Trackers change on screen but aren't saved. #/dev/table/asked opens
 * with the DM asking for a Constitution save (DC 15, secret), which Elowen has already rolled.
 * #/dev/table/reaction: on Goblin A's turn it has just stepped away from Thorin, who may strike.
 * #/dev/table/dying: Thorin's turn at 0 hit points, with one death save failed.
 */
export function TablePreview({
  asked = false,
  fighting = false,
  variant = null,
}: {
  asked?: boolean
  fighting?: boolean
  variant?: 'reaction' | 'dying' | null
}) {
  const [characters, setCharacters] = useState<Character[]>(() =>
    variant === 'dying'
      ? sampleCharacters.map((c, i) =>
          i === 0 ? { ...c, currentHp: 0, deathSaveFailures: 1, conditions: [...c.conditions, 'unconscious'] } : c,
        )
      : sampleCharacters,
  )
  const [diceStyle, setDiceStyle] = useState<DiceStyle>(() => parseDiceStyle(sampleMembers[1].dice_style))
  const [start] = useState(() => {
    if (!asked) return { request: null, answers: [] }
    const request = previewRequest(sampleCharacters.map((c) => c.id))
    return { request, answers: [previewAnswer(sampleCharacters[1], request, 15)] }
  })
  const asking = usePreviewAsking(sampleCharacters, { start: start.request, startAnswers: start.answers })
  // #/dev/table/fight: Thorin's turn against two goblins on a made-up battle map.
  const [fightStart] = useState(() => {
    if (!fighting) return null
    const sample = sampleFight(sampleCharacters)
    if (variant !== 'reaction') return sample
    return { ...sample, encounter: { ...sample.encounter, currentId: 'goblin-1' } }
  })
  const update = (id: string, patch: TrackerPatch) =>
    setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const fight = usePreviewFight(fightStart, {
    characters,
    onCharacter: update,
    prompts:
      variant === 'reaction' && fightStart
        ? [
            {
              id: 'prompt-preview',
              encounterId: fightStart.encounter.id,
              combatantId: `fighter-${sampleCharacters[0].id}`,
              provokerId: 'goblin-1',
              status: 'open',
              createdAt: fightStart.encounter.startedAt,
            },
          ]
        : [],
  })
  const [map] = useState(() => (fighting ? previewMap() : null))
  const [mapStart] = useState(() =>
    map
      ? previewMapTokens(map.id, fightStart).map((t) =>
          // The goblin has just stepped out of Thorin's reach.
          variant === 'reaction' && t.combatantId === 'goblin-1' ? { ...t, x: t.x + 2 } : t,
        )
      : [],
  )
  // Moves follow the server's rule: on your turn, as far as your movement left. Leaving a goblin's
  // side gives it a chance to strike (which the DM sees).
  // Where everyone stands, for working out who a move leaves behind.
  const placed = useRef<Token[]>([])
  const tokens = usePreviewTokens(map?.id ?? null, mapStart, (token, x, y) => {
    const now = fight.fight
    const who = now?.combatants.find((c) => c.characterId === token.characterId)
    // Before the first turn, everyone places their miniature freely.
    if (!now || !who || now.encounter.currentId === null) return true
    if (now.encounter.currentId !== who.id) return false
    const character = characters.find((c) => c.id === who.characterId)
    const feet = feetBetween(token, { x, y })
    if (feet > movementLeft(who.turn, character?.speed ?? who.speed)) return false
    fight.walk(who.id, feet)
    fight.provoke(who.id, token, { x, y }, placed.current)
    return true
  })
  // The preview throws dice in the browser; there's no database to ask.
  useEffect(() => {
    placed.current = tokens.tokens
  }, [tokens.tokens])
  const thrower = useCallback(
    async (request: RollRequest) =>
      judgePreview(localRoll(request, { campaignId: 'preview', rollerId: 'p1', style: diceStyle }), request, 15),
    [diceStyle],
  )
  return (
    <SignedInAs userId="p1">
      <TableView
        campaignId="preview"
        me={sampleMembers[1]}
        character={characters[0]}
        members={sampleMembers}
        characters={characters}
        online={online}
        onUpdate={update}
        diceStyle={diceStyle}
        onDiceStyleChange={setDiceStyle}
        thrower={thrower}
        asking={asking}
        combat={
          fighting
            ? {
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
                map,
                tokens,
                playersMove: true,
                pointers: { hands: [], pings: [], sendHand: () => {}, sendPing: () => {} },
              }
            : undefined
        }
      />
    </SignedInAs>
  )
}

/** #/dev/character: the character form, filled with the sample fighter. Saving does nothing. */
export function CharacterFormPreview() {
  const srd = { classes: useSrd(loadClasses), races: useSrd(loadRaces), backgrounds: useSrd(loadBackgrounds) }
  const { id: _id, ...build } = sampleCharacters[0]
  return (
    <SignedInAs userId="p1">
      <Page>
        <PageHeader eyebrow="Edit character" title={build.name} subtitle="Preview with made-up data" />
        <CharacterForm
          initial={{ ...newBuild(), ...build }}
          srd={srd}
          saveLabel="Save changes"
          cancelHref="#/dev/table"
          onSave={async () => {}}
        />
      </Page>
    </SignedInAs>
  )
}
