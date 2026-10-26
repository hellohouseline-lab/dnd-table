// Local development only: areas on the made-up battle map, kept in this tab.

import { useCallback, useState } from 'react'
import type { Area, AreaControls, NewArea } from '../../live/areas.ts'
import type { PreviewArea } from './previewFight.ts'

let made = 0

export type PreviewAreaControls = AreaControls & {
  /** A spell left an area on the map. */
  fromSpell: (area: PreviewArea) => void
  /** A caster's concentration ended: their areas go. */
  endConcentration: (characterId: string) => void
}

function make(area: NewArea & { characterId: string | null; concentration: boolean }, mapId: string): Area {
  return { ...area, id: `area-${made++}`, campaignId: 'preview', mapId, hidden: area.hidden ?? false }
}

export function usePreviewAreas(mapId: string | null, start: Area[] = []): PreviewAreaControls {
  const [areas, setAreas] = useState<Area[]>(start)
  const map = mapId ?? 'preview-map'
  const fromSpell = useCallback(
    (area: PreviewArea) =>
      setAreas((list) => [
        // A new concentration spell ends the caster's old one, and its area.
        ...list.filter((a) => !(area.concentration && a.concentration && a.characterId === area.characterId)),
        make(area, map),
      ]),
    [map],
  )
  return {
    areas: areas.filter((a) => a.mapId === map),
    add: async (area) => setAreas((list) => [...list, make({ ...area, characterId: null, concentration: false }, map)]),
    remove: (area) => setAreas((list) => list.filter((a) => a.id !== area.id)),
    error: null,
    fromSpell,
    endConcentration: (characterId) =>
      setAreas((list) => list.filter((a) => !(a.concentration && a.characterId === characterId))),
  }
}
