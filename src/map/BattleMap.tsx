// The battle map, drawn with Konva: the map picture with its grid, tokens that snap to squares, the
// movement circle on your turn, everyone's hands and pings. Positions are in grid squares, so every
// screen agrees whatever its size. Loaded only when a map is on stage.

import type Konva from 'konva'
import { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { fileUrl } from '../live/files.ts'
import type { Asset } from '../live/library.ts'
import type { Pointer } from '../live/useFight.ts'
import styles from './BattleMap.module.css'

export type TokenTone = 'party' | 'you' | 'monster'

/** A token as the map draws it: who it is, how it looks, and whether you may move it. */
export type MapToken = {
  id: string
  x: number
  y: number
  label: string
  name: string
  tone: TokenTone
  hidden: boolean
  acting: boolean
  canMove: boolean
  /** At 0 hit points: drawn faded. */
  down?: boolean
}

type BattleMapProps = {
  map: Pick<Asset, 'path' | 'grid' | 'name'>
  tokens: MapToken[]
  onMove: (id: string, x: number, y: number) => void
  onSelect?: (id: string | null) => void
  selectedId?: string | null
  /** Your token's reach this turn: a circle of `feet` around it. */
  reach?: { tokenId: string; feet: number } | null
  /** Picking a target: miniatures glow, and clicking one picks it (through onSelect). */
  targeting?: boolean
  hands?: Pointer[]
  pings?: (Pointer & { id: number })[]
  onHand?: (x: number, y: number) => void
  onPing?: (x: number, y: number) => void
  className?: string
}

const TONES: Record<TokenTone, { stroke: string; fill: string; text: string }> = {
  party: { stroke: '#bdb09a', fill: '#15101b', text: '#efe6d2' },
  you: { stroke: '#f0d58a', fill: '#15101b', text: '#f0d58a' },
  monster: { stroke: '#e07b42', fill: '#2a140c', text: '#f2a777' },
}

function useImage(path: string): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ path: string; image: HTMLImageElement } | null>(null)
  useEffect(() => {
    let live = true
    void fileUrl('art', path).then((url) => {
      if (!url || !live) return
      const image = new window.Image()
      image.onload = () => live && setLoaded({ path, image })
      image.src = url
    })
    return () => {
      live = false
    }
  }, [path])
  return loaded && loaded.path === path ? loaded.image : null
}

function useSize(element: HTMLDivElement | null): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return size
}

