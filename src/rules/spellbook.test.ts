import { beforeAll, describe, expect, it } from 'vitest'
import { sampleWizard } from '../screens/dev/sampleData.ts'
import { loadClasses, loadSpells, type SrdClass, type SrdSpell } from './srd/index.ts'
import {
  castableFrom,
  changeSlots,
  newSpellEntry,
  preparesSpells,
  resetSlots,
  spellbookList,
  spellCountsFor,
} from './spellbook.ts'

let classes: Record<string, SrdClass>
let spells: SrdSpell[]

beforeAll(async () => {
  classes = Object.fromEntries((await loadClasses()).map((c) => [c.index, c]))
  spells = await loadSpells()
})

const spell = (index: string) => spells.find((s) => s.index === index)!

describe('the spellbook list', () => {
  it('shows every level, cantrips first, and narrows to a level or a class', () => {
    const all = spellbookList(spells, { level: 'all', classIndex: null, search: '' })
    expect(all).toHaveLength(spells.length)
    expect(all[0].level).toBe(0)
    expect(all.at(-1)?.level).toBe(9)
    const ninth = spellbookList(spells, { level: 9, classIndex: 'wizard', search: '' })
    expect(ninth.map((s) => s.name)).toContain('Wish')
    expect(ninth.every((s) => s.level === 9 && s.classes.includes('wizard'))).toBe(true)
    expect(spellbookList(spells, { level: 'all', classIndex: 'paladin', search: '' }).some((s) => s.level > 5)).toBe(
      false,
    )
  })

  it('finds words in the name first, then in what the spell does', () => {
    const fire = spellbookList(spells, { level: 'all', classIndex: 'wizard', search: 'fire' })
    const names = fire.map((s) => s.name)
    expect(names).toContain('Burning Hands')
    const firstDescribed = fire.findIndex((s) => !s.name.toLowerCase().includes('fire'))
    expect(firstDescribed).toBeGreaterThan(0)
    expect(fire.slice(0, firstDescribed).every((s) => s.name.toLowerCase().includes('fire'))).toBe(true)
    expect(spellbookList(spells, { level: 'all', classIndex: null, search: 'magic MISSILE' })[0].name).toBe(
      'Magic Missile',
    )
    expect(spellbookList(spells, { level: 'all', classIndex: null, search: 'zzzz' })).toEqual([])
  })
})

describe('when a class can first cast a spell', () => {
  it('follows the slots: full casters, half casters and warlocks', () => {
    expect(castableFrom(classes.wizard, 0)).toBe(1)
    expect(castableFrom(classes.wizard, 1)).toBe(1)
    expect(castableFrom(classes.wizard, 3)).toBe(5)
    expect(castableFrom(classes.wizard, 9)).toBe(17)
    expect(castableFrom(classes.paladin, 1)).toBe(2)
    expect(castableFrom(classes.paladin, 5)).toBe(17)
    expect(castableFrom(classes.paladin, 0)).toBeNull()
    expect(castableFrom(classes.warlock, 5)).toBe(9)
    expect(castableFrom(classes.warlock, 6)).toBe(11)
    expect(castableFrom(classes.warlock, 9)).toBe(17)
    expect(castableFrom(classes.fighter, 1)).toBeNull()
  })
})

describe('counting spells against the class', () => {
  it('counts cantrips and prepared spells for a wizard, red when over', () => {
    expect(spellCountsFor(sampleWizard, classes.wizard)).toEqual([
      { label: 'Cantrips', have: 1, of: 3, over: false },
      { label: 'Prepared', have: 4, of: 6, over: false },
    ])
    const crammed = {
      ...sampleWizard,
      spellcasting: {
        ...sampleWizard.spellcasting,
        spells: sampleWizard.spellcasting.spells
          .map((s) => ({ ...s, prepared: true }))
          .concat(['a', 'b', 'c'].map((id) => ({ id, index: null, name: id, level: 1, prepared: true }))),
      },
    }
    expect(spellCountsFor(crammed, classes.wizard)[1]).toEqual({ label: 'Prepared', have: 8, of: 6, over: true })
  })

  it('counts known spells for a bard, and nothing for a fighter', () => {
    const bard = { ...sampleWizard, className: 'Bard', scores: { ...sampleWizard.scores, charisma: 16 } }
    expect(spellCountsFor(bard, classes.bard).map((c) => c.label)).toEqual(['Cantrips', 'Known'])
    expect(spellCountsFor(bard, classes.bard)[1]).toMatchObject({ have: 5, of: 6 })
    expect(spellCountsFor(sampleWizard, classes.fighter)).toEqual([])
  })
})

describe('adding a spell from the book', () => {
  it('prepares it while there is room, for a class that prepares', () => {
    expect(newSpellEntry(spell('scorching-ray'), sampleWizard, classes.wizard, 'n1')).toEqual({
      id: 'n1',
      index: 'scorching-ray',
      name: 'Scorching Ray',
      level: 2,
      prepared: true,
    })
    const full = {
      ...sampleWizard,
      spellcasting: {
        ...sampleWizard.spellcasting,
        spells: sampleWizard.spellcasting.spells
          .map((s) => ({ ...s, prepared: true }))
          .concat([{ id: 'x', index: null, name: 'Extra', level: 1, prepared: true }]),
      },
    }
    expect(newSpellEntry(spell('scorching-ray'), full, classes.wizard, 'n2').prepared).toBe(false)
  })

  it('waits unprepared when it is above the character’s level, for planning ahead', () => {
    expect(newSpellEntry(spell('fireball'), sampleWizard, classes.wizard, 'n5').prepared).toBe(false)
    expect(newSpellEntry(spell('hold-monster'), sampleWizard, classes.bard, 'n6').prepared).toBe(false)
  })

  it('is always ready for a cantrip or a class that knows its spells', () => {
    expect(newSpellEntry(spell('light'), sampleWizard, classes.wizard, 'n3').prepared).toBe(true)
    expect(newSpellEntry(spell('charm-person'), sampleWizard, classes.bard, 'n4').prepared).toBe(true)
    expect(preparesSpells(classes.bard)).toBe(false)
    expect(preparesSpells(classes.cleric)).toBe(true)
  })
})

describe('changing spell slots', () => {
  it('adds and takes away a slot, never below what is used or outside 0 to 9', () => {
    const one = changeSlots(sampleWizard.spellcasting, 2, 1)
    expect(one.slotsMax).toEqual([4, 2, 1, 0, 0, 0, 0, 0, 0])
    const fewer = changeSlots({ ...sampleWizard.spellcasting, slotsUsed: [4, 0, 0, 0, 0, 0, 0, 0, 0] }, 0, -1)
    expect(fewer.slotsMax[0]).toBe(3)
    expect(fewer.slotsUsed[0]).toBe(3)
    expect(changeSlots(sampleWizard.spellcasting, 3, -1).slotsMax[3]).toBe(0)
    const nine = { ...sampleWizard.spellcasting, slotsMax: [9, 2, 0, 0, 0, 0, 0, 0, 0] }
    expect(changeSlots(nine, 0, 1).slotsMax[0]).toBe(9)
  })

  it('goes back to the class table', () => {
    const changed = {
      ...sampleWizard.spellcasting,
      slotsMax: [5, 3, 1, 0, 0, 0, 0, 0, 0],
      slotsUsed: [5, 3, 1, 0, 0, 0, 0, 0, 0],
    }
    const reset = resetSlots(changed, [4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(reset.slotsMax).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(reset.slotsUsed).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
  })
})
