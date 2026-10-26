import { describe, expect, it } from 'vitest'
import { adjustDamage, damageAdjustment, defencesText, parseDefence } from './damage.ts'

const troll = { resistances: ['cold', 'slashing:nonmagical'], vulnerabilities: ['fire'], immunities: ['poison'] }

describe('damage types', () => {
  it('halves resisted damage (rounded down), doubles vulnerable damage, and stops what it is immune to', () => {
    expect(adjustDamage(11, 'cold', false, troll)).toEqual({ amount: 5, adjust: 'resisted' })
    expect(adjustDamage(10, 'Fire', false, troll)).toEqual({ amount: 20, adjust: 'vulnerable' })
    expect(adjustDamage(10, 'poison', false, troll)).toEqual({ amount: 0, adjust: 'immune' })
    expect(adjustDamage(10, 'thunder', false, troll)).toEqual({ amount: 10, adjust: null })
    expect(adjustDamage(0, 'cold', false, troll)).toEqual({ amount: 0, adjust: null })
  })

  it('lets magic weapons past resistance to non-magical weapons', () => {
    expect(damageAdjustment('slashing', false, troll)).toBe('resisted')
    expect(damageAdjustment('slashing', true, troll)).toBeNull()
  })

  it('cancels resistance and vulnerability to the same damage', () => {
    expect(
      damageAdjustment('fire', false, { resistances: ['fire'], vulnerabilities: ['fire'], immunities: [] }),
    ).toBeNull()
  })

  it('reads the SRD’s words', () => {
    expect(parseDefence('cold')).toEqual(['cold'])
    expect(parseDefence('bludgeoning, piercing, and slashing from nonmagical weapons')).toEqual([
      'bludgeoning:nonmagical',
      'piercing:nonmagical',
      'slashing:nonmagical',
    ])
    expect(
      parseDefence("bludgeoning, piercing, and slashing from nonmagical weapons that aren't silvered"),
    ).toHaveLength(3)
    expect(parseDefence('damage from spells')).toEqual([])
    expect(parseDefence('piercing from magic weapons wielded by good creatures')).toEqual([])
  })

  it('says them in plain words', () => {
    expect(defencesText(troll)).toBe('Resists cold, slashing (non-magical); vulnerable to fire; immune to poison')
    expect(defencesText({ resistances: [], vulnerabilities: [], immunities: [] })).toBe('')
  })
})
