import { NOT_CONNECTED, TableError } from '../live/errors.ts'
import { loginRedirectUrl, loginSendError, safeNext } from '../live/loginLinks.ts'
import { siteUrl, supabase } from '../live/supabase.ts'
import { navigate } from './router.ts'

/** Emails a login link. After clicking it, the person lands on `next`. */
export async function sendLoginLink(email: string, next: string): Promise<void> {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  rememberNext(next)
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: loginRedirectUrl(siteUrl(), next) },
  })
  if (error) throw new TableError(loginSendError(error))
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
  navigate('/', { replace: true })
}

// The email link carries ?next=<screen>. As a fallback, the browser that asked for the link also
// remembers it for an hour, in case the link comes back without it.
const NEXT_KEY = 'dnd-table:after-login'
const NEXT_LIFETIME_MS = 60 * 60 * 1000

function rememberNext(next: string): void {
  try {
    localStorage.setItem(NEXT_KEY, JSON.stringify({ next, at: Date.now() }))
  } catch {
    // Storage can be blocked; the ?next= in the link still works.
  }
}

/** The screen remembered when the login link was requested, used once and then forgotten. */
export function recallNext(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(NEXT_KEY) ?? 'null') as { next?: string; at?: number } | null
    localStorage.removeItem(NEXT_KEY)
    if (!saved?.next || !saved.at || Date.now() - saved.at > NEXT_LIFETIME_MS) return null
    return safeNext(saved.next)
  } catch {
    return null
  }
}
