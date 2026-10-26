import { describe, expect, it } from 'vitest'
import { heightText, parseHeight, parseWeight, typicalWords, weightText } from './measures.ts'

describe('height and weight', () => {
  it('writes both systems', () => {
    expect(heightText(62)).toBe('5 ft 2 in (157 cm)')
    expect(heightText(60)).toBe('5 ft (152 cm)')
    expect(weightText(150)).toBe('150 lb (68 kg)')
  })

  it('reads what was written, either way', () => {
    expect(parseHeight('5 ft 2 in (157 cm)')).toBe(62)
    expect(parseHeight('5\'2"')).toBe(62)
    expect(Math.round(parseHeight('157 cm') ?? 0)).toBe(62)
    expect(Math.round(parseHeight('1.57 m') ?? 0)).toBe(62)
    expect(parseHeight('tall')).toBeNull()
    expect(parseWeight('150 lb (68 kg)')).toBe(150)
    expect(Math.round(parseWeight('68 kg') ?? 0)).toBe(150)
    expect(parseWeight('10 st 10 lb')).toBe(150)
  })

  it('gives a guide for each race', () => {
    expect(typicalWords('dwarf', 'Dwarf')?.height).toBe('Most dwarves are 4 ft to 5 ft (122 to 152 cm).')
    expect(typicalWords('halfling', 'Halfling')?.weight).toBe('Usually 35 to 45 lb (16 to 20 kg).')
    expect(typicalWords('other', 'Goliath')).toBeNull()
  })
})
