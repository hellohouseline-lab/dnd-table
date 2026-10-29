import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../app/authContext.ts'
import { useHashPath } from '../app/router.ts'
import {
  broadcastCameraKey,
  setCallPresence,
  useCallPresence,
  useCameraKeyBroadcasts,
  type CallPresence,
} from '../live/campaignChannel.ts'
import { getCameraDetails, renewCameraKey } from '../live/campaigns.ts'
import { CallContext, type CallStatus, type TableCall } from './callContext.ts'
import { checkDevices, loadDevices, saveDevices } from './devices.ts'
import styles from './Call.module.css'
import { clampMicLevel, sendUrl, tellFrame, VDO_ALLOW, vdoAction, VDO_ORIGIN, type Devices } from './vdoLinks.ts'

// The table's call lives here, above the screens, so moving between the Join screen, the table, the
// sheet and the DM's screens never drops it. Nothing starts until you press Join voice and camera;
// after that the call carries on in this tab (a reload rejoins) until you leave or close it.
//
// One tab per browser sends your camera and plays everyone's voices, chosen with a Web Lock like the
// table's music, so a DM with two screens open is sent and heard once. The tabs keep each other in
// step (joined, camera, microphone, devices) over a BroadcastChannel.

/** How long VDO.Ninja gets to start your camera before the app says something is wrong. */
const START_TIMEOUT_MS = 20_000
const VOLUMES_KEY = 'dnd-table-voice-volumes'

type Prefs = { joined: boolean; camera: boolean; mic: boolean }
const NOT_JOINED: Prefs = { joined: false, camera: true, mic: true }

type TabMessage = { type: 'hello' } | { type: 'state'; prefs: Prefs; devices: Devices }

const prefsKey = (campaignId: string) => `dnd-table-call-${campaignId}`

function loadPrefs(campaignId: string): Prefs {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(prefsKey(campaignId)) ?? 'null') as Partial<Prefs> | null
    if (saved && typeof saved.joined === 'boolean') {
      return { joined: saved.joined, camera: saved.camera !== false, mic: saved.mic !== false }
    }
  } catch {
    // Nothing saved for this tab.
  }
  return NOT_JOINED
}

function savePrefs(campaignId: string, prefs: Prefs): void {
  try {
    window.sessionStorage.setItem(prefsKey(campaignId), JSON.stringify(prefs))
  } catch {
    // A reload just won't rejoin by itself.
  }
}

function loadVolumes(): Record<string, number> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(VOLUMES_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(saved).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    )
  } catch {
    return {}
  }
}

function hasBeenClicked(): boolean {
  return typeof navigator === 'undefined' || !navigator.userActivation || navigator.userActivation.hasBeenActive
}

/** The table in the address, from '/c/<id>' and everything under it. */
function campaignInPath(path: string): string | null {
  const id = /^\/c\/([^/]+)/.exec(path)?.[1]
  return id ? decodeURIComponent(id) : null
}

export function CallProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const inPath = campaignInPath(useHashPath())
  // The last table opened in this tab, so a quick look at the credits doesn't drop the call.
  const [campaignId, setCampaignId] = useState(inPath)
  if (inPath && inPath !== campaignId) setCampaignId(inPath)
  const userId = auth.status === 'signedIn' ? auth.user.id : null

  if (!campaignId || !userId) return children
  return (
    <TableCallLayer key={`${campaignId}:${userId}`} campaignId={campaignId} userId={userId}>
      {children}
    </TableCallLayer>
  )
}

/** The call at a real table: camera details from the database, and who's in the call from presence. */
function TableCallLayer({ campaignId, userId, children }: { campaignId: string; userId: string; children: ReactNode }) {
  const [details, setDetails] = useState<CameraDetails | null>(null)
  const loadDetails = useCallback(() => {
    getCameraDetails(campaignId, userId)
      .then(setDetails)
      .catch(() => undefined)
  }, [campaignId, userId])
  useEffect(loadDetails, [loadDetails])
  useCameraKeyBroadcasts(campaignId, userId, loadDetails)
  const calls = useCallPresence(campaignId, userId)
  const announce = useCallback((call: CallPresence | null) => setCallPresence(campaignId, call), [campaignId])
  const renew = useCallback(async () => {
    await renewCameraKey(campaignId)
    broadcastCameraKey(campaignId)
    loadDetails()
  }, [campaignId, loadDetails])

  return (
    <CallEngine
      campaignId={campaignId}
      userId={userId}
      details={details}
      calls={calls}
      announce={announce}
      renewCameraKey={renew}
    >
      {children}
    </CallEngine>
  )
}

