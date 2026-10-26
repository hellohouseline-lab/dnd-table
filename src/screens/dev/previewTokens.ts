// Local development only: tokens on a battle map in the design previews, kept in this tab.

import { useState } from 'react'
import type { Token } from '../../live/combat.ts'
import type { Asset } from '../../live/library.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { TokenControls } from '../../live/useFight.ts'

/** A made-up battle map, drawn here: stone floor, a few tables and a bar. */
export function previewMap(): Asset {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 840
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = '#2e2620'
    g.fillRect(0, 0, 1400, 840)
    g.fillStyle = '#4a3a2a'
    for (let i = 0; i < 9; i++) g.fillRect(140 + (i % 3) * 360, 160 + Math.floor(i / 3) * 220, 140, 70)
    g.fillStyle = '#5c3b22'
    g.fillRect(1120, 70, 210, 700)
  }
  return {
    id: 'preview-map',
    campaignId: 'preview',
    kind: 'art',
    category: 'maps',
    mood: null,
    name: 'Tavern floor',
    path: canvas.toDataURL('image/png'),
    thumbPath: null,
    sizeBytes: 0,
    streamSafe: true,
    credit: '',
    hotkey: null,
    createdAt: new Date().toISOString(),
    grid: { size: 70, offsetX: 0, offsetY: 0 },
  }
}

/** The party and the fight's monsters, placed on the made-up map. */
export function previewMapTokens(mapId: string, fight: FightControls['fight']): Token[] {
  const base = { campaignId: 'preview', mapId, hidden: false }
  return [
    { ...base, id: 'pt-1', characterId: 'fighter', combatantId: null, x: 6, y: 5 },
    { ...base, id: 'pt-2', characterId: 'wizard', combatantId: null, x: 4, y: 7 },
    ...(fight?.combatants ?? [])
      .filter((c) => c.kind === 'monster')
      .map((c, i) => ({ ...base, id: `mt-${i}`, characterId: null, combatantId: c.id, x: 11 + i, y: 4 + i * 2 })),
  ]
}

let made = 0

/** `onMove` can refuse a move, as the server does (too far, or not your turn). */
export function usePreviewTokens(
  mapId: string | null,
  start: Token[] = [],
  onMove?: (token: Token, x: number, y: number) => boolean,
): TokenControls {
  const [tokens, setTokens] = useState<Token[]>(start)
  const onMap = tokens.filter((t) => t.mapId === mapId)
  const change = (id: string, patch: Partial<Token>) =>
    setTokens((now) => now.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  return {
    tokens: onMap,
    error: null,
    move: (token, x, y) => {
      if (onMove && !onMove(token, x, y)) {
        // Refused: show it moving, then put it back, as the real screen does.
        change(token.id, { x, y })
        setTimeout(() => change(token.id, { x: token.x, y: token.y }), 0)
        return
      }
      change(token.id, { x, y })
    },
    place: async (list) => {
      if (!mapId) return
      setTokens((now) => [
        ...now,
        ...list.map((t) => ({
          id: `token-${made++}`,
          campaignId: 'preview',
          mapId,
          characterId: t.characterId ?? null,
          combatantId: t.combatantId ?? null,
          x: t.x,
          y: t.y,
          hidden: t.hidden ?? false,
        })),
      ])
    },
    setHidden: (token, hidden) => change(token.id, { hidden }),
    remove: (token) => setTokens((now) => now.filter((t) => t.id !== token.id)),
  }
}
