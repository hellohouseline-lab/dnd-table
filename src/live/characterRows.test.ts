import { describe, expect, it } from 'vitest'
import { newBuild } from '../rules/character.ts'
import {
  applyCharacterChange,
  buildToRow,
  parseFeatures,
  parseSpellcasting,
  rowToCharacter,
  trackersToRow,
  type CharacterRow,
} from './characterRows.ts'

const row: CharacterRow = {
  id: 'c1',
  campaign_id: 'camp',
  owner_id: 'p1',
  name: 'Dwarf Fighter',
  race: 'Dwarf',
  subrace: 'Hill Dwarf',
  class: 'Fighter',
  subclass: '',
  background: 'Acolyte',
  level: 2,
  strength: 16,
  dexterity: 12,
  constitution: 15,
  intelligence: 10,
  wisdom: 12,
  charisma: 8,
  max_hp: 20,
  current_hp: 17,
  temp_hp: 0,
  armour_class: 18,
  speed: 25,
  hit_die: 10,
  hit_dice_used: 0,
  save_proficiencies: ['strength', 'constitution'],
  skill_proficiencies: ['athletics'],
  skill_expertise: [],
  other_proficiencies: '',
  languages: 'Common, Dwarvish',
  attacks: [{ id: 'a1', name: 'Longsword', weapon: 'longsword', proficient: true, magicBonus: 0 }],
  features: [{ id: 'f1', name: 'Second Wind', description: '', usesMax: 1, usesLeft: 1, recharge: 'short' }],
  spellcasting: {},
  death_save_successes: 0,
  death_save_failures: 0,
  conditions: [],
  exhaustion: 0,
  inspiration: false,
  concentration: null,
  portrait_path: null,
  created_at: '2026-10-25T20:00:00Z',
  updated_at: '2026-10-25T20:00:00Z',
}

describe('rowToCharacter', () => {
  it('reads a row into the app’s shape', () => {
    const character = rowToCharacter(row)
    expect(character).toMatchObject({ className: 'Fighter', scores: { strength: 16 }, currentHp: 17, armourClass: 18 })
    expect(character.attacks[0]).toMatchObject({ weapon: 'longsword', ability: 'strength', damageDice: '' })
    expect(character.features[0]).toMatchObject({ usesMax: 1, usesLeft: 1, recharge: 'short' })
  })

  it('round-trips through the form columns', () => {
    const character = rowToCharacter(row)
    expect(buildToRow(character)).toMatchObject({ class: 'Fighter', strength: 16, max_hp: 20, speed: 25 })
  })
})

describe('reading the JSON columns safely', () => {
  it('turns junk into empty lists', () => {
    expect(parseFeatures(null)).toEqual([])
    expect(parseFeatures({ not: 'a list' })).toEqual([])
  })

  it('keeps feature uses within their maximum', () => {
    const [feature] = parseFeatures([{ name: 'Rage', usesMax: 2, usesLeft: 5 }])
    expect(feature.usesLeft).toBe(2)
  })

  it('treats a missing or zero maximum as unlimited', () => {
    expect(parseFeatures([{ name: 'Darkvision', usesMax: 0 }])[0].usesMax).toBeNull()
  })

  it('fills spell slots to nine levels and never uses more than there are', () => {
    const spellcasting = parseSpellcasting({ ability: 'intelligence', slotsMax: [4, 2], slotsUsed: [5, 1] })
    expect(spellcasting.slotsMax).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(spellcasting.slotsUsed).toEqual([4, 1, 0, 0, 0, 0, 0, 0, 0])
  })

  it('ignores an ability that isn’t one', () => {
    expect(parseSpellcasting({ ability: 'luck' }).ability).toBeNull()
  })
})

describe('buildToRow', () => {
  it('drops expertise in skills the character isn’t proficient in', () => {
    const build = { ...newBuild(), name: ' Sam ', skillProficiencies: ['stealth'], skillExpertise: ['stealth', 'arcana'] }
    expect(buildToRow(build)).toMatchObject({ name: 'Sam', skill_expertise: ['stealth'] })
  })
})

describe('trackersToRow', () => {
  it('only sends what changed', () => {
    expect(trackersToRow({ currentHp: 12, inspiration: true })).toEqual({ current_hp: 12, inspiration: true })
  })
})

describe('applyCharacterChange', () => {
  const list = [rowToCharacter(row)]

  it('updates a character that changed elsewhere', () => {
    expect(applyCharacterChange(list, { type: 'upsert', row: { ...row, current_hp: 9 } })[0].currentHp).toBe(9)
  })

  it('adds a new character and removes a deleted one', () => {
    expect(applyCharacterChange(list, { type: 'upsert', row: { ...row, id: 'c2' } })).toHaveLength(2)
    expect(applyCharacterChange(list, { type: 'delete', id: 'c1' })).toHaveLength(0)
  })
})
