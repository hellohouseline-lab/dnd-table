// Local development only: Screen 2 in a fight (#/dev/battle), with made-up people, two goblins and a
// made-up map. Attacks, actions, Undo, moves and opportunity attacks follow the server's rules
// closely enough to try: it's Thorin's turn, and walking him away from Goblin A gives it a chance.

import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import { localRoll } from '../../dice/localRoll.ts'
import { DEFAULT_DICE_STYLE } from '../../dice/style.ts'
import type { CombatEvent, Token } from '../../live/combat.ts'
import { emptyStage, type Stage, type StagePatch } from '../../live/stage.ts'
import type { Character } from '../../rules/character.ts'
import { feetBetween } from '../../rules/combat.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { BattleView } from '../battle/BattleView.tsx'
import { usePreviewAsking } from './previewAsking.ts'
import { usePreviewAreas } from './previewAreas.ts'
import { sampleFight, usePreviewFight } from './previewFight.ts'
import { previewMap, previewMapTokens, previewPortrait, usePreviewTokens } from './previewTokens.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from './sampleData.ts'

const online = new Set(['dm', 'p1'])
const signedIn: AuthState = { status: 'signedIn', user: { id: 'dm' } as User }

/** Thorin has just tried to scare both goblins off; Goblin B is nearly dead (#/dev/battle/talk). */
function talkFight() {
  const sample = sampleFight(sampleCharacters)
  const thorin = sample.combatants[0]
  const fight = {
    ...sample,
    combatants: sample.combatants.map((c) =>
      c.id === thorin.id
        ? { ...c, turn: { ...c.turn, actionUsed: true } }
        : c.id === 'goblin-2'
          ? { ...c, health: 'near-death' as const }
          : c,
    ),
    secrets: sample.secrets.map((s) => (s.combatantId === 'goblin-2' ? { ...s, hp: 1 } : s)),
  }
  const card: CombatEvent = {
    id: 'talk-card',
    encounterId: sample.encounter.id,
    round: 1,
    actorId: thorin.id,
    targetId: null,
    kind: 'talk',
    rollId: null,
    shown: {
      talk: 'intimidation',
      targets: ['goblin-1', 'goblin-2'],
      words: 'Drop your weapons and run, or you join your friends.',
      total: 16,
    },
    undone: false,
    seq: 0,
    createdAt: new Date().toISOString(),
  }
  return { fight, events: [card] }
}

/**
 * #/dev/battle: Thorin's turn against two goblins. #/dev/battle/talk: the same, with Thorin's
 * Intimidation waiting on a talk card, and Goblin B nearly dead (the morale nudge).
 */
export function BattlePreview({ talk = false, late = false }: { talk?: boolean; late?: boolean }) {
  // Thorin has a portrait, to see it in his token.
  const [characters, setCharacters] = useState<Character[]>(() =>
    sampleCharacters.map((c, i) => (i === 0 ? { ...c, portraitPath: previewPortrait() } : c)),
  )
  const [map] = useState(previewMap)
  const [stage, setStage] = useState<Stage>(() => ({ ...emptyStage('preview'), mapId: map.id, mode: 'map' }))
  const change = useCallback((patch: StagePatch) => setStage((now) => ({ ...now, ...patch })), [])
  const areas = usePreviewAreas(map.id)
  const update = (id: string, patch: Partial<Character>) => {
    setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    // Lost it, or a failed save: the spell's area goes too.
    if (patch.concentration === null) areas.endConcentration(id)
  }
  const [{ fight: fightStart, events }] = useState(() =>
    talk
      ? talkFight()
      : // #/dev/battle/late: Elowen arrived after the fight started.
        { fight: sampleFight(late ? sampleCharacters.slice(0, 1) : sampleCharacters), events: [] },
  )
  const fight = usePreviewFight(fightStart, { characters, onCharacter: update, onArea: areas.fromSpell, events })
  // Made-up players answer a roll the DM asks for a moment after it's sent.
  const asking = usePreviewAsking(characters, { answerFor: sampleCharacters.map((c) => c.id) })
  // Moving the creature whose turn it is counts its feet, as on the server; the DM is never stopped.
  // Where everyone stands, for working out who a move leaves behind.
  const placed = useRef<Token[]>([])
  const tokens = usePreviewTokens(map.id, previewMapTokens(map.id, fightStart), (token, x, y) => {
    const now = fight.fight
    const who = now?.combatants.find((c) =>
      token.characterId ? c.characterId === token.characterId : c.id === token.combatantId,
    )
    if (now && who && now.encounter.currentId === who.id) {
      fight.walk(who.id, feetBetween(token, { x, y }))
      fight.provoke(who.id, token, { x, y }, placed.current)
    }
    return true
  })
  useEffect(() => {
    placed.current = tokens.tokens
  }, [tokens.tokens])
  const thrower = useCallback(
    async (request: RollRequest) =>
      localRoll(request, { campaignId: 'preview', rollerId: 'dm', style: DEFAULT_DICE_STYLE }),
    [],
  )

  if (!fight.fight) {
    return <p style={{ padding: 40 }}>The fight is over. Reload to start again.</p>
  }
  return (
    <AuthContext.Provider value={signedIn}>
      <BattleView
        campaignId="preview"
        campaignName={sampleCampaign.name}
        me={sampleMembers[0]}
        members={sampleMembers}
        characters={characters}
        online={online}
        fight={fight.fight}
        controls={fight}
        tokens={tokens}
        stage={{ stage, change, error: null }}
        maps={[map]}
        pointers={{ hands: [], pings: [], sendHand: () => {}, sendPing: () => {} }}
        onCharacterHp={(character, by) =>
          update(character.id, { currentHp: Math.max(0, Math.min(character.maxHp, character.currentHp + by)) })
        }
        onUpdate={update}
        asking={asking}
        areas={areas}
        onGrid={() => undefined}
        onShowStage={() => undefined}
        thrower={thrower}
      />
    </AuthContext.Provider>
  )
}
