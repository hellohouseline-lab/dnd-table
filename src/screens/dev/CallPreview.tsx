import { useCallback, useState } from 'react'
import { CallEngine } from '../../call/CallProvider.tsx'
import type { CallPresence } from '../../live/campaignChannel.ts'
import { DmPreview } from './DmPreview.tsx'
import { JoinScreenPreview, TablePreview } from './JoinScreenPreview.tsx'
import { sampleMembers } from './sampleData.ts'

/** 24 hex characters from any text, so both browsers in one try work out the same camera password. */
function previewKey(run: string): string {
  let out = ''
  for (let part = 0; part < 3; part += 1) {
    let hash = 5381 + part
    for (const char of `${run}:${part}`) hash = (Math.imul(hash, 33) ^ char.charCodeAt(0)) >>> 0
    out += hash.toString(16).padStart(8, '0')
  }
  return out
}

/**
 * A real call between two browsers on the design previews, through VDO.Ninja, without signing in:
 * open #/dev/call/dm/<anything> in one and #/dev/call/p1/<the same> in another (or 'join' for the
 * player's Join screen). The DM and Sam each see the other in the call; nothing touches the database.
 */
export function CallPreview({ who, run }: { who: string; run: string }) {
  const me = who === 'dm' ? sampleMembers[0] : sampleMembers[1]
  const other = who === 'dm' ? sampleMembers[1] : sampleMembers[0]
  const [calls] = useState<ReadonlyMap<string, CallPresence>>(() => new Map([[other.user_id, { camera: true, mic: true }]]))
  const [details] = useState(() => ({ cameraId: me.camera_id, key: previewKey(run) }))
  const announce = useCallback(() => undefined, [])
  const renew = useCallback(async () => undefined, [])

  return (
    <CallEngine
      campaignId={`preview-${run}`}
      userId={me.user_id}
      details={details}
      calls={calls}
      announce={announce}
      renewCameraKey={renew}
    >
      {who === 'dm' ? <DmPreview tab="party" /> : who === 'join' ? <JoinScreenPreview as="player" /> : <TablePreview />}
    </CallEngine>
  )
}
