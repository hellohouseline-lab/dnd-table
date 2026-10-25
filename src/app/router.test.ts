import { describe, expect, it } from 'vitest'
import { href, matchRoute, pathFromHash } from './router.ts'

describe('pathFromHash', () => {
  it('treats an empty hash as the home route', () => {
    expect(pathFromHash('')).toBe('/')
    expect(pathFromHash('#')).toBe('/')
  })

  it('reads the path after the hash', () => {
    expect(pathFromHash('#/credits')).toBe('/credits')
    expect(pathFromHash('#/overlay/abc123')).toBe('/overlay/abc123')
  })

  it('adds a missing leading slash', () => {
    expect(pathFromHash('#credits')).toBe('/credits')
  })

  it('ignores options after a question mark', () => {
    expect(pathFromHash('#/overlay/abc?stage=0')).toBe('/overlay/abc')
  })
})

describe('matchRoute', () => {
  it('matches fixed paths exactly', () => {
    expect(matchRoute('/', '/')).toEqual({})
    expect(matchRoute('/credits', '/credits')).toEqual({})
    expect(matchRoute('/credits', '/dm')).toBeNull()
  })

  it('reads named parts', () => {
    expect(matchRoute('/overlay/:token', '/overlay/abc123')).toEqual({ token: 'abc123' })
  })

  it('decodes named parts', () => {
    expect(matchRoute('/overlay/:token', '/overlay/a%20b')).toEqual({ token: 'a b' })
  })

  it('rejects paths of a different length', () => {
    expect(matchRoute('/overlay/:token', '/overlay')).toBeNull()
    expect(matchRoute('/credits', '/credits/more')).toBeNull()
  })

  it('rejects badly encoded parts instead of throwing', () => {
    expect(matchRoute('/overlay/:token', '/overlay/%E0%A4%A')).toBeNull()
  })
})

describe('href', () => {
  it('puts the path after a hash', () => {
    expect(href('/credits')).toBe('#/credits')
  })
})
