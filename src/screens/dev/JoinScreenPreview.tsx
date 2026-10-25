// Local development only (the routes exist only under `npm run dev`): screens with made-up people,
// so their look can be checked without signing in. Buttons that save won't work here.
import type { User } from '@supabase/supabase-js'
import { useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import { newBuild, type Character } from '../../rules/character.ts'
import { CampaignView } from '../campaign/CampaignScreen.tsx'
import { CharacterForm } from '../character/CharacterForm.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { TableView } from '../table/TableView.tsx'
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

/** #/dev/table: the table screen. Trackers change on screen but aren't saved. */
export function TablePreview() {
  const [characters, setCharacters] = useState<Character[]>(sampleCharacters)
  const update = (id: string, patch: TrackerPatch) =>
    setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
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
