import { describe, expect, it } from 'vitest'
import { creaturesIn, directionTowards, snapOrigin, squaresIn, type AreaTemplate } from './areas.ts'

const at = (shape: AreaTemplate['shape'], sizeFt: number, originX: number, originY: number, direction = 0) => ({
  shape,
  sizeFt,
  originX,
  originY,
  direction,
})

describe('areas on the map', () => {
  it('covers the squares whose centre is inside a sphere', () => {
    // A 5 ft radius on a corner: the four squares around it.
    expect(squaresIn(at('sphere', 5, 5, 5))).toHaveLength(4)
    // Fireball's 20 ft radius: a rough circle 8 squares across.
    const fireball = squaresIn(at('sphere', 20, 10, 10))
    expect(fireball).toHaveLength(52)
    expect(fireball).toContainEqual({ x: 6, y: 9 })
    expect(fireball).not.toContainEqual({ x: 6, y: 6 })
  })

  it('points a cone, as wide as it is long, away from its point', () => {
    // A 15 ft cone from the centre of square (5, 5), pointing right.
    const cone = squaresIn(at('cone', 15, 5.5, 5.5))
    expect(cone).toEqual(
      expect.arrayContaining([
        { x: 6, y: 5 },
        { x: 7, y: 4 },
        { x: 7, y: 6 },
        { x: 8, y: 4 },
      ]),
    )
    expect(cone).not.toContainEqual({ x: 5, y: 5 })
    expect(cone).not.toContainEqual({ x: 4, y: 5 })
    // Turned to point down, it covers the squares below instead.
    expect(squaresIn(at('cone', 15, 5.5, 5.5, 90))).toContainEqual({ x: 5, y: 7 })
  })

  it('runs a line 5 feet wide', () => {
    const line = squaresIn(at('line', 30, 2.5, 2.5))
    expect(line).toEqual(
      [3, 4, 5, 6, 7, 8]
        .map((x) => ({ x, y: 2 }))
        .concat([{ x: 2, y: 2 }])
        .sort((a, b) => a.x - b.x),
    )
  })

  it('makes a cube as wide as it is long', () => {
    expect(squaresIn(at('cube', 10, 3, 3))).toHaveLength(4)
  })

  it('finds the miniatures standing in it', () => {
    const tokens = [
      { id: 'goblin', x: 9, y: 9 },
      { id: 'thorin', x: 2, y: 2 },
    ]
    expect(creaturesIn(at('sphere', 20, 10, 10), tokens).map((t) => t.id)).toEqual(['goblin'])
  })

  it('turns towards the mouse in 15 degree steps', () => {
    expect(directionTowards({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(0)
    expect(directionTowards({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(90)
    expect(directionTowards({ x: 0, y: 0 }, { x: -5, y: -0.1 })).toBe(180)
    expect(directionTowards({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(45)
  })

  it('puts spheres on corners and cones at the caster', () => {
    expect(snapOrigin('sphere', { x: 4.4, y: 6.6 }, null)).toEqual({ x: 4, y: 7 })
    expect(snapOrigin('cone', { x: 9, y: 9 }, { x: 3, y: 3 })).toEqual({ x: 3.5, y: 3.5 })
  })
})
