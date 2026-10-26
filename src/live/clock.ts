// The server's clock, so every browser starts the music from the same moment even when computer
// clocks disagree. Asked once per page; until then the computer's own clock is used.

import { supabase } from './supabase.ts'

let offset = 0
let asked: Promise<void> | null = null

/** How far this computer's clock is from the server's, in milliseconds. */
export function syncClock(): Promise<void> {
  if (!asked && supabase) {
    const client = supabase
    asked = (async () => {
      const sent = Date.now()
      const { data, error } = await client.rpc('server_time')
      if (error || !data) return
      const received = Date.now()
      offset = new Date(data).getTime() - (sent + received) / 2
    })().catch(() => undefined)
  }
  return asked ?? Promise.resolve()
}

/** The server's time now, in milliseconds. */
export function serverNow(): number {
  return Date.now() + offset
}
