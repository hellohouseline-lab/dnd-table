import { useSyncExternalStore } from 'react'

// GitHub Pages has no single-page fallback, so every screen lives after the "#":
// /dnd-table/#/credits, /dnd-table/#/overlay/<secret> and so on.

/** The route path from a location hash: '#/credits?x=1' gives '/credits', '' gives '/'. */
export function pathFromHash(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0]
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * Matches a path against a pattern with ':name' parts.
 * matchRoute('/overlay/:token', '/overlay/abc') gives { token: 'abc' }; a mismatch gives null.
 */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const wanted = pattern.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (wanted.length !== actual.length) return null

  const params: Record<string, string> = {}
  for (const [i, part] of wanted.entries()) {
    if (part.startsWith(':')) {
      const value = safeDecode(actual[i])
      if (value === null) return null
      params[part.slice(1)] = value
    } else if (part !== actual[i]) {
      return null
    }
  }
  return params
}

/** The link target for a route, for use in href attributes. */
export function href(path: string): string {
  return `#${path}`
}

/**
 * Moves to another screen from code (links just use href). `replace` swaps the current history
 * entry instead of adding one, so Back skips it. Anything before the '#', like ?next=, is dropped.
 */
export function navigate(path: string, { replace = false }: { replace?: boolean } = {}): void {
  const url = `${window.location.pathname}#${path}`
  if (replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** The current route path, updating when the hash changes. */
export function useHashPath(): string {
  return useSyncExternalStore(subscribe, () => pathFromHash(window.location.hash), () => '/')
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
  }
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}
