import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import { readAuthCallback, type AuthCallback } from './loginLinks.ts'

const inBrowser = typeof window !== 'undefined'

// Read what a login link left in the address before the Supabase client tidies it away.
export const initialAuthCallback: AuthCallback = inBrowser
  ? readAuthCallback(window.location.search, window.location.hash)
  : { isCallback: false, next: null, error: null }

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** The connection to Supabase, or null when the site was built without its settings. */
export const supabase: SupabaseClient<Database> | null =
  inBrowser && url && key
    ? createClient<Database>(url, key, {
        auth: {
          // The login arrives after the '#' of the link in the email, so it works in whichever
          // browser opens that email. (The 'pkce' flow only works in the browser that asked.)
          flowType: 'implicit',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

/** This site's own address, such as https://hellohouseline-lab.github.io/dnd-table/ */
export function siteUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}
