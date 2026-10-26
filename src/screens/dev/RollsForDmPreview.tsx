import { useState } from 'react'
import { DEFAULT_DICE_STYLE } from '../../dice/style.ts'
import type { Roll } from '../../live/rolls.ts'
import { RollsForDm } from '../rolls/RollsForDm.tsx'
import { sampleCharacters } from './sampleData.ts'

/** #/dev/dm-rolls: the DM's card for a roll a player made for them (Thorin, with advantage). */
export function RollsForDmPreview() {
  const [rolls, setRolls] = useState<Roll[]>(() => [
    {
      id: 'preview-for-dm',
      campaignId: 'preview',
      rollerId: sampleCharacters[0].ownerId,
      characterId: sampleCharacters[0].id,
      label: 'A roll for the DM',
      kind: 'check',
      mode: 'advantage',
      dice: [
        { sides: 20, value: 11, dropped: false },
        { sides: 20, value: 4, dropped: true },
      ],
      modifier: 0,
      parts: [],
      total: 11,
      natural: 11,
      damage: null,
      secret: false,
      style: DEFAULT_DICE_STYLE,
      createdAt: new Date().toISOString(),
      requestId: null,
      passed: null,
      passedByDice: null,
      forDm: true,
    },
  ])
  return (
    <main style={{ minHeight: '100vh', padding: 40, background: 'var(--bg-page)' }}>
      <RollsForDm
        rolls={rolls}
        characters={sampleCharacters}
        onSettle={(roll) => setRolls((now) => now.filter((r) => r.id !== roll.id))}
      />
    </main>
  )
}
