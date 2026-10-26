// Addresses for VDO.Ninja, the free service that carries the table's cameras and voices. Each
// person's camera is sent under their camera address (`campaign_members.camera_id`), and the
// table's camera password (`campaigns.camera_key`) is needed both to send and to watch. The app
// shows VDO.Ninja's pages in hidden or tile-sized frames with all of VDO.Ninja's own buttons hidden,
// and talks to them through its IFRAME API (messages between the page and the frame).

export const VDO_ORIGIN = 'https://vdo.ninja'

/** What a frame may use: the camera and microphone to send, and sound to play. */
export const VDO_ALLOW = 'camera *; microphone *; autoplay'

/** A camera or microphone by its name as the browser lists it, '' for the computer's own choice, or null for none. */
export type DeviceChoice = string | null

export type Devices = { camera: DeviceChoice; microphone: DeviceChoice }

/** VDO.Ninja picks a device whose name contains this, with underscores for spaces; 1 is the default and 0 none. */
export function deviceParam(choice: DeviceChoice): string {
  if (choice === null) return '0'
  const name = choice.trim()
  return name ? name.replace(/\s+/g, '_') : '1'
}

function address(params: Record<string, string>, flags: string[]): string {
  return `${VDO_ORIGIN}/?${new URLSearchParams(params).toString()}${flags.map((flag) => `&${flag}`).join('')}`
}

export type SendOptions = {
  cameraId: string
  key: string
  devices: Devices
  /** Start with the camera or microphone switched off; they're switched later without reloading. */
  cameraOff: boolean
  micOff: boolean
}

/** Sends your camera and voice straight away, without any of VDO.Ninja's own screens. */
export function sendUrl({ cameraId, key, devices, cameraOff, micOff }: SendOptions): string {
  const flags = ['autostart', 'webcam', 'cleanoutput']
  if (micOff) flags.push('mute')
  if (cameraOff) flags.push('videomute')
  return address(
    {
      push: cameraId,
      password: key,
      videodevice: deviceParam(devices.camera),
      audiodevice: deviceParam(devices.microphone),
    },
    flags,
  )
}

export type WatchOptions = {
  cameraId: string
  key: string
  /** Play their voice here. Only the one tab per browser that plays the call asks for sound. */
  sound: boolean
  /** How much of their upload this copy may use, in kilobits a second. Camera tiles are small. */
  bitrate: number
}

/** Shows one person's camera filling the frame, with their voice if `sound`. */
export function watchUrl({ cameraId, key, sound, bitrate }: WatchOptions): string {
  const flags = ['cleanoutput', 'cover', 'transparent']
  if (!sound) flags.push('noaudio')
  return address({ view: cameraId, password: key, videobitrate: String(bitrate) }, flags)
}

/** The `action` of a message from a VDO.Ninja frame, such as 'seeding-started', or null for anything else. */
export function vdoAction(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const action = (data as { action?: unknown }).action
  return typeof action === 'string' ? action : null
}

/** Sends a command to a VDO.Ninja frame, such as `{ mic: false }` or `{ volume: 0.5 }`. */
export function tellFrame(frame: HTMLIFrameElement | null, command: Record<string, unknown>): void {
  frame?.contentWindow?.postMessage(command, VDO_ORIGIN)
}
