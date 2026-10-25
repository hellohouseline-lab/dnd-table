import type { User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'signedOut'; loginError: string | null }
  | { status: 'signedIn'; user: User }

export const AuthContext = createContext<AuthState>({ status: 'loading' })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/** The signed-in person. Only for screens the router shows after sign-in. */
export function useSignedInUser(): User {
  const auth = useAuth()
  if (auth.status !== 'signedIn') throw new Error('useSignedInUser is only for signed-in screens')
  return auth.user
}
