import { beforeAll, describe, expect, it } from 'vitest'
import { sampleFighter, sampleWizard } from '../../screens/dev/sampleData.ts'
import { loadClasses, loadFeatures, loadSpells, type SrdClass, type SrdFeature, type SrdSpell } from '../srd/index.ts'
import { applyLevelUp, hpGain, levelUpMissing, levelUpSpells, NO_PICKS } from './applyLevelUp.ts'
import { levelPlan } from './levelUp.ts'

let classes: Record<string, SrdClass>
let features: Record<string, SrdFeature>
let spells: SrdSpell[]
beforeAll(async () => {
  classes = Object.fromEntries((await loadClasses()).map((c) => [c.index, c]))
  features = await loadFeatures()
  spells = await loadSpells()
})
const have = { features: [], spells: [] }

describe('taking a level', () => {
  it('takes a fighter from 2 to 3 with a path, and 3 to 4 with an ability increase', () => {
    const fighter = { ...sampleFighter, level: 2, maxHp: 20 }
    const plan3 = levelPlan(classes.fighter, 3, null, have, features)
    expect(levelUpMissing(plan3, NO_PICKS)).toEqual(['Pick your path'])
    const picks = { ...NO_PICKS, subclass: 'champion' }
    const three = applyLevelUp(
      fighter,
      classes.fighter,
      levelPlan(classes.fighter, 3, 'champion', have, features),
      picks,
      { features, spells },
    )
    expect(three).toMatchObject({ level: 3, subclass: 'Champion' })
    // Average of a d10 (6) plus Constitution 15 (+2).
    expect(three.maxHp).toBe(28)
    expect(three.features.map((f) => f.name)).toContain('Improved Critical')

    const plan4 = levelPlan(classes.fighter, 4, 'champion', have, features)
    expect(levelUpMissing(plan4, NO_PICKS)).toEqual(['Spend your 2 ability points'])
    const four = applyLevelUp(
      { ...fighter, ...three, level: 3, subclass: 'Champion', maxHp: 28 },
      classes.fighter,
      plan4,
      { ...NO_PICKS, increase: { constitution: 2 } },
      { features, spells },
    )
    // +1 Constitution modifier counts for all four levels: 6 + 3 + 3 earlier levels.
    expect(four.scores.constitution).toBe(17)
    expect(four.maxHp).toBe(28 + 9 + 3)
  })

  it('rolls hit points when asked', () => {
    expect(hpGain({ ...sampleFighter, level: 2 }, classes.fighter, { ...NO_PICKS, rolled: 1 })).toBe(3)
  })

  it('gives a wizard new slots and two spellbook spells', () => {
    const wizard = { ...sampleWizard, level: 3 }
    const plan = levelPlan(classes.wizard, 4, 'evocation', have, features)
    expect(plan).toMatchObject({ spells: 2, cantrips: 1, abilityIncrease: true })
    const options = levelUpSpells(classes.wizard, wizard, 4, spells)
    expect(options.spells.map((s) => s.index)).not.toContain('magic-missile')
    const after = applyLevelUp(
      wizard,
      classes.wizard,
      plan,
      { ...NO_PICKS, increase: { intelligence: 2 }, cantrips: ['light'], spells: ['web', 'misty-step'] },
      { features, spells },
    )
    expect(after.spellcasting.slotsMax.slice(0, 2)).toEqual([4, 3])
    expect(after.spellcasting.spells.find((s) => s.index === 'web')).toMatchObject({ level: 2, prepared: false })
    expect(after.scores.intelligence).toBe(18)
  })
})
