import { describe, expect, it } from 'vitest'
import { describeParty, seatsFilled, welcomeWord } from './describeParty.ts'

describe('describeParty', () => {
  it('reads like the Join screen design', () => {
    expect(describeParty(4, 'Matt', 2)).toBe('A party of four · Run by Matt · Level 2')
  })

  it('spells out every party size the app offers', () => {
    expect(describeParty(1, 'Matt', 1)).toBe('A party of one · Run by Matt · Level 1')
    expect(describeParty(8, 'Matt', 1)).toBe('A party of eight · Run by Matt · Level 1')
  })
})

describe('welcomeWord', () => {
  const now = new Date('2026-10-25T20:00:00Z')

  it('says Welcome to someone who has just joined', () => {
    expect(welcomeWord('2026-10-25T19:55:00Z', now)).toBe('Welcome')
  })

  it('says Welcome back after that', () => {
    expect(welcomeWord('2026-10-24T19:00:00Z', now)).toBe('Welcome back')
  })
})

describe('seatsFilled', () => {
  it('counts players against the party size', () => {
    expect(seatsFilled(0, 4)).toBe('0 of 4 players have joined')
    expect(seatsFilled(1, 4)).toBe('1 of 4 players has joined')
    expect(seatsFilled(1, 1)).toBe('1 of 1 player has joined')
  })
})
