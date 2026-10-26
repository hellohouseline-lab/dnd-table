import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../components/cx.ts'
import { Icon } from '../components/Icon.tsx'
import { Portrait } from '../components/Portrait.tsx'
import type { CallPresence } from '../live/campaignChannel.ts'
import { useTableCall, type TableCall } from './callContext.ts'
import styles from './Call.module.css'
import { useLocalMedia } from './devices.ts'
import { tellFrame, VDO_ALLOW, vdoAction, VDO_ORIGIN, watchUrl } from './vdoLinks.ts'

/** How much of someone's upload one camera tile may use, in kilobits a second. */
const TILE_BITRATE = 300

type CameraFeedProps = {
  userId: string
  cameraId: string
  name: string
  portraitPath: string | null
  online: boolean
  you: boolean
}

/**
 * What fills a camera tile: someone's live camera and voice, your own camera straight from your
 * computer, or their portrait and a word or two when there's no picture.
 */
export function CameraFeed({ userId, cameraId, name, portraitPath, online, you }: CameraFeedProps) {
  const call = useTableCall()
  if (!call) {
    return <Placeholder portraitPath={portraitPath} name={name} label={online ? 'Here' : 'Not here yet'} here={online} />
  }
  if (you) return <OwnFeed call={call} portraitPath={portraitPath} name={name} />
  const presence = call.calls.get(userId)
  if (presence && call.cameraKey) {
    return (
      <RemoteFeed
        key={cameraId}
        call={call}
        userId={userId}
        cameraId={cameraId}
        cameraKey={call.cameraKey}
        presence={presence}
        portraitPath={portraitPath}
        name={name}
      />
    )
  }
  return (
    <Placeholder
      portraitPath={portraitPath}
      name={name}
      label={online ? 'Not in the call' : 'Not here yet'}
      here={online}
    />
  )
}

type PlaceholderProps = {
  portraitPath: string | null
  name: string
  label: string
  here?: boolean
  problem?: boolean
  children?: ReactNode
}

function Placeholder({ portraitPath, name, label, here, problem, children }: PlaceholderProps) {
  return (
    <div className={styles.placeholder}>
      {portraitPath && <Portrait path={portraitPath} size={46} name={name} />}
      <span className={cx(styles.label, here && styles.here, problem && styles.problem)}>
        {!portraitPath && <Icon name="camera" size={14} />}
        {label}
      </span>
      {children}
    </div>
  )
}

function LiveVideo({ stream, mirrored }: { stream: MediaStream; mirrored?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (video.current) video.current.srcObject = stream
  }, [stream])
  return <video ref={video} className={cx(styles.video, mirrored && styles.mirrored)} autoPlay muted playsInline />
}

function OwnFeed({ call, portraitPath, name }: { call: TableCall; portraitPath: string | null; name: string }) {
  const { stream } = useLocalMedia(call.devices, call.joined && call.camera)

  if (!call.joined) {
    return (
      <div className={styles.feed}>
        <Placeholder
          portraitPath={portraitPath}
          name={name}
          label={call.problem ? 'Couldn’t start' : 'Not in the call'}
          problem={Boolean(call.problem)}
        >
          <button type="button" className={styles.join} title={call.problem ?? undefined} onClick={() => void call.join()}>
            Join voice and camera
          </button>
        </Placeholder>
      </div>
    )
  }

  let label = 'Camera off'
  if (call.status === 'starting') label = 'Connecting…'
  else if (call.status === 'failed') label = 'Couldn’t start'
  return (
    <div className={styles.feed}>
      {stream && call.camera ? (
        <LiveVideo stream={stream} mirrored />
      ) : (
        <Placeholder portraitPath={portraitPath} name={name} label={label} problem={call.status === 'failed'} />
      )}
      {call.needsClick && <div className={styles.notice}>Click anywhere to hear everyone</div>}
      <div className={cx(styles.tools, (!call.mic || call.status === 'failed') && styles.toolsShown)}>
        <button
          type="button"
          className={cx(styles.tool, !call.mic && styles.toolOff)}
          aria-pressed={!call.mic}
          aria-label={call.mic ? 'Mute (M)' : 'Unmute (M)'}
          title={call.mic ? 'Mute (M)' : 'Unmute (M)'}
          disabled={call.devices.microphone === null}
          onClick={() => call.setMic(!call.mic)}
        >
          <Icon name={call.mic ? 'mic' : 'micOff'} size={15} />
        </button>
        <button
          type="button"
          className={cx(styles.tool, !call.camera && styles.toolOff)}
          aria-pressed={!call.camera}
          aria-label={call.camera ? 'Turn your camera off' : 'Turn your camera on'}
          title={call.camera ? 'Turn your camera off' : 'Turn your camera on'}
          disabled={call.devices.camera === null}
          onClick={() => call.setCamera(!call.camera)}
        >
          <Icon name={call.camera ? 'camera' : 'cameraOff'} size={15} />
        </button>
        <button
          type="button"
          className={styles.tool}
          aria-label="Leave the call"
          title={call.problem ?? 'Leave the call'}
          onClick={call.leave}
        >
          <Icon name="leave" size={15} />
        </button>
      </div>
    </div>
  )
}

type RemoteFeedProps = {
  call: TableCall
  userId: string
  cameraId: string
  cameraKey: string
  presence: CallPresence
  portraitPath: string | null
  name: string
}

/** Someone else's camera and voice, from VDO.Ninja. Their voice plays only in the tab that plays the call. */
function RemoteFeed({ call, userId, cameraId, cameraKey, presence, portraitPath, name }: RemoteFeedProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const url = watchUrl({ cameraId, key: cameraKey, sound: call.hearing, bitrate: TILE_BITRATE })
  const [picture, setPicture] = useState<string | null>(null)
  const showing = picture === url
  const volume = call.volumeOf(userId)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== VDO_ORIGIN || event.source !== frame.current?.contentWindow) return
      const action = vdoAction(event.data)
      if (action === 'new-video-track-added' || action === 'video-element-created') setPicture(url)
      else if (action === 'new-audio-track-added') tellFrame(frame.current, { volume })
      else if (action === 'end-view-connection') setPicture(null)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [url, volume])

  useEffect(() => tellFrame(frame.current, { volume }), [volume])

  return (
    <div className={styles.feed}>
      <iframe
        key={url}
        ref={frame}
        className={cx(styles.frame, !(showing && presence.camera) && styles.hidden)}
        src={url}
        allow={VDO_ALLOW}
        title={`${name}’s camera`}
        tabIndex={-1}
      />
      {!(showing && presence.camera) && (
        <Placeholder
          portraitPath={portraitPath}
          name={name}
          label={presence.camera ? 'Connecting…' : 'Camera off'}
          here
        />
      )}
      {call.hearing && (
        <div className={cx(styles.tools, styles.volumeTools)}>
          <Icon name="volume" size={15} />
          <input
            className={styles.volume}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label={`${name}’s voice, on your screen`}
            title={`${name}’s voice, on your screen`}
            onChange={(event) => call.setVolume(userId, Number(event.target.value))}
          />
        </div>
      )}
    </div>
  )
}
