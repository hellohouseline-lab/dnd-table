import { describe, expect, it } from 'vitest'
import type { AbilityScores } from '../abilities.ts'
import {
  customAttack,
  damageText,
  spellAttackBonus,
  spellSaveDc,
  weaponAbility,
  weaponAttack,
  type WeaponStats,
} from './attacks.ts'
import { initiativeBonus, passiveScore, saveBonus, skillBonus } from './checks.ts'
import { abilityModifier, formatBonus, proficiencyBonus } from './core.ts'
import { gainTempHp, heal, suggestedMaxHp, takeDamage } from './hitPoints.ts'
import { spellLevelName } from '../spellLevels.ts'

describe('spellLevelName', () => {
  it('names cantrips and each spell level', () => {
    expect([0, 1, 2, 3, 4, 9].map(spellLevelName)).toEqual([
      'Cantrips',
      '1st level',
      '2nd level',
      '3rd level',
      '4th level',
      '9th level',
    ])
  })
})

const scores: AbilityScores = {
  strength: 16,
  dexterity: 12,
  constitution: 15,
  intelligence: 10,
  wisdom: 12,
  charisma: 8,
}

const longsword: WeaponStats = {
  name: 'Longsword',
  range: 'Melee',
  damageDice: '1d8',
  damageType: 'Slashing',
  properties: ['versatile'],
  versatileDice: '1d10',
}
const rapier: WeaponStats = {
  name: 'Rapier',
  range: 'Melee',
  damageDice: '1d8',
  damageType: 'Piercing',
  properties: ['finesse'],
}
const longbow: WeaponStats = {
  name: 'Longbow',
  range: 'Ranged',
  damageDice: '1d8',
  damageType: 'Piercing',
  properties: ['ammunition', 'heavy', 'two-handed'],
}
const handaxe: WeaponStats = {
  name: 'Handaxe',
  range: 'Melee',
  damageDice: '1d6',
  damageType: 'Slashing',
  properties: ['light', 'thrown'],
}

describe('abilityModifier', () => {
  it.each([
    [1, -5],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [16, 3],
    [20, 5],
    [30, 10],
  ])('score %i gives %i', (score, modifier) => {
    expect(abilityModifier(score)).toBe(modifier)
  })
})

describe('proficiencyBonus', () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [13, 5],
    [17, 6],
    [20, 6],
  ])('level %i gives +%i', (level, bonus) => {
    expect(proficiencyBonus(level)).toBe(bonus)
  })

  it('treats levels outside 1 to 20 as the nearest level', () => {
    expect(proficiencyBonus(0)).toBe(2)
    expect(proficiencyBonus(25)).toBe(6)
  })
})

describe('formatBonus', () => {
  it('shows a plus for zero and up, and a true minus sign below zero', () => {
    expect(formatBonus(3)).toBe('+3')
    expect(formatBonus(0)).toBe('+0')
    expect(formatBonus(-1)).toBe('−1')
  })
})

describe('saves and skills', () => {
  it('adds proficiency to a proficient save', () => {
    expect(saveBonus(16, true, 2)).toBe(5)
    expect(saveBonus(16, false, 2)).toBe(3)
  })

  it('adds proficiency once, or twice with expertise', () => {
    expect(skillBonus(12, 'none', 5)).toBe(1)
    expect(skillBonus(12, 'proficient', 5)).toBe(4)
    expect(skillBonus(12, 'expertise', 5)).toBe(7)
  })

  it('works out passive scores and initiative', () => {
    expect(passiveScore(skillBonus(12, 'none', 2))).toBe(11)
    expect(initiativeBonus(12)).toBe(1)
  })
})

describe('weapon attacks', () => {
  it('uses Strength for melee weapons', () => {
    expect(weaponAttack(longsword, scores, 2, true)).toEqual({
      ability: 'strength',
      toHit: 5,
      damage: '1d8+3',
      versatileDamage: '1d10+3',
      damageType: 'Slashing',
    })
  })

  it('moves with Strength, as the milestone 2 check describes', () => {
    expect(weaponAttack(longsword, { ...scores, strength: 18 }, 2, true).toHit).toBe(6)
    expect(weaponAttack(longsword, { ...scores, strength: 18 }, 2, true).damage).toBe('1d8+4')
  })

  it('uses Dexterity for ranged weapons', () => {
    expect(weaponAttack(longbow, scores, 2, true)).toMatchObject({ ability: 'dexterity', toHit: 3, damage: '1d8+1' })
  })

  it('uses the better of Strength and Dexterity for finesse weapons', () => {
    expect(weaponAbility(rapier, scores)).toBe('strength')
    expect(weaponAbility(rapier, { ...scores, dexterity: 18 })).toBe('dexterity')
  })

  it('keeps Strength for a thrown melee weapon', () => {
    expect(weaponAbility(handaxe, { ...scores, dexterity: 18 })).toBe('strength')
  })

  it('leaves out proficiency when not proficient, and adds a magic bonus to both rolls', () => {
    expect(weaponAttack(longsword, scores, 2, false).toHit).toBe(3)
    expect(weaponAttack(longsword, scores, 2, true, 1)).toMatchObject({ toHit: 6, damage: '1d8+4' })
  })

  it('shows a negative damage bonus with a minus sign', () => {
    expect(weaponAttack(longsword, { ...scores, strength: 8 }, 1, true).damage).toBe('1d8−1')
  })

  it('handles a typed-in attack such as an unarmed strike: 1 + Strength modifier', () => {
    const unarmed = { ability: 'strength' as const, damageDice: '', damageType: 'Bludgeoning' }
    expect(customAttack(unarmed, scores, 2, true)).toMatchObject({ toHit: 5, damage: '4' })
    expect(customAttack(unarmed, { ...scores, strength: 6 }, 2, true).damage).toBe('0')
  })

  it('writes damage without a bonus when it is zero', () => {
    expect(damageText('2d6', 0)).toBe('2d6')
  })
})

describe('spellcasting', () => {
  it('works out the save DC and attack bonus', () => {
    expect(spellSaveDc(16, 3)).toBe(13)
    expect(spellAttackBonus(16, 3)).toBe(5)
  })
})

describe('hit points', () => {
  const hp = { current: 17, max: 20, temp: 5 }

  it('takes damage from temporary hit points first', () => {
    expect(takeDamage(hp, 3)).toEqual({ current: 17, max: 20, temp: 2 })
    expect(takeDamage(hp, 8)).toEqual({ current: 14, max: 20, temp: 0 })
  })

  it('never drops below 0', () => {
    expect(takeDamage(hp, 99).current).toBe(0)
  })

  it('heals up to the maximum and leaves temporary hit points alone', () => {
    expect(heal(hp, 10)).toEqual({ current: 20, max: 20, temp: 5 })
  })

  it('keeps the higher temporary hit points rather than adding them', () => {
    expect(gainTempHp(hp, 3).temp).toBe(5)
    expect(gainTempHp(hp, 8).temp).toBe(8)
  })

  it('suggests the usual maximum: full die at level 1, then the average', () => {
    expect(suggestedMaxHp(10, 15, 1)).toBe(12)
    expect(suggestedMaxHp(10, 15, 2)).toBe(20)
    expect(suggestedMaxHp(6, 14, 3)).toBe(20)
  })

  it('adds at least 1 per level, even with a low Constitution', () => {
    // Constitution 3 is −4: level 1 gives 6 − 4 = 2, and level 2 adds the minimum of 1.
    expect(suggestedMaxHp(6, 3, 2)).toBe(3)
  })
})
