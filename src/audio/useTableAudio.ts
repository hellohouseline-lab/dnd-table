import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { broadcastEffect, useEffectBroadcasts } from '../live/campaignChannel.ts'
import { serverNow, syncClock } from '../live/clock.ts'
import { fileUrl } from '../live/files.ts'
import type { Asset } from '../live/library.ts'
import type { Stage } from '../live/stage.ts'
import { mixer, type AmbienceWanted, type Sound } from './mixer.ts'

const VOLUME_KEY = 'dnd-table-volume'

function savedVolume(): number {
  try {
    const value = Number(window.localStorage.getItem(VOLUME_KEY))
    return Number.isFinite(value) && window.localStorage.getItem(VOLUME_KEY) !== null
      ? Math.min(1, Math.max(0, value))
      : 0.8
  } catch {
    return 0.8
  }
}

function formatOf(path: string): Sound['format'] {
  return path.endsWith('.ogg') ? 'ogg' : 'mp3'
}

async function soundOf(asset: Asset): Promise<Sound | null> {
  const url = await fileUrl('audio', asset.path)
  return url ? { id: asset.id, url, format: formatOf(asset.path) } : null
}

/**
 * Only one tab per browser plays the table's sound, so a DM with the story and stage screens open
 * side by side doesn't hear everything twice. The first tab to open plays; if it closes, the next.
 */
function useSoundOwner(campaignId: string): boolean {
  const [owner, setOwner] = useState(false)
  // Browsers without locks (rare) simply play in every tab.
  const canLock = typeof navigator !== 'undefined' && Boolean(navigator.locks)
  useEffect(() => {
    if (!canLock) return
    const done = new AbortController()
    navigator.locks
      .request(`dnd-table-sound-${campaignId}`, { signal: done.signal }, () => {
        setOwner(true)
        return new Promise<void>((resolve) => done.signal.addEventListener('abort', () => resolve()))
      })
      .catch(() => undefined)
    return () => {
      done.abort()
      setOwner(false)
    }
  }, [campaignId, canLock])
  return owner || !canLock
}

const ACTIVE_TABLE_KEY = 'dnd-table-sound-table'

function storedTable(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_TABLE_KEY)
  } catch {
    return null
  }
}

/**
 * With two tables open (a test table beside the real one), only the table you last clicked into
 * plays in this browser. Tabs of that table share it out as before (useSoundOwner).
 */
function useActiveTable(campaignId: string): boolean {
  const [active, setActive] = useState(() => {
    const stored = storedTable()
    return stored === null || stored === campaignId || document.hasFocus()
  })
  useEffect(() => {
    const claim = () => {
      try {
        if (storedTable() !== campaignId) window.localStorage.setItem(ACTIVE_TABLE_KEY, campaignId)
      } catch {
        // Without storage every table plays, as before.
      }
    }
    const onFocus = () => {
      claim()
      setActive(true)
    }
    const onVisible = () => document.visibilityState === 'visible' && onFocus()
    // Another tab claimed the sound: only its table plays now.
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_TABLE_KEY && event.newValue) setActive(event.newValue === campaignId)
    }
    if (document.hasFocus()) claim()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  }, [campaignId])
  return active
}

export type TableAudio = {
  /** The browser is waiting for a click before it will play anything. */
  locked: boolean
  /** This tab is the one playing the table's sound. */
  owner: boolean
  volume: number
  setVolume: (volume: number) => void
  /** The music playing now, by name. */
  nowPlaying: Asset | null
  /** DM: plays a sound effect for everyone. */
  playEffect: (asset: Asset) => void
}

/** Plays the stage's music, ambience and everyone's sound effects in this browser. */
export function useTableAudio(campaignId: string, userId: string, stage: Stage, sounds: Asset[]): TableAudio {
  const lockOwner = useSoundOwner(campaignId)
  const activeTable = useActiveTable(campaignId)
  const owner = lockOwner && activeTable
  const [volume, setVolumeState] = useState(savedVolume)
  const locked = useSyncExternalStore(
    (listener) => mixer.subscribe(listener),
    () => mixer.locked,
    () => false,
  )
  const music = stage.musicId ? (sounds.find((s) => s.id === stage.musicId) ?? null) : null

  useEffect(() => {
    mixer.setClock(serverNow)
    void syncClock()
  }, [])

  useEffect(() => mixer.setMasterVolume(owner ? volume : 0), [owner, volume])

  // Music: what's on the stage, from the moment it started.
  const { musicPlaying, musicStartedAt, musicPosition, musicVolume } = stage
  useEffect(() => {
    if (!owner || !music) {
      mixer.setMusic(null)
      return
    }
    let live = true
    void soundOf(music).then((sound) => {
      if (live && sound) {
        mixer.setMusic({
          ...sound,
          playing: musicPlaying,
          startedAt: musicStartedAt,
          position: musicPosition,
          volume: musicVolume,
        })
      }
    })
    return () => {
      live = false
    }
  }, [owner, music, musicPlaying, musicStartedAt, musicPosition, musicVolume])

  // Ambience: every loop the DM has turned up.
  const ambienceKey = JSON.stringify(stage.ambience)
  useEffect(() => {
    if (!owner) {
      mixer.setAmbience([])
      return
    }
    let live = true
    const levels = JSON.parse(ambienceKey) as Record<string, number>
    const wanted = sounds.filter((s) => s.kind === 'ambience' && levels[s.id] > 0)
    void Promise.all(wanted.map(soundOf)).then((loaded) => {
      if (!live) return
      mixer.setAmbience(
        loaded.flatMap((sound): AmbienceWanted[] => (sound ? [{ ...sound, level: levels[sound.id] }] : [])),
      )
    })
    return () => {
      live = false
    }
  }, [owner, ambienceKey, sounds])

  // Effects: load them ahead, so they fire the moment anyone presses one.
  useEffect(() => {
    if (!owner) return
    for (const effect of sounds.filter((s) => s.kind === 'effect')) {
      void soundOf(effect).then((sound) => sound && mixer.preloadEffect(sound))
    }
  }, [owner, sounds])

  useEffect(() => () => mixer.stopAll(), [])

  const onEffect = useCallback(
    (assetId: string) => {
      const effect = sounds.find((s) => s.id === assetId)
      if (owner && effect) void soundOf(effect).then((sound) => sound && mixer.playEffect(sound))
    },
    [owner, sounds],
  )
  useEffectBroadcasts(campaignId, userId, onEffect)

  const playEffect = useCallback(
    (asset: Asset) => {
      broadcastEffect(campaignId, asset.id)
      onEffect(asset.id)
    },
    [campaignId, onEffect],
  )

  const setVolume = useCallback((next: number) => {
    setVolumeState(next)
    try {
      window.localStorage.setItem(VOLUME_KEY, String(next))
    } catch {
      // Private windows may refuse; the volume still changes for now.
    }
  }, [])

  return {
    locked: owner && locked,
    owner,
    volume,
    setVolume,
    nowPlaying: stage.musicPlaying ? music : null,
    playEffect,
  }
}