type CameraDetails = { cameraId: string; key: string }

type CallEngineProps = {
  campaignId: string
  userId: string
  /** Your camera address and the table's camera password, once loaded. */
  details: CameraDetails | null
  /** Everyone in the call, by user id. */
  calls: ReadonlyMap<string, CallPresence>
  /** Tells the table whether you're in the call, and with what switched on. */
  announce: (call: CallPresence | null) => void
  renewCameraKey: () => Promise<void>
  children: ReactNode
}

/**
 * Joining, leaving, muting and devices, the one tab that sends and plays, and the hidden sender.
 * The design previews run it too, with made-up details, to try a real call between two browsers.
 */
export function CallEngine({
  campaignId,
  userId,
  details,
  calls,
  announce,
  renewCameraKey,
  children,
}: CallEngineProps) {
  const [prefs, setPrefs] = useState(() => loadPrefs(campaignId))
  const [devices, setDevicesState] = useState(loadDevices)
  const [problem, setProblem] = useState<string | null>(null)
  const [volumes, setVolumes] = useState(loadVolumes)

  // Keep this table's tabs in this browser in step.
  const tabs = useRef<BroadcastChannel | null>(null)
  const latest = useRef({ prefs, devices })
  useEffect(() => {
    latest.current = { prefs, devices }
  }, [prefs, devices])

  const apply = useCallback(
    (next: Prefs, nextDevices: Devices, tell: boolean) => {
      setPrefs(next)
      setDevicesState(nextDevices)
      savePrefs(campaignId, next)
      saveDevices(nextDevices)
      if (tell) tabs.current?.postMessage({ type: 'state', prefs: next, devices: nextDevices } satisfies TabMessage)
    },
    [campaignId],
  )

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(`dnd-table-call-${campaignId}`)
    tabs.current = channel
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data
      if (message.type === 'hello' && latest.current.prefs.joined) {
        channel.postMessage({ type: 'state', ...latest.current } satisfies TabMessage)
      } else if (message.type === 'state') {
        apply(message.prefs, message.devices, false)
      }
    }
    channel.postMessage({ type: 'hello' } satisfies TabMessage)
    return () => {
      channel.close()
      tabs.current = null
    }
  }, [campaignId, apply])

  // One tab per browser sends and plays the call: whichever joined first, then the next if it closes.
  const canLock = typeof navigator !== 'undefined' && Boolean(navigator.locks)
  const [lockHeld, setLockHeld] = useState(false)
  useEffect(() => {
    if (!prefs.joined || !canLock) return
    const done = new AbortController()
    navigator.locks
      .request(`dnd-table-call-${campaignId}`, { signal: done.signal }, () => {
        setLockHeld(true)
        return new Promise<void>((resolve) => done.signal.addEventListener('abort', () => resolve()))
      })
      .catch(() => undefined)
    return () => {
      done.abort()
      setLockHeld(false)
    }
  }, [campaignId, prefs.joined, canLock])
  const owner = prefs.joined && (lockHeld || !canLock)

  // Browsers play sound only after a click on the page; joining is one, and so is any click after a reload.
  const [clicked, setClicked] = useState(hasBeenClicked)
  useEffect(() => {
    if (clicked) return
    const done = () => setClicked(true)
    window.addEventListener('pointerdown', done, { capture: true })
    window.addEventListener('keydown', done, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', done, { capture: true })
      window.removeEventListener('keydown', done, { capture: true })
    }
  }, [clicked])

  const camera = prefs.joined && prefs.camera && devices.camera !== null
  const mic = prefs.joined && prefs.mic && devices.microphone !== null

  // The address VDO.Ninja sends from changes only with the devices or the password; camera and
  // microphone switch through messages, so muting never reconnects anyone.
  const sendKey = owner && details ? `${details.cameraId}|${details.key}|${JSON.stringify(devices)}` : null
  const [sending, setSending] = useState<{ key: string; url: string } | null>(null)
  if ((sending?.key ?? null) !== sendKey) {
    setSending(
      sendKey && details
        ? { key: sendKey, url: sendUrl({ ...details, devices, cameraOff: !prefs.camera, micOff: !prefs.mic }) }
        : null,
    )
  }
  const [result, setResult] = useState<{ url: string; status: CallStatus } | null>(null)
  const onResult = useCallback((url: string, status: CallStatus) => setResult({ url, status }), [])

  let status: CallStatus = 'off'
  if (prefs.joined && owner) status = sending && result?.url === sending.url ? result.status : 'starting'
  else if (prefs.joined) status = calls.has(userId) ? 'live' : 'starting'

  // Tell the table, once your camera is really on its way.
  useEffect(() => {
    announce(owner && status === 'live' ? { camera, mic } : null)
  }, [announce, owner, status, camera, mic])
  useEffect(() => () => announce(null), [announce])

  const join = useCallback(async () => {
    setProblem(null)
    const found = await checkDevices(latest.current.devices)
    if (found) {
      setProblem(found)
      return
    }
    setClicked(true)
    apply({ joined: true, camera: true, mic: true }, latest.current.devices, true)
  }, [apply])

  const leave = useCallback(() => {
    setProblem(null)
    apply(NOT_JOINED, latest.current.devices, true)
  }, [apply])

  const setCamera = useCallback(
    (on: boolean) => apply({ ...latest.current.prefs, camera: on }, latest.current.devices, true),
    [apply],
  )
  const setMic = useCallback(
    (on: boolean) => apply({ ...latest.current.prefs, mic: on }, latest.current.devices, true),
    [apply],
  )
  const setDevices = useCallback(
    (next: Devices) => {
      setProblem(null)
      apply(latest.current.prefs, next, true)
    },
    [apply],
  )
  const setMicLevel = useCallback(
    (level: number) => apply(latest.current.prefs, { ...latest.current.devices, micLevel: clampMicLevel(level) }, true),
    [apply],
  )

  const setVolume = useCallback((who: string, volume: number) => {
    setVolumes((before) => {
      const next = { ...before, [who]: volume }
      try {
        window.localStorage.setItem(VOLUMES_KEY, JSON.stringify(next))
      } catch {
        // The volume still changes until the tab closes.
      }
      return next
    })
  }, [])
  const volumeOf = useCallback((who: string) => volumes[who] ?? 1, [volumes])

  // M mutes and unmutes you, unless you're typing.
  useEffect(() => {
    if (!prefs.joined) return
    const press = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'm' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      setMic(!latest.current.prefs.mic)
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [prefs.joined, setMic])

  const value = useMemo<TableCall>(
    () => ({
      campaignId,
      userId,
      cameraKey: details?.key ?? null,
      joined: prefs.joined,
      camera,
      mic,
      devices,
      owner,
      hearing: owner && clicked,
      needsClick: owner && !clicked,
      status,
      problem:
        problem ??
        (status === 'failed'
          ? 'Your camera or microphone didn’t start in the call. Check the browser lets this page use them (the camera icon in the address bar), then leave and join again.'
          : null),
      calls,
      volumeOf,
      setVolume,
      join,
      leave,
      setCamera,
      setMic,
      setDevices,
      setMicLevel,
      renewCameraKey,
    }),
    [
      campaignId,
      userId,
      details,
      prefs.joined,
      camera,
      mic,
      devices,
      owner,
      clicked,
      status,
      problem,
      calls,
      volumeOf,
      setVolume,
      join,
      leave,
      setCamera,
      setMic,
      setDevices,
      setMicLevel,
      renewCameraKey,
    ],
  )

  return (
    <CallContext.Provider value={value}>
      {children}
      {sending && (
        <CallSender key={sending.url} url={sending.url} camera={prefs.camera} mic={prefs.mic} onResult={onResult} />
      )}
    </CallContext.Provider>
  )
}

type CallSenderProps = {
  url: string
  camera: boolean
  mic: boolean
  onResult: (url: string, status: CallStatus) => void
}

/** VDO.Ninja sending your camera and voice, in a frame too small to see. */
function CallSender({ url, camera, mic, onResult }: CallSenderProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const wanted = useRef({ camera, mic })

  useEffect(() => {
    wanted.current = { camera, mic }
    tellFrame(frame.current, { camera })
    tellFrame(frame.current, { mic })
  }, [camera, mic])

  useEffect(() => {
    const timer = window.setTimeout(() => onResult(url, 'failed'), START_TIMEOUT_MS)
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== VDO_ORIGIN || event.source !== frame.current?.contentWindow) return
      if (vdoAction(event.data) === 'seeding-started') {
        window.clearTimeout(timer)
        tellFrame(frame.current, { camera: wanted.current.camera })
        tellFrame(frame.current, { mic: wanted.current.mic })
        onResult(url, 'live')
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [url, onResult])

  return (
    <iframe
      ref={frame}
      className={styles.sender}
      src={url}
      allow={VDO_ALLOW}
      title="Your camera, sending"
      tabIndex={-1}
      aria-hidden="true"
    />
  )
}
