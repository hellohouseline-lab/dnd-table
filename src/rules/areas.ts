// Areas on the battle map: which squares a spell's sphere, cube, cone or line covers. A square
// counts when its centre is inside (the DMG's template rule). Positions are in grid squares from the
// top left: square (x, y) runs from x to x + 1, so its centre is (x + 0.5, y + 0.5), and a whole
// number is a corner between squares.

export type AreaShape = 'sphere' | 'cube' | 'cone' | 'line' | 'cylinder'

export type AreaTemplate = {
  shape: AreaShape
  /** A sphere's or cylinder's radius; a cube's side; a cone's or line's length. */
  sizeFt: number
  originX: number
  originY: number
  /** Which way a cone, line or cube points, in degrees: 0 is right, 90 is down. */
  direction: number
}

type Point = { x: number; y: number }

/** Is a point (in squares) inside the area? */
export function covers(area: AreaTemplate, point: Point): boolean {
  const size = area.sizeFt / 5
  const dx = point.x - area.originX
  const dy = point.y - area.originY
  if (area.shape === 'sphere' || area.shape === 'cylinder') return Math.hypot(dx, dy) <= size + 1e-9
  // Along the direction (u) and across it (v).
  const angle = (area.direction * Math.PI) / 180
  const u = dx * Math.cos(angle) + dy * Math.sin(angle)
  const v = -dx * Math.sin(angle) + dy * Math.cos(angle)
  const e = 1e-9
  if (u < -e || u > size + e) return false
  if (area.shape === 'cube') return Math.abs(v) <= size / 2 + e
  // A cone is as wide as it is far from its point; a line is 5 feet wide.
  if (area.shape === 'cone') return u > e && Math.abs(v) <= u / 2 + e
  return Math.abs(v) <= 0.5 + e
}

/** The squares the area covers, on a map this many squares across and down. */
export function squaresIn(area: AreaTemplate, columns = 500, rows = 500): Point[] {
  const reach = Math.ceil(area.sizeFt / 5) + 1
  const squares: Point[] = []
  for (let y = Math.max(0, Math.floor(area.originY) - reach); y <= Math.min(rows - 1, area.originY + reach); y++) {
    for (let x = Math.max(0, Math.floor(area.originX) - reach); x <= Math.min(columns - 1, area.originX + reach); x++) {
      if (covers(area, { x: x + 0.5, y: y + 0.5 })) squares.push({ x, y })
    }
  }
  return squares
}

/** The miniatures standing in the area. */
export function creaturesIn<T extends Point>(area: AreaTemplate, tokens: T[]): T[] {
  return tokens.filter((token) => covers(area, { x: token.x + 0.5, y: token.y + 0.5 }))
}

/** A direction from one point towards another, to the nearest 15 degrees. */
export function directionTowards(from: Point, to: Point): number {
  const degrees = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return (Math.round(degrees / 15) * 15 + 360) % 360
}

/**
 * Where an area starts when it's placed with the mouse: a sphere, cylinder or cube sits on the
 * nearest corner between squares; a cone or line starts at the centre of the caster's square.
 */
export function snapOrigin(shape: AreaShape, point: Point, caster: Point | null): Point {
  if ((shape === 'cone' || shape === 'line') && caster) return { x: caster.x + 0.5, y: caster.y + 0.5 }
  return { x: Math.round(point.x), y: Math.round(point.y) }
}
