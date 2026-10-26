// Areas on the battle map: a spell's lasting shape (Darkness, Silence) or one the DM draws (a
// dragon's breath, a fog bank). Casters' areas come and go with their spells on the server; the DM
// adds, moves and removes any by hand. Players see those on the map on stage, unless hidden.

import { useCallback, useEffect, useState } from 'react'
import type { AreaShape, AreaTemplate } from '../rules/areas.ts'
import { useCatchUp, useTableChanges, type RowChange } from './campaignChannel.ts'
import type { Tables } from './database.types.ts'
import { fromDatabaseError, messageFor, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type AreaTone = 'harm' | 'help' | 'block'

export type Area = AreaTemplate & {
  id: string
  campaignId: string
  mapId: string
  label: string
  tone: AreaTone
  /** The character whose spell it is; it goes when their concentration does. */
  characterId: string | null
  concentration: boolean
  hidden: boolean
}

export type NewArea = AreaTemplate & { label: string; tone: AreaTone; hidden?: boolean }

const SHAPES: AreaShape[] = ['sphere', 'cube', 'cone', 'line', 'cylinder']

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

export function rowToArea(row: Tables<'areas'>): Area {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    mapId: row.map_id,
    shape: SHAPES.find((s) => s === row.shape) ?? 'sphere',
    sizeFt: row.size_ft,
    originX: Number(row.origin_x),
    originY: Number(row.origin_y),
    direction: row.direction,
    label: row.label,
    tone: row.tone === 'help' || row.tone === 'block' ? row.tone : 'harm',
    characterId: row.character_id,
    concentration: row.concentration,
    hidden: row.hidden,
  }
}

/** For cast_spell: the area as the server stores it. */
export function areaToJson(area: AreaTemplate & { tone: AreaTone }) {
  return {
    shape: area.shape,
    size_ft: Math.round(area.sizeFt),
    origin_x: Math.round(area.originX * 10) / 10,
    origin_y: Math.round(area.originY * 10) / 10,
    direction: ((Math.round(area.direction) % 360) + 360) % 360,
    tone: area.tone,
  }
}

export async function listAreas(campaignId: string, mapId: string): Promise<Area[]> {
  const { data, error } = await db()
    .from('areas')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('map_id', mapId)
    .order('created_at', { ascending: true })
  if (error) throw fromDatabaseError(error)
  return data.map(rowToArea)
}

/** DM: draws an area on a map by hand. */
export async function addArea(campaignId: string, mapId: string, area: NewArea): Promise<Area> {
  const json = areaToJson(area)
  const { data, error } = await db()
    .from('areas')
    .insert({
      campaign_id: campaignId,
      map_id: mapId,
      ...json,
      label: area.label.trim().slice(0, 60),
      hidden: area.hidden ?? false,
    })
    .select('*')
    .single()
  if (error) throw fromDatabaseError(error)
  return rowToArea(data)
}

/** DM: takes an area off the map. */
export async function removeArea(id: string): Promise<void> {
  const { error } = await db().from('areas').delete().eq('id', id)
  if (error) throw fromDatabaseError(error)
}

export type AreaControls = {
  areas: Area[]
  add: (area: NewArea) => Promise<void>
  remove: (area: Area) => void
  error: string | null
}

function withRow(list: Area[], area: Area): Area[] {
  return list.some((a) => a.id === area.id) ? list.map((a) => (a.id === area.id ? area : a)) : [...list, area]
}

/** The areas on one battle map, kept up to date live. */
export function useAreas(campaignId: string, userId: string, mapId: string | null): AreaControls {
  const [loaded, setLoaded] = useState<{ mapId: string; areas: Area[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const areas = loaded && loaded.mapId === mapId ? loaded.areas : []

  const load = useCallback(() => {
    if (!mapId) return
    let live = true
    listAreas(campaignId, mapId).then(
      (list) => live && setLoaded({ mapId, areas: list }),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    return () => {
      live = false
    }
  }, [campaignId, mapId])
  useEffect(load, [load])
  useCatchUp(campaignId, userId, load)

  const set = useCallback(
    (change: (areas: Area[]) => Area[]) =>
      setLoaded((now) => (now && now.mapId === mapId ? { ...now, areas: change(now.areas) } : now)),
    [mapId],
  )

  const onChange = useCallback(
    (change: RowChange<'areas'>) => {
      if (change.type === 'delete') set((list) => list.filter((a) => a.id !== change.id))
      else {
        const area = rowToArea(change.row)
        // Hidden again, or moved to another map: gone from this one.
        if (area.mapId === mapId) set((list) => withRow(list, area))
        else set((list) => list.filter((a) => a.id !== area.id))
      }
    },
    [mapId, set],
  )
  useTableChanges(campaignId, userId, 'areas', onChange)

  const add = useCallback(
    async (area: NewArea) => {
      if (!mapId) return
      setError(null)
      try {
        const added = await addArea(campaignId, mapId, area)
        set((list) => withRow(list, added))
      } catch (caught) {
        setError(messageFor(caught))
      }
    },
    [campaignId, mapId, set],
  )

  const remove = useCallback(
    (area: Area) => {
      set((list) => list.filter((a) => a.id !== area.id))
      removeArea(area.id).catch((caught: unknown) => {
        setError(messageFor(caught))
        load()
      })
    },
    [load, set],
  )

  return { areas, add, remove, error }
}
