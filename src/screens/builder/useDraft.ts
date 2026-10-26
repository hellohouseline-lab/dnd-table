import { useCallback, useState } from 'react'
import { emptyDraft, type BuilderDraft } from '../../rules/build/draft.ts'

/** The builder's draft, kept in this browser as you go, so closing the tab loses nothing. */
export function useDraft(key: string | null): [BuilderDraft, (draft: BuilderDraft) => void] {
  const [draft, setDraft] = useState<BuilderDraft>(() => {
    if (!key) return emptyDraft()
    try {
      const kept = localStorage.getItem(key)
      return kept ? { ...emptyDraft(), ...(JSON.parse(kept) as Partial<BuilderDraft>) } : emptyDraft()
    } catch {
      return emptyDraft()
    }
  })
  const change = useCallback(
    (next: BuilderDraft) => {
      setDraft(next)
      if (!key) return
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // A private window may refuse; the draft still works for this visit.
      }
    },
    [key],
  )
  return [draft, change]
}
