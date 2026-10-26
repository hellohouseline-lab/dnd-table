import { useEffect, useRef, useState } from 'react'
import { buttonClassName } from '../components/buttonClassName.ts'
import { cx } from '../components/cx.ts'
import { SelectField } from '../components/Field.tsx'
import { Notice } from '../components/Notice.tsx'
import { useTableCall, type TableCall } from './callContext.ts'
import styles from './CameraCheck.module.css'
import { listDevices, useLocalMedia, useMicLevel, type DeviceList } from './devices.ts'
import type { DeviceChoice } from './vdoLinks.ts'

const USUAL = '__usual'
const NONE = '__none'

const toValue = (choice: DeviceChoice) => (choice === null ? NONE : choice || USUAL)
const fromValue = (value: string): DeviceChoice => (value === NONE ? null : value === USUAL ? '' : value)

/**
 * "Your camera" on the Join screen (design 01): check your camera and microphone, pick which ones,
 * and join the table's voice and camera call. The same feed goes to everyone's camera column and,
 * from milestone 8, every streamer's overlay.
 */
export function CameraCheck({ isDm = false }: { isDm?: boolean }) {
  const call = useTableCall()
  return call ? (
    <LiveCameraCheck call={call} isDm={isDm} />
  ) : (
    <>
      <div className={styles.preview}>
        <span className={styles.previewLabel}>Camera preview 16:9</span>
      </div>
      <StatusRow label="Not joined yet" />
      <Note />
    </>
  )
}

function StatusRow({ label, tone }: { label: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={styles.status}>
      <span>Voice and camera</span>
      <span className={cx(styles.statusValue, tone === 'good' && styles.good, tone === 'bad' && styles.bad)}>
        {label}
      </span>
    </div>
  )
}

function Note() {
  return (
    <p className={styles.note}>
      The same feed appears in everyone&rsquo;s camera column and in every streamer&rsquo;s overlay. Wear headphones,
      so your microphone doesn&rsquo;t pick up everyone else.
    </p>
  )
}

function statusOf(call: TableCall): { label: string; tone?: 'good' | 'bad' } {
  if (!call.joined) return { label: 'Not joined yet' }
  if (call.status === 'failed') return { label: 'Couldn’t start', tone: 'bad' }
  if (call.status === 'starting') return { label: 'Connecting…' }
  return { label: call.owner ? 'Connected' : 'Connected in your other tab', tone: 'good' }
}

function LiveCameraCheck({ call, isDm }: { call: TableCall; isDm: boolean }) {
  const [checking, setChecking] = useState(false)
  const [joining, setJoining] = useState(false)
  const [list, setList] = useState<DeviceList>({ cameras: [], microphones: [] })
  const [renewing, setRenewing] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle')
  const { stream, problem } = useLocalMedia(call.devices, checking || call.joined, true)
  const level = useMicLevel(call.joined && !call.mic ? null : stream)
  const showVideo = Boolean(stream?.getVideoTracks().length) && (!call.joined || call.camera)

  // Device names are only given once the browser may use them, so look again once the preview opens.
  useEffect(() => {
    let live = true
    const refresh = () => void listDevices().then((found) => live && setList(found))
    refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    return () => {
      live = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
    }
  }, [stream])

  async function join() {
    setJoining(true)
    await call.join()
    setJoining(false)
  }

  async function renew() {
    if (!window.confirm('Make new camera links? Everyone’s camera reconnects by itself in a few seconds.')) return
    setRenewing('busy')
    try {
      await call.renewCameraKey()
      setRenewing('done')
    } catch {
      setRenewing('failed')
    }
  }

  const status = statusOf(call)
  const named = list.cameras.length > 0 || list.microphones.length > 0

  return (
    <>
      <div className={styles.preview}>
        {showVideo && stream ? (
          <PreviewVideo stream={stream} />
        ) : call.joined || checking ? (
          <span className={styles.previewLabel}>{call.devices.camera === null ? 'No camera' : 'Camera off'}</span>
        ) : (
          <button type="button" className={buttonClassName('outline', { size: 'small' })} onClick={() => setChecking(true)}>
            Check my camera
          </button>
        )}
        {(checking || call.joined) && stream?.getAudioTracks().length ? (
          <div className={styles.meter} role="meter" aria-label="Your microphone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
            <div className={styles.meterFill} style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        ) : null}
      </div>

      {named && (
        <div className={styles.devices}>
          <SelectField
            label="Camera"
            value={toValue(call.devices.camera)}
            onChange={(event) => call.setDevices({ ...call.devices, camera: fromValue(event.target.value) })}
          >
            <option value={USUAL}>This computer&rsquo;s usual one</option>
            {list.cameras.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={NONE}>No camera</option>
          </SelectField>
          <SelectField
            label="Microphone"
            value={toValue(call.devices.microphone)}
            onChange={(event) => call.setDevices({ ...call.devices, microphone: fromValue(event.target.value) })}
          >
            <option value={USUAL}>This computer&rsquo;s usual one</option>
            {list.microphones.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={NONE}>No microphone</option>
          </SelectField>
        </div>
      )}

      <StatusRow {...status} />

      {call.joined ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={buttonClassName(call.mic ? 'outline' : 'primary', { size: 'small' })}
            disabled={call.devices.microphone === null}
            aria-pressed={!call.mic}
            onClick={() => call.setMic(!call.mic)}
          >
            {call.mic ? 'Mute' : 'Unmute'}
          </button>
          <button
            type="button"
            className={buttonClassName(call.camera ? 'outline' : 'primary', { size: 'small' })}
            disabled={call.devices.camera === null}
            aria-pressed={!call.camera}
            onClick={() => call.setCamera(!call.camera)}
          >
            {call.camera ? 'Camera off' : 'Camera on'}
          </button>
          <button type="button" className={buttonClassName('quiet', { size: 'small' })} onClick={call.leave}>
            Leave the call
          </button>
        </div>
      ) : (
        <button type="button" className={buttonClassName('primary')} disabled={joining} onClick={() => void join()}>
          {joining ? 'Asking your browser…' : 'Join voice and camera'}
        </button>
      )}

      {call.needsClick && <Notice>Click anywhere to hear everyone.</Notice>}
      {(call.problem ?? problem) && <Notice tone="error">{call.problem ?? problem}</Notice>}
      <Note />
      {call.joined && <p className={styles.note}>Press M on any screen to mute or unmute.</p>}

      {isDm && (
        <div className={styles.dmRow}>
          <button
            type="button"
            className={buttonClassName('quiet', { size: 'small' })}
            disabled={renewing === 'busy'}
            onClick={() => void renew()}
          >
            Make new camera links
          </button>
          <span className={styles.note}>
            {renewing === 'done'
              ? 'Done. Everyone reconnects by itself.'
              : renewing === 'failed'
                ? 'That didn’t work. Check your connection and try again.'
                : 'Only needed if a camera link was shared by mistake.'}
          </span>
        </div>
      )}
    </>
  )
}

function PreviewVideo({ stream }: { stream: MediaStream }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (video.current) video.current.srcObject = stream
  }, [stream])
  return <video ref={video} className={styles.video} autoPlay muted playsInline />
}
