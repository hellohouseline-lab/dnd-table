import { useCallback, useEffect, useState, type DependencyList } from 'react'
import { messageFor } from './errors.ts'

export type Loaded<T> =
  | { status: 'loading'; reload: () => void }
  | { status: 'ready'; data: T; reload: () => void }
  | { status: 'error'; message: string; reload: () => void }

type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string }

/**
 * Runs `load` when the screen opens and whenever `deps` change; `reload()` runs it again.
 * While reloading, the last data stays on screen instead of flashing back to "loading".
 */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList): Loaded<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    load().then(
      (data) => current && setState({ status: 'ready', data }),
      (error: unknown) => current && setState({ status: 'error', message: messageFor(error) }),
    )
    return () => {
      current = false
    }
    // `load` is a new function every render; `deps` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
