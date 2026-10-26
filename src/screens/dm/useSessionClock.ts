import { useEffect, useState } from 'react'

/**
 * How long tonight's session has run, as "1:24": from when the DM first opened their screen in this
 * tab (a reload carries on; a new tab starts again).
 */
export function useSessionClock(campaignId: string): string {
  const [start] = useState(() => {
    const key = `dnd-table-session-${campaignId}`
    try {
      const saved = Number(window.sessionStorage.getItem(key))
      if (saved > 0) return saved
      const now = Date.now()
      window.sessionStorage.setItem(key, String(now))
      return now
    } catch {
      return Date.now()
    }
  })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(timer)
  }, [])
  const minutes = Math.max(0, Math.floor((now - start) / 60_000))
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}
