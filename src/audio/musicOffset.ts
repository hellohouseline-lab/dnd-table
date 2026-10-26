// Where a looping track should be now, so every browser plays the same moment.

/** Seconds into the track: from when it started, wrapped round its length; or where it was paused. */
export function musicOffset(
  want: { playing: boolean; startedAt: number | null; position: number },
  duration: number,
  now: number,
): number {
  if (!want.playing || want.startedAt === null || !(duration > 0)) return Math.max(0, want.position)
  const elapsed = Math.max(0, (now - want.startedAt) / 1000)
  return elapsed % duration
}
