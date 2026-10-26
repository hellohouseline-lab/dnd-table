import { describe, expect, it } from 'vitest'
import { sampleFighter } from '../screens/dev/sampleData.ts'
import { anOrA, characterText, pictureDescription, sheetFileName } from './sheetText.ts'

const thorin = {
  ...sampleFighter,
  story: {
    ...sampleFighter.story,
    alignment: 'Lawful good',
    age: '87',
    height: '4 ft 5 in (135 cm)',
    weight: '180 lb (82 kg)',
    eyes: 'Grey',
    hair: 'Red, braided beard',
    personality: 'Gruff but loyal',
  },
}

describe('the sheet as text', () => {
  it('describes the character for a picture', () => {
    const picture = pictureDescription(thorin)
    expect(picture).toContain('A fantasy character portrait of Thorin Ironfist, an 87-year-old Hill Dwarf Fighter')
    expect(picture).toContain('4 ft 5 in tall, weighing 180 lb, grey eyes, red, braided beard hair.')
    expect(picture).toContain('Wearing chain mail and shield, carrying longsword, handaxe.')
    expect(picture).toContain('Lawful good in nature. Gruff but loyal.')
  })

  it('has every part of the sheet', () => {
    const text = characterText(thorin)
    expect(text.startsWith('THORIN IRONFIST\nLevel 2 Hill Dwarf Fighter')).toBe(true)
    expect(text).toMatch(/STR \d+ \([+-]\d\)/)
    expect(text).toContain('Armour class 18')
    expect(text).toContain('- Longsword: +5 to hit')
    expect(text).toContain('- 2 × Potion of Healing')
    expect(text).toContain('- Chain Mail (worn)')
    expect(text).toContain('Coins: 15 gp, 4 sp, 8 cp')
    expect(text).toContain('Height: 4 ft 5 in (135 cm)')
    expect(text).not.toMatch(/\n{3,}/)
  })

  it('says "an" where it sounds like one', () => {
    expect(
      ['87-year-old', '18-year-old', '11-year-old', 'Elf', 'Hill Dwarf', '25-year-old', '110-year-old'].map(anOrA),
    ).toEqual(['an', 'an', 'an', 'an', 'a', 'a', 'a'])
  })

  it('names the file after the character', () => {
    expect(sheetFileName(thorin)).toBe('thorin-ironfist.txt')
    expect(sheetFileName({ name: '' })).toBe('character.txt')
  })
})
