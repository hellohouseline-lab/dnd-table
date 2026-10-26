// A druid's Wild Shape (2014 rules): from level 2 a beast of challenge rating 1/4 that can't fly or
// swim; from 4, 1/2 and swimming; from 8, 1 and flying. The class table says which.

import type { SrdClass, SrdMonster } from '../srd/index.ts'

export type WildShapeLimits = { maxCr: number; swim: boolean; fly: boolean }

/** The limits at a druid level, or null before level 2. */
export function wildShapeLimits(druid: SrdClass, level: number): WildShapeLimits | null {
  const extras = druid.levels[level]?.extras ?? {}
  if (typeof extras.wild_shape_max_cr !== 'number' || extras.wild_shape_max_cr <= 0) return null
  return { maxCr: extras.wild_shape_max_cr, swim: extras.wild_shape_swim === true, fly: extras.wild_shape_fly === true }
}

/** The beasts a druid can become within those limits, easiest first. */
export function wildShapeBeasts(monsters: SrdMonster[], limits: WildShapeLimits): SrdMonster[] {
  return monsters
    .filter((m) => m.type === 'beast' && m.cr <= limits.maxCr)
    .filter((m) => limits.fly || !/\bfly\b/.test(m.speedText))
    .filter((m) => limits.swim || !/\bswim\b/.test(m.speedText))
    .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name))
}

/** The next level the limits change, and what to: for Your path. */
export function nextWildShape(druid: SrdClass, level: number): { level: number; limits: WildShapeLimits } | null {
  const now = JSON.stringify(wildShapeLimits(druid, level))
  for (let next = level + 1; next <= 20; next++) {
    const limits = wildShapeLimits(druid, next)
    if (limits && JSON.stringify(limits) !== now) return { level: next, limits }
  }
  return null
}
