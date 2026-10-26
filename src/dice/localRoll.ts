// Rolls thrown in the browser rather than by the server: practice throws to try out a dice look,
// and the dev previews, which have no database. Nothing here is saved or seen by anyone else.

import type { Roll } from '../live/rolls.ts'
import { secureDraw, settleRoll, type Draw, type RollRequest } from '../rules/dice.ts'
import type { DiceStyle } from './style.ts'

let practiceCount = 0

export function localRoll(
  request: RollRequest,
  who: { campaignId: string; rollerId: string; style: DiceStyle },
  draw: Draw = secureDraw,
): Roll {
  practiceCount += 1
  return {
    ...settleRoll(request, draw),
    id: `local-${practiceCount}-${Date.now()}`,
    campaignId: who.campaignId,
    rollerId: who.rollerId,
    characterId: request.characterId,
    label: request.label,
    kind: request.kind,
    mode: request.mode,
    modifier: request.modifier,
    parts: request.parts,
    secret: request.secret,
    style: who.style,
    createdAt: new Date().toISOString(),
  }
}

/** One of each die, to show off a dice look. */
export const PRACTICE_SET: RollRequest = {
  label: 'Practice throw',
  kind: 'free',
  characterId: null,
  dice: [
    { sides: 20, count: 1 },
    { sides: 12, count: 1 },
    { sides: 10, count: 1 },
    { sides: 8, count: 1 },
    { sides: 6, count: 1 },
    { sides: 4, count: 1 },
  ],
  modifier: 0,
  parts: [],
  mode: 'normal',
  damage: null,
  secret: false,
}
