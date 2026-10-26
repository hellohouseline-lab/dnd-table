import { createContext, useContext } from 'react'
import type { CallPresence } from '../live/campaignChannel.ts'
import type { Devices } from './vdoLinks.ts'

/** Off: not joined. Starting: your camera is on its way. Live: you're in. Failed: it didn't start. */
export type CallStatus = 'off' | 'starting' | 'live' | 'failed'

/** The table's voice and camera call, as this tab sees it. Lives above the screens, so it carries on between them. */
export type TableCall = {
  campaignId: string
  userId: string
  /** The table's camera password, once loaded. */
  cameraKey: string | null
  joined: boolean
  /** Your camera is on (and you have one). */
  camera: boolean
  /** Your microphone is on (and you have one). */
  mic: boolean
  devices: Devices
  /** This tab sends your camera and plays everyone's voices; one tab per browser does. */
  owner: boolean
  /** Voices play in this tab. */
  hearing: boolean
  /** This tab plays the call but the browser wants a click before it will play sound. */
  needsClick: boolean
  status: CallStatus
  /** Why the camera or microphone wouldn't start, in plain words. */
  problem: string | null
  /** Everyone in the call right now, by user id. */
  calls: ReadonlyMap<string, CallPresence>
  volumeOf: (userId: string) => number
  setVolume: (userId: string, volume: number) => void
  join: () => Promise<void>
  leave: () => void
  setCamera: (on: boolean) => void
  setMic: (on: boolean) => void
  setDevices: (devices: Devices) => void
  /** DM: a new camera password for the table. */
  renewCameraKey: () => Promise<void>
}

export const CallContext = createContext<TableCall | null>(null)

/** The call at the table on screen, or null on screens outside a table (and in the design previews). */
export function useTableCall(): TableCall | null {
  return useContext(CallContext)
}

/** Whether to show someone as muted on their name plate. */
export function isMuted(call: TableCall | null, userId: string, you: boolean): boolean {
  if (!call) return false
  if (you) return call.joined && !call.mic
  const presence = call.calls.get(userId)
  return Boolean(presence && !presence.mic)
}
