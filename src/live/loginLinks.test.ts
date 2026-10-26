import { describe, expect, it } from 'vitest'
import {
  isLoginCode,
  loginCodeError,
  loginLinkError,
  loginRedirectUrl,
  loginSendError,
  normaliseLoginCode,
  readAuthCallback,
  safeNext,
} from './loginLinks.ts'

const SITE = 'https://hellohouseline-lab.github.io/dnd-table/'

describe('loginRedirectUrl', () => {
  it('sends people back to the site', () => {
    expect(loginRedirectUrl(SITE, '/')).toBe(SITE)
  })

  it('remembers the screen they were heading for', () => {
    expect(loginRedirectUrl(SITE, '/join/K7QM2P')).toBe(`${SITE}?next=%2Fjoin%2FK7QM2P`)
  })

  it('ignores anything that is not a screen on this site', () => {
    expect(loginRedirectUrl(SITE, 'https://example.com')).toBe(SITE)
  })
})

describe('readAuthCallback', () => {
  it('treats an ordinary visit as not a login', () => {
    expect(readAuthCallback('', '#/credits')).toEqual({ isCallback: false, next: null, error: null })
  })

  it('spots a successful login', () => {
    const callback = readAuthCallback('?next=%2Fjoin%2FK7QM2P', '#access_token=abc&refresh_token=def&type=magiclink')
    expect(callback).toEqual({ isCallback: true, next: '/join/K7QM2P', error: null })
  })

  it('explains an expired link', () => {
    const callback = readAuthCallback(
      '',
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+expired',
    )
    expect(callback.isCallback).toBe(true)
    expect(callback.error).toBe(loginLinkError('otp_expired'))
  })

  it('explains any other failed link', () => {
    expect(readAuthCallback('?error=server_error', '').error).toBe(loginLinkError(null))
  })
})

describe('safeNext', () => {
  it('allows screens on this site', () => {
    expect(safeNext('/c/123')).toBe('/c/123')
  })

  it('refuses other sites and empty values', () => {
    expect(safeNext('//evil.example')).toBeNull()
    expect(safeNext('https://evil.example')).toBeNull()
    expect(safeNext('')).toBeNull()
    expect(safeNext(null)).toBeNull()
  })
})

describe('login codes', () => {
  it('ignore spaces and other characters people type', () => {
    expect(normaliseLoginCode(' 123 456 ')).toBe('123456')
    expect(normaliseLoginCode('123-456')).toBe('123456')
  })

  it('are six to ten digits', () => {
    expect(isLoginCode('123456')).toBe(true)
    expect(isLoginCode('1234567890')).toBe(true)
    expect(isLoginCode('12345')).toBe(false)
    expect(isLoginCode('12345678901')).toBe(false)
  })

  it('explain a wrong or used code', () => {
    expect(loginCodeError({ status: 403, code: 'otp_expired' })).toMatch(/didn't work/)
  })

  it('ask people to wait after too many tries', () => {
    expect(loginCodeError({ status: 429 })).toMatch(/Wait a minute/)
  })
})

describe('loginSendError', () => {
  it('asks people to wait when too many emails have gone out', () => {
    expect(loginSendError({ status: 429 })).toMatch(/Wait a minute/)
    expect(loginSendError({ code: 'over_email_send_rate_limit' })).toMatch(/Wait a minute/)
  })

  it('points at a mistyped email', () => {
    expect(loginSendError({ code: 'email_address_invalid' })).toMatch(/doesn't look right/)
  })

  it('falls back to a connection hint', () => {
    expect(loginSendError({})).toMatch(/internet connection/)
  })
})
