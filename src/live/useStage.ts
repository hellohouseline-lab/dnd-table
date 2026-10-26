import { useCallback, useEffect, useRef, useState } from 'react'
import { useCatchUp, useTableChanges, type RowChange } from './campaignChannel.ts'
import { messageFor } from './errors.ts'
import { addLogEvent, listLogEvents, rowToLogEvent, type LogEvent, type LogKind } from './notebook.ts'
import { getAsset, listAssets, rowToAsset, type Asset } from './library.ts'
import { emptyStage, getStage, rowToStage, saveStage, type Stage, type StagePatch } from './stage.ts'

export type StageControls = {
  stage: Stage
  /** DM: changes the stage on screen at once, then saves it. */
  change: (patch: StagePatch) => void
  error: string | null
}

/** The stage, kept up to date live. */
export function useStage(campaignId: string, userId: string): StageControls {
  const [stage, setStage] = useState<Stage>(() => emptyStage(campaignId))
  const [error, setError] = useState<string | null>(null)
  // While a change is being saved, older echoes from the live channel are ignored.
  const saving = useRef(0)

  const load = useCallback(() => {
    let live = true
    getStage(campaignId).then(
      (loaded) => live && saving.current === 0 && setStage(loaded),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    return () => {
      live = false
    }
  }, [campaignId])
  useEffect(load, [load])
  useCatchUp(campaignId, userId, load)

  // A safety net in case a live change is missed: look again every 20 seconds while the tab is open.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 20_000)
    return () => clearInterval(timer)
  }, [load])

  const onChange = useCallback((change: RowChange<'stage'>) => {
    if (change.type === 'upsert' && saving.current === 0) setStage(rowToStage(change.row))
  }, [])
  useTableChanges(campaignId, userId, 'stage', onChange)

  const change = useCallback(
    (patch: StagePatch) => {
      setError(null)
      setStage((now) => ({ ...now, ...patch }))
      saving.current += 1
      saveStage(campaignId, patch).then(
        (saved) => {
          saving.current -= 1
          if (saving.current === 0) setStage(saved)
        },
        (caught: unknown) => {
          saving.current -= 1
          setError(messageFor(caught))
        },
      )
    },
    [campaignId],
  )

  return { stage, change, error }
}

export type LibraryControls = {
  assets: Asset[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
  /** Puts an asset just uploaded or changed here into the list straight away. */
  put: (asset: Asset) => void
  drop: (id: string) => void
}

/** The library you're allowed to see (all of it for the DM; sounds for players), kept up to date. */
export function useLibrary(campaignId: string, userId: string): LibraryControls {
  const [assets, setAssets] = useState<Asset[]>([])
  const [status, setStatus] = useState<LibraryControls['status']>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listAssets(campaignId).then(
      (list) => {
        if (!live) return
        setAssets(list)
        setStatus('ready')
      },
      (caught: unknown) => {
        if (!live) return
        setError(messageFor(caught))
        setStatus('error')
      },
    )
    return () => {
      live = false
    }
  }, [campaignId])

  const put = useCallback((asset: Asset) => {
    setAssets((now) =>
      now.some((a) => a.id === asset.id) ? now.map((a) => (a.id === asset.id ? asset : a)) : [...now, asset],
    )
  }, [])
  const drop = useCallback((id: string) => setAssets((now) => now.filter((a) => a.id !== id)), [])

  const onChange = useCallback(
    (change: RowChange<'assets'>) => (change.type === 'upsert' ? put(rowToAsset(change.row)) : drop(change.id)),
    [put, drop],
  )
  useTableChanges(campaignId, userId, 'assets', onChange)

  return { assets, status, error, put, drop }
}

/**
 * The picture on stage. The DM finds it in their library; players fetch just that one, which the
 * database lets them see only while it's on stage.
 */
export function useStageImage(imageId: string | null, library: Asset[]): Asset | null {
  const inLibrary = imageId ? (library.find((a) => a.id === imageId) ?? null) : null
  const [fetched, setFetched] = useState<Asset | null>(null)

  useEffect(() => {
    if (!imageId || inLibrary) return
    let live = true
    let tries = 0
    // Try a few times: the picture may not be visible for the first moment after it goes up.
    const fetchIt = () =>
      getAsset(imageId).then(
        (asset) => {
          if (!live) return
          setFetched(asset)
          if (!asset && ++tries < 5) setTimeout(fetchIt, 1500)
        },
        () => live && ++tries < 5 && setTimeout(fetchIt, 1500),
      )
    void fetchIt()
    return () => {
      live = false
    }
  }, [imageId, inLibrary])

  if (!imageId) return null
  return inLibrary ?? (fetched?.id === imageId ? fetched : null)
}

export type LogControls = {
  events: LogEvent[]
  /** DM: adds to the log. */
  add: (kind: LogKind, text: string, visible?: boolean) => void
  error: string | null
}

/** The session log's notes, damage and rests (the DM's screens), newest first, kept up to date. */
export function useLogEvents(campaignId: string, userId: string): LogControls {
  const [events, setEvents] = useState<LogEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const put = useCallback((event: LogEvent) => {
    setEvents((now) => (now.some((e) => e.id === event.id) ? now : [event, ...now]))
  }, [])

  useEffect(() => {
    let live = true
    listLogEvents(campaignId).then(
      (list) => live && setEvents((now) => [...now, ...list.filter((e) => !now.some((n) => n.id === e.id))]),
      (caught: unknown) => live && setError(messageFor(caught)),
    )
    return () => {
      live = false
    }
  }, [campaignId])

  const onChange = useCallback(
    (change: RowChange<'log_events'>) => {
      if (change.type === 'upsert') put(rowToLogEvent(change.row))
      else setEvents((now) => now.filter((e) => e.id !== change.id))
    },
    [put],
  )
  useTableChanges(campaignId, userId, 'log_events', onChange)

  const add = useCallback(
    (kind: LogKind, text: string, visible = false) => {
      setError(null)
      addLogEvent(campaignId, kind, text, visible).then(put, (caught: unknown) => setError(messageFor(caught)))
    },
    [campaignId, put],
  )

  return { events, add, error }
}
