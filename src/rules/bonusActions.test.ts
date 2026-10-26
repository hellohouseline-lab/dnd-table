import { describe, expect, it } from 'vitest'
import { sampleFighter, sampleWizard } from '../screens/dev/sampleData.ts'
import {
  BONUS_CATALOGUE,
  bonusEntries,
  coveredFeatures,
  martialArtsDie,
  triggeredBonus,
  unarmedStrike,
} from './bonusActions.ts'
import type { Character } from './character.ts'
import { RAGE } from './features.ts'

const keys = (c: Parameters<typeof bonusEntries>[0]) => bonusEntries(c).map((e) => e.key)
const as = (base: Character, patch: Partial<Character>): Character => ({ ...base, ...patch })
const turn = { myTurn: true, bonusUsed: false, attacksMade: 0 }

describe('bonus actions', () => {
  it('knows each class and subclass, from the right level', () => {
    expect(keys(as(sampleFighter, { className: 'Fighter', level: 1, attacks: [] }))).toEqual(['second-wind'])
    expect(keys(as(sampleFighter, { className: 'Rogue', subclass: '', level: 1, attacks: [] }))).toEqual([])
    expect(keys(as(sampleFighter, { className: 'Rogue', subclass: '', level: 2, attacks: [] }))).toEqual([
      'cunning-action',
    ])
    expect(keys(as(sampleFighter, { className: 'Rogue', subclass: 'Thief', level: 3, attacks: [] }))).toEqual([
      'cunning-action',
      'fast-hands',
    ])
    expect(keys(as(sampleFighter, { className: 'Monk', level: 2, attacks: [] }))).toEqual([
      'martial-arts',
      'flurry',
      'patient-defense',
      'step-of-the-wind',
    ])
    expect(
      keys(as(sampleFighter, { className: 'Barbarian', subclass: 'Path of the Berserker', level: 3, attacks: [] })),
    ).toEqual(['rage', 'frenzy'])
    expect(keys(as(sampleWizard, { className: 'Wizard', attacks: [] }))).toEqual([])
  })

  it('needs Quickened Spell on the sheet, as Metamagic is a choice', () => {
    const sorcerer = as(sampleWizard, { className: 'Sorcerer', level: 3, attacks: [], features: [] })
    expect(keys(sorcerer)).toEqual(['font-of-magic'])
    const quick = { id: 'q', name: 'Quickened Spell', description: '', usesMax: null, usesLeft: 0, recharge: null }
    expect(keys({ ...sorcerer, features: [quick] })).toEqual(['font-of-magic', 'quickened-spell'])
  })

  it('offers an off-hand attack only with two light melee weapons, after attacking', () => {
    const twoBlades = as(sampleFighter, {
      className: 'Fighter',
      attacks: [
        { ...sampleFighter.attacks[0], id: 'a', weapon: 'shortsword' },
        { ...sampleFighter.attacks[0], id: 'b', weapon: 'dagger' },
      ],
    })
    expect(keys(twoBlades)).toContain('offhand')
    expect(triggeredBonus(twoBlades, turn).map((e) => e.key)).toEqual([])
    expect(triggeredBonus(twoBlades, { ...turn, attacksMade: 1 }).map((e) => e.key)).toEqual(['offhand'])
    expect(triggeredBonus(twoBlades, { ...turn, attacksMade: 1, bonusUsed: true })).toEqual([])
    expect(triggeredBonus(twoBlades, { ...turn, attacksMade: 1, myTurn: false })).toEqual([])
  })

  it("readies a monk's strikes after an attack, and a berserker's frenzy the turn after raging", () => {
    const monk = as(sampleFighter, { className: 'Monk', level: 2, attacks: [] })
    expect(triggeredBonus(monk, { ...turn, attacksMade: 1 }).map((e) => e.key)).toEqual(['martial-arts', 'flurry'])
    const berserker = as(sampleFighter, { className: 'Barbarian', subclass: 'Berserker', level: 3, attacks: [] })
    expect(triggeredBonus(berserker, turn)).toEqual([])
    expect(triggeredBonus({ ...berserker, effects: [RAGE] }, turn)).toEqual([])
    expect(triggeredBonus({ ...berserker, effects: [{ ...RAGE, roundsLeft: 9 }] }, turn).map((e) => e.key)).toEqual([
      'frenzy',
    ])
  })

  it('stands in for the sheet features it covers', () => {
    const rogue = as(sampleFighter, { className: 'Rogue', level: 2, attacks: [] })
    expect(coveredFeatures(rogue).has('cunning action')).toBe(true)
  })

  it("works out a monk's unarmed strike", () => {
    expect([1, 5, 11, 17].map(martialArtsDie)).toEqual(['1d4', '1d6', '1d8', '1d10'])
    const strike = unarmedStrike({ level: 5, scores: { ...sampleFighter.scores, dexterity: 16, strength: 10 } })
    expect(strike).toMatchObject({
      ability: 'dexterity',
      damageDice: '1d6',
      damageType: 'bludgeoning',
      proficient: true,
    })
  })

  it('has no repeated keys', () => {
    expect(new Set(BONUS_CATALOGUE.map((e) => e.key)).size).toBe(BONUS_CATALOGUE.length)
  })
})
