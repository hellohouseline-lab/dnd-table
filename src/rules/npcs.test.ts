import { describe, expect, it } from 'vitest'
import { makeSomeoneUp } from './npcs.ts'

describe('making someone up', () => {
  it('gives a full person every time', () => {
    let s = 7
    const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 50; i++) {
      const p = makeSomeoneUp(rand)
      expect(p.name).toMatch(/^\S+ \S+$/)
      expect(p.role && p.look && p.quirk && p.voice).toBeTruthy()
    }
    const a = makeSomeoneUp(() => 0)
    expect(a.name).toBe('Aldric Ashdown')
    expect(makeSomeoneUp(() => 0.999).voice).toBe('a dry, sarcastic drawl')
  })
})
