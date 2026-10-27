// What a scene holds besides its words (S1b): planned rolls, choices that lead on, things to hand
// out, and a fight ready to start. Read back from storage carefully (anything odd is dropped), and
// put into plain words for the buttons.

import { findAskable } from './askable.ts'
import type { Container, Richness } from './boxes.ts'
import { CONTAINERS, RICHNESS } from './boxes.ts'

export type PlannedRoll = {
  id: string
  /** The check: 'skill:perception', 'save:dexterity', 'ability:strength'. */
  key: string
  dc: number
  dcShown: boolean
  outcomeShown: boolean
  /** Character ids; empty for everyone. */
  who: string[]
  /** What it's for: "to spot the hooded figure". */
  note: string
}

export type Choice = { id: string; text: string; sceneId: string | null }

export type Thing =
  | { id: string; kind: 'item'; dmItemId: string }
  | { id: string; kind: 'box'; container: Container; richness: Richness }
  | { id: string; kind: 'shop'; shopId: string }

export type Fight = { monsters: { index: string; count: number }[]; mapId: string | null }

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : [])

export function parsePlannedRolls(value: unknown): PlannedRoll[] {
  return list(value).flatMap((r) => {
    const key = str(r.key)
    if (!findAskable(key)) return []
    const dc = typeof r.dc === 'number' ? Math.min(40, Math.max(1, Math.round(r.dc))) : 15
    return [
      {
        id: str(r.id) || crypto.randomUUID(),
        key,
        dc,
        dcShown: r.dcShown === true,
        outcomeShown: r.outcomeShown !== false,
        who: Array.isArray(r.who) ? r.who.filter((w): w is string => typeof w === 'string') : [],
        note: str(r.note).slice(0, 120),
      },
    ]
  })
}

export function parseChoices(value: unknown): Choice[] {
  return list(value).flatMap((c) =>
    str(c.text).trim()
      ? [{ id: str(c.id) || crypto.randomUUID(), text: str(c.text).slice(0, 120), sceneId: str(c.sceneId) || null }]
      : [],
  )
}

export function parseThings(value: unknown): Thing[] {
  return list(value).flatMap((t): Thing[] => {
    const id = str(t.id) || crypto.randomUUID()
    if (t.kind === 'item' && str(t.dmItemId)) return [{ id, kind: 'item', dmItemId: str(t.dmItemId) }]
    if (t.kind === 'shop' && str(t.shopId)) return [{ id, kind: 'shop', shopId: str(t.shopId) }]
    if (t.kind === 'box') {
      const container = CONTAINERS.find((c) => c.key === t.container)?.key ?? 'chest'
      const richness = RICHNESS.find((r) => r.key === t.richness)?.key ?? 'ordinary'
      return [{ id, kind: 'box', container, richness }]
    }
    return []
  })
}

export function parseFight(value: unknown): Fight | null {
  if (!isObject(value)) return null
  const monsters = list(value.monsters).flatMap((m) =>
    str(m.index) && typeof m.count === 'number' && m.count > 0
      ? [{ index: str(m.index), count: Math.min(8, Math.round(m.count)) }]
      : [],
  )
  return { monsters, mapId: str(value.mapId) || null }
}

/** "Perception, DC 13, secret": the button for a planned roll. */
export function plannedRollWords(roll: PlannedRoll, names: string[] = []): string {
  const name = findAskable(roll.key)?.name ?? roll.key
  return [
    name,
    `DC ${roll.dc}`,
    ...(roll.dcShown ? [] : ['secret DC']),
    ...(roll.outcomeShown ? [] : ['outcome kept']),
    ...(names.length > 0 ? [names.join(' and ')] : []),
  ].join(', ')
}

/** "A valuable chest": the button for a box. */
export function boxWords(container: Container, richness: Richness): string {
  const what = CONTAINERS.find((c) => c.key === container)?.name.replace(/^An? /, '') ?? 'box'
  const rich = RICHNESS.find((r) => r.key === richness)?.name.toLowerCase() ?? ''
  return `${/^[aeiou]/.test(rich) ? 'An' : 'A'} ${rich} ${what}`
}
