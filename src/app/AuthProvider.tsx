import { useEffect, useState, type ReactNode } from 'react'
import { initialAuthCallback, supabase } from '../live/supabase.ts'
import { recallNext } from './authActions.ts'
import { AuthContext, type AuthState } from './authContext.ts'
import { navigate } from './router.ts'

/** Keeps track of who is signed in, and finishes the trip back from a login email. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(supabase ? { status: 'loading' } : { status: 'unavailable' })

  useEffect(() => {
    if (!supabase) return
    // The first event arrives once any login in the address has been read.
    let first = true
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const loginError = first ? initialAuthCallback.error : null
      if (first) finishLoginRedirect()
      first = false
      setState(session ? { status: 'signedIn', user: session.user } : { status: 'signedOut', loginError })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

let loginRedirectFinished = false

/** Tidies the address after a login link (drops ?next= and the login after the '#'), then opens `next`. */
function finishLoginRedirect(): void {
  if (loginRedirectFinished || !initialAuthCallback.isCallback) return
  loginRedirectFinished = true
  navigate(initialAuthCallback.next ?? recallNext() ?? '/', { replace: true })
}