export default function BattleMap({
  map,
  tokens,
  onMove,
  onSelect,
  selectedId = null,
  reach = null,
  targeting = false,
  hands = [],
  pings = [],
  onHand,
  onPing,
  className,
}: BattleMapProps) {
  const [holder, setHolder] = useState<HTMLDivElement | null>(null)
  const { width, height } = useSize(holder)
  const image = useImage(map.path)
  const stage = useRef<Konva.Stage>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const { size, offsetX, offsetY } = map.grid
  const mapWidth = image?.width ?? 1600
  const mapHeight = image?.height ?? 900
  // Fit the whole map in view, then let the viewer zoom and drag it about.
  const fit = width > 0 && height > 0 ? Math.min(width / mapWidth, height / mapHeight) : 1
  const scale = fit * zoom
  const origin = { x: (width - mapWidth * scale) / 2 + pan.x, y: (height - mapHeight * scale) / 2 + pan.y }
  const centre = (square: number, offset: number) => offset + (square + 0.5) * size
  const toSquare = (pixel: number, offset: number) => Math.max(0, Math.floor((pixel - offset) / size))

  // The pointer in grid squares (with fractions), for hands and pings.
  function pointerSquares(): { x: number; y: number } | null {
    const point = stage.current?.getPointerPosition()
    if (!point) return null
    return {
      x: ((point.x - origin.x) / scale - offsetX) / size - 0.5,
      y: ((point.y - origin.y) / scale - offsetY) / size - 0.5,
    }
  }

  const columns = Math.ceil((mapWidth - offsetX) / size) + 1
  const rows = Math.ceil((mapHeight - offsetY) / size) + 1
  const lines: number[][] = []
  for (let c = 0; c <= columns; c++) lines.push([offsetX + c * size, 0, offsetX + c * size, mapHeight])
  for (let r = 0; r <= rows; r++) lines.push([0, offsetY + r * size, mapWidth, offsetY + r * size])

  const reachToken = reach ? tokens.find((t) => t.id === reach.tokenId) : undefined

  return (
    <div ref={setHolder} className={`${styles.map} ${className ?? ''}`}>
      {width > 0 && (
        <Stage
          ref={stage}
          width={width}
          height={height}
          onMouseMove={() => {
            const at = pointerSquares()
            if (at) onHand?.(at.x, at.y)
          }}
          onDblClick={() => {
            const at = pointerSquares()
            if (at) onPing?.(at.x, at.y)
          }}
          onWheel={(event) => {
            event.evt.preventDefault()
            setZoom((z) => Math.min(4, Math.max(0.5, z * (event.evt.deltaY > 0 ? 0.9 : 1.1))))
          }}
          draggable
          onDragEnd={(event) => {
            if (event.target === stage.current) {
              setPan((p) => ({ x: p.x + event.target.x(), y: p.y + event.target.y() }))
              event.target.position({ x: 0, y: 0 })
            }
          }}
          onClick={(event) => {
            if (event.target === stage.current || event.target.name() === 'map') onSelect?.(null)
          }}
        >
          <Layer x={origin.x} y={origin.y} scaleX={scale} scaleY={scale}>
            {image ? (
              <KonvaImage image={image} name="map" />
            ) : (
              <Rect width={mapWidth} height={mapHeight} fill="#1f1a27" name="map" />
            )}
            {lines.map((points, i) => (
              <Line
                key={i}
                points={points}
                stroke="rgba(240, 213, 138, 0.22)"
                strokeWidth={1 / scale}
                listening={false}
              />
            ))}

            {reachToken && (
              <Group listening={false}>
                <Circle
                  x={centre(reachToken.x, offsetX)}
                  y={centre(reachToken.y, offsetY)}
                  radius={(reach!.feet / 5 + 0.5) * size}
                  fill="rgba(212, 175, 90, 0.10)"
                  stroke="#d4af5a"
                  strokeWidth={2 / scale}
                  dash={[10 / scale, 8 / scale]}
                />
                <Text
                  x={centre(reachToken.x, offsetX) - 150}
                  y={centre(reachToken.y, offsetY) - (reach!.feet / 5 + 0.5) * size + 8}
                  width={300}
                  align="center"
                  text={reach!.feet > 0 ? `YOU CAN REACH ${reach!.feet} FT` : 'NO MOVEMENT LEFT'}
                  fontFamily="Cinzel, Georgia, serif"
                  fontStyle="bold"
                  fontSize={Math.max(11, size * 0.2)}
                  letterSpacing={1}
                  fill="#f0d58a"
                />
              </Group>
            )}

            {tokens.map((token) => {
              const tone = TONES[token.tone]
              const radius = size * 0.42
              return (
                <Group
                  key={token.id}
                  x={centre(token.x, offsetX)}
                  y={centre(token.y, offsetY)}
                  draggable={token.canMove}
                  opacity={token.down ? 0.35 : token.hidden ? 0.5 : 1}
                  onClick={(event) => {
                    event.cancelBubble = true
                    onSelect?.(token.id)
                  }}
                  onTap={() => onSelect?.(token.id)}
                  onDragStart={(event) => {
                    event.cancelBubble = true
                  }}
                  onDragEnd={(event) => {
                    event.cancelBubble = true
                    const x = toSquare(event.target.x(), offsetX)
                    const y = toSquare(event.target.y(), offsetY)
                    event.target.position({ x: centre(x, offsetX), y: centre(y, offsetY) })
                    if (x !== token.x || y !== token.y) onMove(token.id, x, y)
                  }}
                  onMouseEnter={(event) => {
                    const container = event.target.getStage()?.container()
                    if (container) container.style.cursor = targeting ? 'crosshair' : token.canMove ? 'grab' : 'pointer'
                  }}
                  onMouseLeave={(event) => {
                    const container = event.target.getStage()?.container()
                    if (container) container.style.cursor = ''
                  }}
                >
                  {targeting && !token.acting && (
                    <Circle
                      radius={radius + size * 0.14}
                      stroke="#e07b42"
                      strokeWidth={2 / scale}
                      dash={[6 / scale, 4 / scale]}
                      shadowColor="#e07b42"
                      shadowBlur={10}
                    />
                  )}
                  {(token.acting || token.id === selectedId) && (
                    <Circle
                      radius={radius + size * 0.08}
                      stroke="#f0d58a"
                      strokeWidth={3 / scale}
                      shadowColor="#f0d58a"
                      shadowBlur={12}
                    />
                  )}
                  <Circle
                    radius={radius}
                    fill={tone.fill}
                    stroke={tone.stroke}
                    strokeWidth={(token.tone === 'you' ? 3 : 2) / scale}
                    dash={token.hidden ? [6 / scale, 4 / scale] : undefined}
                  />
                  <Text
                    text={token.label}
                    width={radius * 2}
                    height={radius * 2}
                    offsetX={radius}
                    offsetY={radius}
                    align="center"
                    verticalAlign="middle"
                    fontFamily="Cinzel, Georgia, serif"
                    fontStyle="bold"
                    fontSize={radius * 0.7}
                    fill={tone.text}
                    listening={false}
                  />
                </Group>
              )
            })}

            {hands.map((hand) => (
              <Group key={hand.userId} x={centre(hand.x, offsetX)} y={centre(hand.y, offsetY)} listening={false}>
                <Circle radius={5 / scale} fill="#efe6d2" stroke="#15101b" strokeWidth={1.5 / scale} />
                <Text
                  x={9 / scale}
                  y={-7 / scale}
                  text={hand.name}
                  fontFamily="EB Garamond, Georgia, serif"
                  fontSize={14 / scale}
                  fill="#efe6d2"
                  shadowColor="#000"
                  shadowBlur={4}
                />
              </Group>
            ))}

            {pings.map((ping) => (
              <Group key={ping.id} x={centre(ping.x, offsetX)} y={centre(ping.y, offsetY)} listening={false}>
                <Circle radius={size * 0.45} stroke="#86d4e8" strokeWidth={3 / scale} />
                <Circle radius={size * 0.7} stroke="rgba(134, 212, 232, 0.45)" strokeWidth={2 / scale} />
                <Text
                  x={-100}
                  y={size * 0.8}
                  width={200}
                  align="center"
                  text={`${ping.name} pinged`}
                  fontFamily="EB Garamond, Georgia, serif"
                  fontSize={15 / scale}
                  fill="#86d4e8"
                  shadowColor="#000"
                  shadowBlur={4}
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      )}
      <div className={styles.help}>Drag to move around · scroll to zoom · double-click to ping</div>
    </div>
  )
}
