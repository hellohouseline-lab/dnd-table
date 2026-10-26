import { lazy, Suspense, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { Asset, AssetPatch } from '../../live/library.ts'
import type { FightControls, Pointer, TokenControls } from '../../live/useFight.ts'
import type { Character } from '../../rules/character.ts'
import { freeSquares, mapTokens } from '../../map/mapTokens.ts'
import styles from './StageView.module.css'

const BattleMap = lazy(() => import('../../map/BattleMap.tsx'))

type MapStageProps = {
  map: Asset
  tokens: TokenControls
  fight: FightControls['fight']
  characters: Character[]
  userId: string
  playersMove: boolean
  pointers: {
    hands: Pointer[]
    pings: (Pointer & { id: number })[]
    sendHand: (x: number, y: number) => void
    sendPing: (x: number, y: number) => void
  }
  onGrid: (patch: AssetPatch) => void
}

const GRID_STEP = 2

/** The battle map on the stage, as the DM sees it: every token, real names, and the grid controls. */
export function MapStage({ map, tokens, fight, characters, userId, playersMove, pointers, onGrid }: MapStageProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const combatants = fight?.combatants ?? []
  const view = mapTokens(
    tokens.tokens,
    { characters, combatants, secrets: fight?.secrets ?? [], currentId: fight?.encounter.currentId ?? null },
    { userId, isDm: true, playersMove },
  )
  const chosen = tokens.tokens.find((t) => t.id === selected)
  const chosenView = view.find((t) => t.id === selected)
  const partyMissing = characters.filter((c) => !tokens.tokens.some((t) => t.characterId === c.id))
  const monstersMissing = combatants.filter(
    (c) => c.kind === 'monster' && c.health !== 'down' && !tokens.tokens.some((t) => t.combatantId === c.id),
  )
  const grid = map.grid

  function place(kind: 'party' | 'monsters') {
    const squares = freeSquares(
      tokens.tokens,
      kind === 'party' ? partyMissing.length : monstersMissing.length,
      kind === 'party' ? 1 : 4,
    )
    void tokens.place(
      kind === 'party'
        ? partyMissing.map((c, i) => ({ characterId: c.id, ...squares[i] }))
        : monstersMissing.map((c, i) => ({ combatantId: c.id, ...squares[i] })),
    )
  }

  const nudge = (patch: Partial<Asset['grid']>) => onGrid({ grid: { ...grid, ...patch } })

  return (
    <>
      <div className={styles.screenPreview}>
        <Suspense fallback={<div className={styles.nothing}>Opening the map…</div>}>
          <BattleMap
            map={map}
            tokens={view}
            selectedId={selected}
            onSelect={setSelected}
            onMove={(id, x, y) => {
              const token = tokens.tokens.find((t) => t.id === id)
              if (token) tokens.move(token, x, y)
            }}
            hands={pointers.hands}
            pings={pointers.pings}
            onHand={pointers.sendHand}
            onPing={pointers.sendPing}
          />
        </Suspense>
      </div>
      <div className={styles.mapTools}>
        <div className={styles.gridTools} aria-label="Line up the grid">
          <span className={styles.toolLabel}>Squares</span>
          <button
            type="button"
            className={styles.tool}
            aria-label="Smaller squares"
            onClick={(e) => nudge({ size: grid.size - (e.shiftKey ? 10 : GRID_STEP) })}
          >
            −
          </button>
          <span className={styles.toolValue}>{grid.size}px</span>
          <button
            type="button"
            className={styles.tool}
            aria-label="Bigger squares"
            onClick={(e) => nudge({ size: grid.size + (e.shiftKey ? 10 : GRID_STEP) })}
          >
            +
          </button>
          <span className={styles.toolLabel}>Nudge</span>
          <button
            type="button"
            className={styles.tool}
            aria-label="Grid left"
            onClick={() => nudge({ offsetX: grid.offsetX - GRID_STEP })}
          >
            ←
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Grid right"
            onClick={() => nudge({ offsetX: grid.offsetX + GRID_STEP })}
          >
            →
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Grid up"
            onClick={() => nudge({ offsetY: grid.offsetY - GRID_STEP })}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Grid down"
            onClick={() => nudge({ offsetY: grid.offsetY + GRID_STEP })}
          >
            ↓
          </button>
        </div>
        <div className={styles.gridTools}>
          <button
            type="button"
            className={styles.control}
            disabled={partyMissing.length === 0}
            onClick={() => place('party')}
          >
            Add the party{partyMissing.length > 0 ? ` (${partyMissing.length})` : ''}
          </button>
          <button
            type="button"
            className={styles.control}
            disabled={monstersMissing.length === 0}
            title={fight ? undefined : 'Start a fight on Screen 1 to add monsters'}
            onClick={() => place('monsters')}
          >
            Place the monsters{monstersMissing.length > 0 ? ` (${monstersMissing.length})` : ''}
          </button>
        </div>
        {chosen && chosenView && (
          <div className={cx(styles.gridTools, styles.tokenTools)}>
            <span className={styles.toolLabel}>{chosenView.name}</span>
            <button type="button" className={styles.control} onClick={() => tokens.setHidden(chosen, !chosen.hidden)}>
              {chosen.hidden ? 'Show to players' : 'Hide from players'}
            </button>
            <button
              type="button"
              className={styles.control}
              onClick={() => {
                tokens.remove(chosen)
                setSelected(null)
              }}
            >
              Take off the map
            </button>
          </div>
        )}
        {tokens.error && <p className={styles.hint}>{tokens.error}</p>}
      </div>
    </>
  )
}
