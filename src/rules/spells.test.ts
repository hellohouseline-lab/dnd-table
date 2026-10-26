import { describe, expect, it } from 'vitest'
import { newBuild, NO_SPELLCASTING } from './character.ts'
import {
  castingCost,
  concentrationDc,
  lastingArea,
  slotChoices,
  spellAttackBonus,
  spellEffect,
  spellKind,
  spellRange,
  spellSaveDc,
  spellSummary,
} from './spells.ts'
import type { SrdSpell } from './srd/index.ts'

const base: SrdSpell = {
  index: 'x',
  name: 'X',
  level: 1,
  school: 'Evocation',
  castingTime: '1 action',
  range: '60 feet',
  components: 'V, S',
  duration: 'Instantaneous',
  concentration: false,
  ritual: false,
  classes: ['wizard'],
  desc: '',
}
const fireball: SrdSpell = {
  ...base,
  name: 'Fireball',
  level: 3,
  save: 'dexterity',
  dcSuccess: 'half',
  damage: { type: 'fire', slots: { 3: '8d6', 4: '9d6' } },
  area: { type: 'sphere', size: 20 },
}
const fireBolt: SrdSpell = {
  ...base,
  name: 'Fire Bolt',
  level: 0,
  attackType: 'ranged',
  damage: { type: 'fire', levels: { 1: '1d10', 5: '2d10', 11: '3d10' } },
}
const cureWounds: SrdSpell = { ...base, name: 'Cure Wounds', range: 'Touch', heal: { 1: '1d8 + MOD', 2: '2d8 + MOD' } }
const wizard = {
  ...newBuild(),
  level: 5,
  scores: { strength: 8, dexterity: 14, constitution: 14, intelligence: 16, wisdom: 12, charisma: 10 },
  spellcasting: { ...NO_SPELLCASTING, ability: 'intelligence' as const },
}

describe('spells', () => {
  it('knows what casting costs', () => {
    expect(castingCost('1 action')).toBe('action')
    expect(castingCost('1 bonus action')).toBe('bonus')
    expect(castingCost('1 reaction, which you take when you are hit')).toBe('reaction')
    expect(castingCost('1 minute')).toBe('longer')
  })

  it('knows how a spell is settled', () => {
    expect(spellKind(fireBolt)).toBe('attack')
    expect(spellKind(fireball)).toBe('save')
    expect(spellKind(cureWounds)).toBe('heal')
    expect(spellKind({ ...base, damage: { type: 'force', slots: { 1: '3d4 + 3' } } })).toBe('damage')
    expect(spellKind(base)).toBe('other')
  })

  it('offers the slots that are free, at the spell level or higher', () => {
    const casting = { slotsMax: [4, 3, 2, 0, 0, 0, 0, 0, 0], slotsUsed: [4, 1, 0, 0, 0, 0, 0, 0, 0] }
    expect(slotChoices(casting, 1)).toEqual([2, 3])
    expect(slotChoices(casting, 3)).toEqual([3])
    expect(slotChoices({ ...casting, slotsUsed: [4, 3, 2, 0, 0, 0, 0, 0, 0] }, 1)).toEqual([])
    expect(slotChoices(casting, 0)).toEqual([0])
  })

  it('works out the save DC and attack bonus: 8 + proficiency + modifier, and proficiency + modifier', () => {
    expect(spellSaveDc(wizard)).toBe(14)
    expect(spellAttackBonus(wizard)).toBe(6)
  })

  it('throws more dice from a higher slot, and cantrips by character level', () => {
    expect(spellEffect(fireball, 3, 5, 3)).toEqual({ dice: [{ sides: 6, count: 8 }], modifier: 0, type: 'fire' })
    expect(spellEffect(fireball, 4, 5, 3)?.dice).toEqual([{ sides: 6, count: 9 }])
    expect(spellEffect(fireBolt, 0, 4, 3)?.dice).toEqual([{ sides: 10, count: 1 }])
    expect(spellEffect(fireBolt, 0, 5, 3)?.dice).toEqual([{ sides: 10, count: 2 }])
  })

  it('adds the spellcasting modifier where the healing says MOD', () => {
    expect(spellEffect(cureWounds, 2, 5, 3)).toEqual({ dice: [{ sides: 8, count: 2 }], modifier: 3, type: null })
  })

  it('reads range in feet', () => {
    expect(spellRange('150 feet')).toBe(150)
    expect(spellRange('Touch')).toBe(5)
    expect(spellRange('Self (15-foot cone)')).toBe(0)
    expect(spellRange('Sight')).toBeNull()
  })

  it('asks for a concentration save of 10, or half the damage', () => {
    expect(concentrationDc(7)).toBe(10)
    expect(concentrationDc(24)).toBe(12)
    expect(concentrationDc(25)).toBe(12)
  })

  it('tells lasting areas from instant ones', () => {
    expect(lastingArea(fireball)).toBe(false)
    expect(lastingArea({ ...base, duration: 'Up to 10 minutes', area: { type: 'sphere', size: 15 } })).toBe(true)
    expect(lastingArea({ ...base, duration: 'Up to 1 minute' })).toBe(false)
  })

  it('sums a spell up for its card', () => {
    expect(spellSummary(fireball, wizard)).toBe('8d6 fire · DC 14 DEX save')
    expect(spellSummary(fireBolt, wizard)).toBe('+6 to hit · 2d10 fire')
    expect(spellSummary(cureWounds, wizard)).toBe('1d8+3 healing')
  })
})
