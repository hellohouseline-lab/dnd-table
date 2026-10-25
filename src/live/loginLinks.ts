// Login emails send people back to the site with ?next=<screen> in the address, and the login itself
// (or an error) after the '#'. These helpers build and read those addresses. They don't touch the page.

export type AuthCallback = {
  /** True when the address came from a login email. */
  isCallback: boolean
  /** The screen to show after signing in, such as '/join/K7QM2P'. */
  next: string | null
  /** A plain-words message when the link didn't work. */
  error: string | null
}

/** Where a login email should send someone back to, remembering the screen they were heading for. */
export function loginRedirectUrl(siteUrl: string, next: string): string {
  const url = new URL(siteUrl)
  const safe = safeNext(next)
  if (safe && safe !== '/') url.searchParams.set('next', safe)
  return url.toString()
}

/** Reads what a login link left in the address. */
export function readAuthCallback(search: string, hash: string): AuthCallback {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  const next = safeNext(query.get('next'))
  const hasLogin = fragment.has('access_token')
  const errorCode = fragment.get('error_code') ?? query.get('error_code')
  const hasError = fragment.has('error') || query.has('error') || errorCode !== null
  return {
    isCallback: hasLogin || hasError || next !== null,
    next,
    error: hasError ? loginLinkError(errorCode) : null,
  }
}

/** Only screens inside this site, like '/join/K7QM2P'. */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  return next
}

export function loginLinkError(code: string | null): string {
  if (code === 'otp_expired') {
    return 'That login link has expired or has already been used. Ask for a new one below.'
  }
  return "That login link didn't work. Ask for a new one below."
}

// The login email also carries a code, for signing in on a different device from the one that
// opened the email (say, reading email on a phone while playing on a PC).

/** What people type as the code: '123 456' becomes '123456'. */
export function normaliseLoginCode(input: string): string {
  return input.replace(/\D/g, '')
}

/** Supabase sends 6 digits unless its Email OTP Length setting says otherwise (up to 10). */
export function isLoginCode(code: string): boolean {
  return /^\d{6,10}$/.test(code)
}

/** Plain words for a code that didn't sign someone in. */
export function loginCodeError(error: { status?: number; code?: string }): string {
  if (error.status === 429 || error.code?.includes('rate_limit')) {
    return 'Too many tries just now. Wait a minute, then try again.'
  }
  if (error.code === 'otp_expired' || error.status === 401 || error.status === 403) {
    return "That code didn't work. Check it, and if you asked for more than one email, use the newest."
  }
  return "The code couldn't be checked. Check your internet connection and try again."
}

/** Plain words for a failure to send the login email. */
export function loginSendError(error: { status?: number; code?: string }): string {
  if (error.status === 429 || error.code?.includes('rate_limit')) {
    return 'Too many login emails have gone out just now. Wait a minute, then try again.'
  }
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
    return "That email address doesn't look right. Check it and try again."
  }
  return "The login email couldn't be sent. Check your internet connection and try again."
}
