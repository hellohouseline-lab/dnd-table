import { useEffect, useState } from 'react'
import { playTurnChime } from './chime.ts'

// Calling a player back to the table when they're looking at another window (OBS, chat): a soft
// chime and a mark in the browser tab's title when it's their turn or the DM asks them to roll.
// The chime can be switched off, per browser; the title always changes.

const CHIME_KEY = 'dnd-table-turn-chime'

function chimeWanted(): boolean {
  try {
    return window.localStorage.getItem(CHIME_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Whether the turn chime is on in this browser, and a way to switch it. On to start with. */
export function useTurnChime(): { on: boolean; set: (on: boolean) => void } {
  const [on, setOn] = useState(chimeWanted)
  return {
    on,
    set: (next) => {
      setOn(next)
      try {
        window.localStorage.setItem(CHIME_KEY, next ? 'on' : 'off')
      } catch {
        // It still switches until the tab closes.
      }
    },
  }
}

/** The tab's title while something needs you: "● Your turn · Thorin · D&D Table". */
export function attentionTitle(needs: string, title: string): string {
  return `● ${needs} · ${title}`
}

// The table's own title (the character's name), and what's marked on it now. Kept here so the
// screen can rename the tab while a mark is showing without wiping it.
let plain: string | null = null
let marked: { needs: string; shown: string } | null = null

/** The table screen names the tab; a mark that's showing stays on. */
export function setTableTitle(title: string): void {
  plain = title
  if (marked) marked = { needs: marked.needs, shown: attentionTitle(marked.needs, title) }
  document.title = marked ? marked.shown : title
}

/**
 * While `needs` says something ("Your turn", "Roll: Constitution save"), the tab's title carries it,
 * and a chime plays as it arrives (if `chime`). Null when nothing needs you.
 */
export function useAttention(needs: string | null, chime: boolean): void {
  useEffect(() => {
    if (!needs) return
    if (chime) playTurnChime()
    const before = plain ?? document.title
    marked = { needs, shown: attentionTitle(needs, before) }
    document.title = marked.shown
    return () => {
      // Put the title back, unless another screen has already named the tab.
      if (marked && document.title === marked.shown) document.title = plain ?? before
      marked = null
    }
    // The chime's switch is read as the call arrives; flipping it mustn't ring again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs])
}
