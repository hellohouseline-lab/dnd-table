import { useCallback, useEffect, useRef, useState } from 'react'
import { messageFor } from './errors.ts'
import { EMPTY_NOTEBOOK, getNotebook, saveNotebook, type Notebook } from './notebook.ts'

const SAVE_AFTER_MS = 800

export type NotebookControls = {
  notebook: Notebook
  status: 'loading' | 'ready' | 'error'
  /** Changes the notebook on screen at once and saves it a moment after the last change. */
  change: (notebook: Notebook) => void
  saving: boolean
  error: string | null
}

/** The DM's notebook, saved as it's written. */
export function useNotebook(campaignId: string): NotebookControls {
  const [notebook, setNotebook] = useState<Notebook>(EMPTY_NOTEBOOK)
  const [status, setStatus] = useState<NotebookControls['status']>('loading')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<Notebook | null>(null)

  useEffect(() => {
    let live = true
    getNotebook(campaignId).then(
      (loaded) => {
        if (!live) return
        setNotebook(loaded)
        setStatus('ready')
      },
      (caught: unknown) => {
        if (!live) return
        setError(messageFor(caught))
        setStatus('error')
      },
    )
    return () => {
      live = false
    }
  }, [campaignId])

  const flush = useCallback(() => {
    const next = pending.current
    if (!next) return
    pending.current = null
    setSaving(true)
    saveNotebook(campaignId, next).then(
      () => setSaving(false),
      (caught: unknown) => {
        setSaving(false)
        setError(messageFor(caught))
      },
    )
  }, [campaignId])

  // Save anything still waiting when the screen closes.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      flush()
    },
    [flush],
  )

  const change = useCallback(
    (next: Notebook) => {
      setError(null)
      setNotebook(next)
      pending.current = next
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_AFTER_MS)
    },
    [flush],
  )

  return { notebook, status, change, saving, error }
}
