import { beforeAll, describe, expect, it } from 'vitest'
import { sampleFighter, sampleWizard } from '../../screens/dev/sampleData.ts'
import { loadClasses, loadFeatures, loadSpells, type SrdClass, type SrdFeature, type SrdSpell } from '../srd/index.ts'
import {
  applyLevelUp,
  hpGain,
  levelUpMissing,
  levelUpSpells,
  NO_PICKS,
  prepareChoices,
  swapChoices,
} from './applyLevelUp.ts'
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

  it('lets a bard swap a spell they know for another', () => {
    const spell = (index: string, prepared = true) => {
      const s = spells.find((x) => x.index === index)!
      return { id: index, index, name: s.name, level: s.level, prepared }
    }
    const bard = {
      ...sampleWizard,
      className: 'Bard',
      level: 2,
      subclass: '',
      spellcasting: {
        ...sampleWizard.spellcasting,
        ability: 'charisma' as const,
        spells: ['vicious-mockery', 'healing-word', 'sleep', 'charm-person', 'thunderwave', 'faerie-fire'].map((i) =>
          spell(i),
        ),
      },
    }
    const swap = swapChoices(classes.bard, bard, 3, spells, NO_PICKS)!
    expect(swap.out.map((s) => s.index)).toEqual([
      'healing-word',
      'sleep',
      'charm-person',
      'thunderwave',
      'faerie-fire',
    ])
    expect(swap.in.map((s) => s.index)).toContain('silence')
    expect(swapChoices(classes.fighter, sampleFighter, 3, spells, NO_PICKS)).toBeNull()

    const plan = levelPlan(classes.bard, 3, 'lore', have, features)
    const picks = { ...NO_PICKS, subclass: 'lore', spells: ['hold-person'], swapOut: 'sleep', swapIn: null }
    expect(levelUpMissing(plan, picks)).toContain('Pick the spell to learn in its place')
    const three = applyLevelUp(bard, classes.bard, plan, { ...picks, swapIn: 'silence' }, { features, spells })
    const names = three.spellcasting.spells.map((s) => s.index)
    expect(names).toContain('silence')
    expect(names).toContain('hold-person')
    expect(names).not.toContain('sleep')
  })

  it('lets a cleric or wizard prepare more when the number goes up', () => {
    const cleric = {
      ...sampleWizard,
      className: 'Cleric',
      subclass: 'Life',
      level: 3,
      scores: { ...sampleWizard.scores, wisdom: 16 },
      spellcasting: {
        ...sampleWizard.spellcasting,
        ability: 'wisdom' as const,
        spells: [
          { id: 'a', index: 'bless', name: 'Bless', level: 1, prepared: true },
          { id: 'b', index: 'cure-wounds', name: 'Cure Wounds', level: 1, prepared: true },
          { id: 'c', index: 'guiding-bolt', name: 'Guiding Bolt', level: 1, prepared: true },
          { id: 'd', index: 'aid', name: 'Aid', level: 2, prepared: true },
        ],
      },
    }
    // Level 4 with Wisdom 16: 4 + 3 = 7 prepared. Bless and Cure Wounds are the Life domain's own.
    const more = prepareChoices(classes.cleric, cleric, 4, spells, NO_PICKS)!
    expect(more.room).toBe(5)
    expect(more.options.map((s) => s.index)).toContain('hold-person')
    expect(more.options.map((s) => s.index)).not.toContain('spiritual-weapon')
    const plan = levelPlan(classes.cleric, 4, 'life', have, features)
    const picks = { ...NO_PICKS, increase: { wisdom: 2 }, prepare: ['shield-of-faith', 'hold-person'] }
    expect(prepareChoices(classes.cleric, cleric, 4, spells, picks)!.room).toBe(6)
    const four = applyLevelUp(cleric, classes.cleric, plan, picks, { features, spells })
    const list = four.spellcasting.spells
    expect(list.find((s) => s.index === 'hold-person')?.prepared).toBe(true)
    // The domain's level 3 spells arrive, always ready.
    expect(list.map((s) => s.index)).toEqual(expect.arrayContaining(['lesser-restoration', 'spiritual-weapon']))

    // Elowen, level 3, Intelligence 16: 4 + 3 = 7 at level 4, four prepared now.
    const book = prepareChoices(classes.wizard, sampleWizard, 4, spells, { ...NO_PICKS, spells: ['web'] })!
    expect(book.room).toBe(3)
    expect(book.options.map((s) => s.index)).toEqual(['sleep', 'web'])
    const wizard = applyLevelUp(
      sampleWizard,
      classes.wizard,
      levelPlan(classes.wizard, 4, null, have, features),
      {
        ...NO_PICKS,
        increase: { intelligence: 2 },
        cantrips: ['light'],
        spells: ['web', 'blur'],
        prepare: ['sleep', 'web'],
      },
      { features, spells },
    ).spellcasting.spells
    expect(wizard.find((s) => s.index === 'sleep')?.prepared).toBe(true)
    expect(wizard.find((s) => s.index === 'web')?.prepared).toBe(true)
    expect(wizard.find((s) => s.index === 'blur')?.prepared).toBe(false)
  })
})
