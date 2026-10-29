import { lazy, Suspense, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { Asset, AssetPatch } from '../../live/library.ts'
import type { Token } from '../../live/combat.ts'
import type { FightControls, Pointer, TokenControls } from '../../live/useFight.ts'
import type { Character } from '../../rules/character.ts'
import { freeSquares, mapTokens } from '../../map/mapTokens.ts'
import { feetBetween } from '../../rules/combat.ts'
import { movementLeft, type Reach } from '../../rules/turn.ts'
import type { MapArea, MapInset, MapPlacing } from '../../map/BattleMap.tsx'
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
  /** The Battle screen: the map fills the space it's given. */
  className?: string
  /** Tuck the grid tools and Add the party behind a Map tools button (the Battle screen, where the map fills the screen). */
  foldTools?: boolean
  /** Room taken by panels floating over the map (the Battle screen). */
  inset?: MapInset
  /** For the grid and token tools under the map (the Battle screen floats them over it). */
  toolsClassName?: string
  /** Picking a target: clicking a miniature picks it. */
  targeting?: { onPick: (token: Token) => void } | null
  /** An attack being aimed: who from, and how far it reaches. */
  aim?: { attackerId: string; reach: Reach } | null
  /** Areas on the map, and clicking one (to take it off). */
  areas?: MapArea[]
  onAreaClick?: (id: string) => void
  /** Putting an area down: where it starts from (a combatant, for a cone), and what happens when it's placed. */
  placing?: (Omit<MapPlacing, 'from'> & { fromId: string | null }) | null
  /** Play as the monsters: the acting creature's moves count, and going past its speed asks first. */
  countMoves?: boolean
}

const GRID_STEP = 2

/** The battle map on the stage, as the DM sees it: every token, real names, and the grid controls. */
export function MapStage({
  map,
  tokens,
  fight,
  characters,
  userId,
  playersMove,
  pointers,
  onGrid,
  className,
  toolsClassName,
  inset,
  foldTools = false,
  targeting = null,
  aim = null,
  areas = [],
  onAreaClick,
  placing = null,
  countMoves = false,
}: MapStageProps) {
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

  // Whoever is acting: a circle of the movement they have left.
  const acting = combatants.find((c) => c.id === fight?.encounter.currentId)
  const tokenOf = (combatant: typeof acting) =>
    combatant
      ? tokens.tokens.find((t) =>
          combatant.characterId ? t.characterId === combatant.characterId : t.combatantId === combatant.id,
        )
      : undefined
  const actingToken = tokenOf(acting)
  const actingSpeed = acting ? (characters.find((c) => c.id === acting.characterId)?.speed ?? acting.speed) : 0
  const reach =
    acting && actingToken
      ? { tokenId: actingToken.id, feet: movementLeft(acting.turn, actingSpeed), label: 'CAN MOVE' }
      : null
  const aimFrom = aim ? tokenOf(combatants.find((c) => c.id === aim.attackerId)) : undefined
  const aimBand =
    aim && aimFrom
      ? {
          tokenId: aimFrom.id,
          near: Math.max(aim.reach.melee ?? 0, aim.reach.normal ?? 0),
          long: aim.reach.long,
        }
      : null

  const placingFrom = placing?.fromId ? tokenOf(combatants.find((c) => c.id === placing.fromId)) : undefined

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
      <div className={cx(styles.screenPreview, className)}>
        <Suspense fallback={<div className={styles.nothing}>Opening the map…</div>}>
          <BattleMap
            map={map}
            inset={inset}
            tokens={view}
            selectedId={selected}
            onSelect={(id) => {
              const token = tokens.tokens.find((t) => t.id === id)
              if (targeting && token) targeting.onPick(token)
              else setSelected(id)
            }}
            targeting={targeting !== null}
            reach={reach}
            aim={aimBand}
            areas={areas}
            onAreaClick={onAreaClick}
            placing={
              placing && {
                ...placing,
                from: placing.fromId && placingFrom ? { x: placingFrom.x, y: placingFrom.y } : null,
              }
            }
            onMove={(id, x, y) => {
              const token = tokens.tokens.find((t) => t.id === id)
              if (!token) return
              // The DM can put anyone anywhere, but is asked before two share a square.
              const taken = tokens.tokens.some((t) => t.id !== id && t.x === x && t.y === y)
              if (taken && !window.confirm('Someone is already in that square. Put it there anyway?')) return
              if (countMoves && acting?.kind === 'monster' && reach && token.id === reach.tokenId) {
                const feet = feetBetween(token, { x, y })
                const who = fight?.secrets.find((s) => s.combatantId === acting.id)?.name ?? acting.shownName
                if (
                  feet > reach.feet &&
                  !window.confirm(`${who} has ${reach.feet} ft of movement left, and that's ${feet} ft. Move anyway?`)
                )
                  return
              }
              tokens.move(token, x, y)
            }}
            hands={pointers.hands}
            pings={pointers.pings}
            onHand={pointers.sendHand}
            onPing={pointers.sendPing}
          />
        </Suspense>
      </div>
      <div className={cx(styles.mapTools, toolsClassName)}>
        {foldTools ? (
          <details className={styles.fold}>
            <summary className={styles.foldSummary}>Map tools</summary>
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
          </details>
        ) : (
          <>
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
          </>
        )}
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
