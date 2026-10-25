import { describe, expect, it } from 'vitest'
import { inviteLink, isJoinCode, normaliseJoinCode } from './joinCode.ts'

describe('normaliseJoinCode', () => {
  it('ignores case, spaces and dashes', () => {
    expect(normaliseJoinCode('k7q-m2p')).toBe('K7QM2P')
    expect(normaliseJoinCode(' K7Q M2P ')).toBe('K7QM2P')
  })
})

describe('isJoinCode', () => {
  it('accepts six easy-to-read characters', () => {
    expect(isJoinCode('K7QM2P')).toBe(true)
  })

  it('refuses the wrong length', () => {
    expect(isJoinCode('K7QM2')).toBe(false)
    expect(isJoinCode('K7QM2PX')).toBe(false)
  })

  it('refuses look-alike characters the codes never use', () => {
    expect(isJoinCode('K7QM2O')).toBe(false)
    expect(isJoinCode('K7QM21')).toBe(false)
    expect(isJoinCode('K7QMI2')).toBe(false)
  })
})

describe('inviteLink', () => {
  it('opens the join screen for the code', () => {
    expect(inviteLink('https://hellohouseline-lab.github.io/dnd-table/', 'K7QM2P')).toBe(
      'https://hellohouseline-lab.github.io/dnd-table/#/join/K7QM2P',
    )
  })
})
