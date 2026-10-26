// Local development only: the DM screen with made-up people and rolls (#/dev/dm/party, #/dev/dm/log),
// and every kind of result card side by side (#/dev/dm/moments).
import type { User } from '@supabase/supabase-js'
import { useState } from 'react'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import { localRoll } from '../../dice/localRoll.ts'
import { RollToast } from '../../dice/RollToasts.tsx'
import { DEFAULT_DICE_STYLE, type DiceStyle } from '../../dice/style.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { Roll } from '../../live/rolls.ts'
import type { Character } from '../../rules/character.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { DmView } from '../dm/DmView.tsx'
import { judgePreview, previewAnswer, previewRequest, usePreviewAsking } from './previewAsking.ts'
import { usePreviewEvents, usePreviewNotebook } from './previewNotebook.ts'
import { sampleFight, usePreviewFight } from './previewFight.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from './sampleData.ts'
import styles from './DmPreview.module.css'

const online = new Set(['dm', 'p1'])
const signedIn: AuthState = { status: 'signedIn', user: { id: 'dm' } as User }

function sample(id: string, minutesAgo: number, roll: Partial<Roll>): Roll {
  return {
    id,
    campaignId: 'preview',
    rollerId: 'p1',
    characterId: 'fighter',
    label: 'Perception check',
    kind: 'check',
    mode: 'normal',
    dice: [{ sides: 20, value: 12, dropped: false }],
    modifier: 3,
    parts: [
      { label: 'Wisdom', value: 1 },
      { label: 'Proficiency', value: 2 },
    ],
    total: 15,
    natural: 12,
    damage: null,
    secret: false,
    style: { material: 'glass', colour: 'ruby', numbers: 'gold' },
    createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    requestId: null,
    passed: null,
    passedByDice: null,
    ...roll,
  }
}

// Made when a preview opens (not when the file loads), so the live build can leave all of this out.
function sampleRolls(): Roll[] {
  return [
    sample('crit', 1, {
      label: 'Longsword',
      kind: 'attack',
      dice: [{ sides: 20, value: 20, dropped: false }],
      modifier: 5,
      parts: [
        { label: 'Strength', value: 3 },
        { label: 'Proficiency', value: 2 },
      ],
      total: 25,
      natural: 20,
      damage: {
        dice: [
          { sides: 8, value: 6, dropped: false },
          { sides: 8, value: 3, dropped: false },
        ],
        modifier: 3,
        total: 12,
        type: 'slashing',
        critical: true,
      },
    }),
    sample('fumble', 3, {
      rollerId: 'p2',
      characterId: 'wizard',
      label: 'Stealth check',
      dice: [{ sides: 20, value: 1, dropped: false }],
      modifier: 2,
      parts: [{ label: 'Dexterity', value: 2 }],
      total: 3,
      natural: 1,
      style: { material: 'stone', colour: 'slate', numbers: 'white' },
    }),
    sample('advantage', 6, {
      label: 'Constitution save',
      kind: 'save',
      mode: 'advantage',
      dice: [
        { sides: 20, value: 7, dropped: true },
        { sides: 20, value: 16, dropped: false },
      ],
      modifier: 4,
      parts: [
        { label: 'Constitution', value: 2 },
        { label: 'Proficiency', value: 2 },
      ],
      total: 20,
      natural: 16,
    }),
    sample('secret', 9, {
      rollerId: 'dm',
      characterId: null,
      label: '1d20',
      kind: 'free',
      dice: [{ sides: 20, value: 9, dropped: false }],
      modifier: 0,
      parts: [],
      total: 9,
      natural: 9,
      secret: true,
      style: DEFAULT_DICE_STYLE,
    }),
    sample('fireball', 12, {
      rollerId: 'p2',
      characterId: 'wizard',
      label: '8d6',
      kind: 'free',
      dice: [6, 2, 5, 4, 1, 6, 3, 5].map((value) => ({ sides: 6 as const, value, dropped: false })),
      modifier: 0,
      parts: [],
      total: 32,
      natural: null,
    }),
  ]
}

export function DmPreview({ tab }: { tab: string }) {
  const [characters, setCharacters] = useState<Character[]>(sampleCharacters)
  const [rolls, setRolls] = useState<Roll[]>(sampleRolls)
  const [diceStyle, setDiceStyle] = useState<DiceStyle>(DEFAULT_DICE_STYLE)
  // #/dev/dm/asked opens with a Constitution save out, which Thorin has rolled and Elowen hasn't.
  const [start] = useState(() => {
    if (tab !== 'asked') return { request: null, answers: [] }
    const request = previewRequest(sampleCharacters.map((c) => c.id))
    return { request, answers: [previewAnswer(sampleCharacters[0], request, 15)] }
  })
  const notebook = usePreviewNotebook()
  // #/dev/dm/fight opens with a fight going on.
  const [fightStart] = useState(() => (tab === 'fight' ? sampleFight(sampleCharacters) : null))
  const update = (id: string, patch: TrackerPatch) =>
    setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const fight = usePreviewFight(fightStart, { characters, onCharacter: update })
  const events = usePreviewEvents()
  const asking = usePreviewAsking(characters, {
    start: start.request,
    startAnswers: start.answers,
    answerFor: sampleCharacters.map((c) => c.id),
  })

  if (tab === 'moments') return <Moments />

  const thrower = async (request: RollRequest) => {
    const roll = judgePreview(
      localRoll(request, { campaignId: 'preview', rollerId: 'dm', style: diceStyle }),
      request,
      asking.dc ?? 15,
    )
    setRolls((list) => [roll, ...list])
    return roll
  }

  return (
    <AuthContext.Provider value={signedIn}>
      <DmView
        campaign={sampleCampaign}
        me={sampleMembers[0]}
        members={sampleMembers}
        characters={characters}
        online={online}
        onUpdate={update}
        log={{ status: 'ready', rolls }}
        diceStyle={diceStyle}
        onDiceStyleChange={setDiceStyle}
        thrower={thrower}
        asking={asking}
        notebook={notebook}
        events={events}
        sceneName="Arrive at the tavern"
        fight={fight}
        startTab={tab === 'log' ? 'log' : tab === 'fight' ? 'encounter' : 'party'}
      />
    </AuthContext.Provider>
  )
}

/** Every kind of result card, to check the natural 20 burst and the natural 1 crack. */
function Moments() {
  const names: Record<string, string> = { fighter: 'Thorin Ironfist', wizard: 'Elowen' }
  return (
    <main className={styles.moments}>
      {sampleRolls().map((roll) => (
        <RollToast key={roll.id} roll={roll} who={roll.characterId ? names[roll.characterId] : 'Matt (DM)'} />
      ))}
    </main>
  )
}
