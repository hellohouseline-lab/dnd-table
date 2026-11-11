import { describe, expect, it } from 'vitest'
import { attentionTitle } from './attention.ts'

describe('calling a player back to the table', () => {
  it('marks the tab title with what needs them', () => {
    expect(attentionTitle('Your turn', 'Thorin Ironfist · D&D Table')).toBe('● Your turn · Thorin Ironfist · D&D Table')
    expect(attentionTitle('Roll: Constitution saving throw', 'Elowen · D&D Table')).toBe(
      '● Roll: Constitution saving throw · Elowen · D&D Table',
    )
  })
})
