import { useEffect, useState } from 'react'
import type { DeviceChoice, Devices } from './vdoLinks.ts'

// Your camera and microphone in this browser: which ones you picked (kept between visits), the list
// to pick from, your own camera for your tile and the camera check, and how loud your microphone is.
// VDO.Ninja opens the same devices again inside its frame to send them; browsers share them happily.

const DEVICES_KEY = 'dnd-table-devices'
const DEFAULT_DEVICES: Devices = { camera: '', microphone: '' }

function isChoice(value: unknown): value is DeviceChoice {
  return value === null || typeof value === 'string'
}

export function loadDevices(): Devices {
  try {
    const saved = JSON.parse(window.localStorage.getItem(DEVICES_KEY) ?? 'null') as Partial<Devices> | null
    if (saved && isChoice(saved.camera) && isChoice(saved.microphone)) {
      return { camera: saved.camera, microphone: saved.microphone }
    }
  } catch {
    // Nothing saved, or a private window that refuses; use the computer's own choice.
  }
  return DEFAULT_DEVICES
}

export function saveDevices(devices: Devices): void {
  try {
    window.localStorage.setItem(DEVICES_KEY, JSON.stringify(devices))
  } catch {
    // The choice still applies until the tab closes.
  }
}

export type DeviceList = { cameras: string[]; microphones: string[] }

/** The names of the cameras and microphones. Browsers give names only once you've allowed them. */
export async function listDevices(): Promise<DeviceList> {
  const all = (await navigator.mediaDevices?.enumerateDevices?.()) ?? []
  const names = (kind: MediaDeviceKind) =>
    [...new Set(all.filter((d) => d.kind === kind && d.label && d.deviceId !== 'default').map((d) => d.label))]
  return { cameras: names('videoinput'), microphones: names('audioinput') }
}

async function deviceIdFor(kind: MediaDeviceKind, choice: string): Promise<string | undefined> {
  if (!choice) return undefined
  const all = (await navigator.mediaDevices?.enumerateDevices?.()) ?? []
  return all.find((d) => d.kind === kind && d.label === choice)?.deviceId
}

async function constraintFor(kind: MediaDeviceKind, choice: DeviceChoice): Promise<MediaTrackConstraints | false> {
  if (choice === null) return false
  const deviceId = await deviceIdFor(kind, choice)
  return deviceId ? { deviceId: { exact: deviceId } } : {}
}

/** Plain words for why a camera or microphone wouldn't start. */
export function deviceProblem(caught: unknown): string {
  const name = caught instanceof DOMException || caught instanceof Error ? caught.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'The browser has been told not to use your camera or microphone. Click the camera icon in the address bar, allow both, then try again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'That camera or microphone wasn’t found. Pick another one, or choose No camera.'
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'Another app is using your camera or microphone. Close it (Teams, Zoom or the Camera app, say) and try again.'
  }
  return 'Your camera or microphone wouldn’t start. Check they’re plugged in, then try again.'
}

/** Opens the chosen camera and microphone, which asks the browser's permission the first time. */
export async function openDevices(devices: Devices, kinds: { video: boolean; audio: boolean }): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('No camera support')
  const video = kinds.video ? await constraintFor('videoinput', devices.camera) : false
  const audio = kinds.audio ? await constraintFor('audioinput', devices.microphone) : false
  if (!video && !audio) return new MediaStream()
  return navigator.mediaDevices.getUserMedia({ video, audio })
}

/** Checks the browser may use the chosen devices, then lets them go. Returns a problem in plain words, or null. */
export async function checkDevices(devices: Devices): Promise<string | null> {
  try {
    const stream = await openDevices(devices, { video: true, audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return null
  } catch (caught) {
    return deviceProblem(caught)
  }
}

export type LocalMedia = { stream: MediaStream | null; problem: string | null }

/**
 * Your own camera (and microphone, with `withMic`), straight from your computer, while `on`. Your tile
 * uses it, so your own picture never lags. Closed again when nothing needs it.
 */
export function useLocalMedia(devices: Devices, on: boolean, withMic = false): LocalMedia {
  const [media, setMedia] = useState<LocalMedia & { key: string }>({ stream: null, problem: null, key: '' })
  const key = on ? `${devices.camera ?? '∅'}|${withMic ? (devices.microphone ?? '∅') : '-'}` : ''

  useEffect(() => {
    if (!key) return
    let live = true
    let opened: MediaStream | null = null
    const [camera, microphone] = key.split('|')
    const choice: Devices = {
      camera: camera === '∅' ? null : camera,
      microphone: microphone === '∅' || microphone === '-' ? null : microphone,
    }
    openDevices(choice, { video: choice.camera !== null, audio: microphone !== '-' && choice.microphone !== null })
      .then((stream) => {
        if (!live) return stream.getTracks().forEach((track) => track.stop())
        opened = stream
        setMedia({ stream, problem: null, key })
      })
      .catch((caught: unknown) => live && setMedia({ stream: null, problem: deviceProblem(caught), key }))
    return () => {
      live = false
      opened?.getTracks().forEach((track) => track.stop())
    }
  }, [key])

  return media.key === key && key ? media : { stream: null, problem: null }
}

/** How loud a microphone is right now, from 0 to 1, updated about 15 times a second. */
export function useMicLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0 || typeof AudioContext === 'undefined') return
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) sum += sample * sample
      // Speech sits around 0.02 to 0.2 RMS; stretch it so the bar moves when you talk.
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 6))
    }, 66)
    return () => {
      window.clearInterval(timer)
      setLevel(0)
      void context.close()
    }
  }, [stream])
  return stream ? level : 0
}
