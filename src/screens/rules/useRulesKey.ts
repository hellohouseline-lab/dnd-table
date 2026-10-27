import { useEffect } from 'react'

/** ? opens and closes the Rules panel (S1e), on the player's table and Screen 1, unless you're typing. */
export function useRulesKey(toggle: () => void): void {
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [toggle])
}
