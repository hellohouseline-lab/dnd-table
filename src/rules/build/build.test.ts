import { beforeAll, describe, expect, it } from 'vitest'
import {
  loadClasses,
  loadEquipment,
  loadFeatures,
  loadMonsters,
  type SrdClass,
  type SrdEquipment,
  type SrdFeature,
  type SrdMonster,
} from '../srd/index.ts'
import { armourClass, carryingCapacity, firstLevelHp, levelHp } from './body.ts'
import { attacksFrom, coinText, pickComplete, startingGear, totalWeight, weaponProficient, wornFrom } from './gear.ts'
import { levelPlan, pathAhead, preparedCount, subclassLevel } from './levelUp.ts'
import {
  applyIncrease,
  fourDropLowest,
  pointBuyCost,
  pointBuyRoom,
  STANDARD_ARRAY,
  suggestScores,
  withBonuses,
  type Scores,
} from './scores.ts'
import { nextWildShape, wildShapeBeasts, wildShapeLimits } from './wildShape.ts'

const flat = (n: number): Scores => ({
  strength: n,
  dexterity: n,
  constitution: n,
  intelligence: n,
  wisdom: n,
  charisma: n,
})

let classes: Record<string, SrdClass>
let features: Record<string, SrdFeature>
let equipment: SrdEquipment
let monsters: SrdMonster[]
beforeAll(async () => {
  classes = Object.fromEntries((await loadClasses()).map((c) => [c.index, c]))
  features = await loadFeatures()
  equipment = await loadEquipment()
  monsters = await loadMonsters()
})
const none = { features: [], spells: [] }

describe('ability scores', () => {
  it('prices point buy at 27 points', () => {
    expect(pointBuyCost(flat(8))).toBe(0)
    expect(pointBuyCost({ ...flat(8), strength: 15, dexterity: 15, constitution: 15 })).toBe(27)
    expect(pointBuyCost({ ...flat(8), strength: 16 })).toBeNull()
    const room = pointBuyRoom({ ...flat(8), strength: 15, dexterity: 15, constitution: 14 }, 'wisdom')
    expect(room).toEqual({ left: 2, up: true, down: false })
    expect(pointBuyRoom({ ...flat(8), strength: 15, dexterity: 15, constitution: 15 }, 'wisdom').up).toBe(false)
  })

  it('rolls 4d6 and drops the lowest', () => {
    expect(fourDropLowest([1, 6, 3, 5])).toBe(14)
    expect(fourDropLowest([6, 6, 6, 6])).toBe(18)
  })

  it('suggests where scores go for a class, Constitution next', () => {
    const wizard = suggestScores(STANDARD_ARRAY, 'wizard')
    expect([wizard.intelligence, wizard.constitution, wizard.dexterity]).toEqual([15, 14, 13])
    const monk = suggestScores(STANDARD_ARRAY, 'monk')
    expect([monk.dexterity, monk.wisdom, monk.constitution]).toEqual([15, 14, 13])
  })

  it('adds racial bonuses and ability score increases, never past 20', () => {
    expect(withBonuses({ ...flat(10), strength: 19 }, { strength: 2 }, { constitution: 1 })).toMatchObject({
      strength: 20,
      constitution: 11,
    })
    expect(applyIncrease(flat(10), { strength: 2 })?.strength).toBe(12)
    expect(applyIncrease(flat(10), { strength: 1, wisdom: 1 })).toMatchObject({ strength: 11, wisdom: 11 })
    expect(applyIncrease(flat(10), { strength: 3 })).toBeNull()
    expect(applyIncrease(flat(10), { strength: 1 })).toBeNull()
    expect(applyIncrease({ ...flat(10), strength: 19 }, { strength: 2 })).toBeNull()
  })
})

describe('armour class and hit points', () => {
  it('works out AC from armour, shields and unarmoured defence', () => {
    const scores = { ...flat(10), dexterity: 16, constitution: 14, wisdom: 14, strength: 12 }
    const item = (index: string) => equipment.items.find((i) => i.index === index) ?? null
    expect(armourClass(scores, { armour: null, shield: false }).ac).toBe(13)
    expect(armourClass(scores, { armour: null, shield: false }, 'barbarian').ac).toBe(15)
    expect(armourClass(scores, { armour: null, shield: false }, 'monk').ac).toBe(15)
    expect(armourClass(scores, { armour: null, shield: true }, 'monk').ac).toBe(15)
    expect(armourClass(scores, { armour: item('studded-leather-armor'), shield: false }).ac).toBe(15)
    expect(armourClass(scores, { armour: item('half-plate-armor'), shield: true }).ac).toBe(19)
    const chain = armourClass(scores, { armour: item('chain-mail'), shield: true })
    expect(chain).toMatchObject({ ac: 18, slowed: true, stealthDisadvantage: true, how: 'Chain Mail 16, shield +2' })
  })

  it('counts hit points by level', () => {
    expect(firstLevelHp(10, 14)).toBe(12)
    expect(firstLevelHp(6, 1)).toBe(1)
    expect(levelHp(10, 14)).toBe(8)
    expect(levelHp(8, 10, 3, 1)).toBe(4)
    expect(levelHp(6, 3, 1)).toBe(1)
    expect(carryingCapacity(15)).toBe(225)
  })
})

describe('starting gear', () => {
  it("makes a fighter's choices into an inventory, opening packs", () => {
    const fighter = classes.fighter
    const picks = [
      { option: 0, picks: [] },
      { option: 0, picks: [['longsword']] },
      { option: 1, picks: [] },
      { option: 0, picks: [] },
    ]
    expect(pickComplete(fighter.startingChoices[1], picks[1])).toBe(true)
    expect(pickComplete(fighter.startingChoices[1], { option: 1, picks: [['longsword']] })).toBe(false)
    const owned = startingGear(fighter.startingGear, fighter.startingChoices, picks, equipment)
    const items = owned.map((o) => o.item)
    expect(items).toEqual(expect.arrayContaining(['chain-mail', 'longsword', 'shield', 'handaxe']))
    expect(owned.find((o) => o.item === 'handaxe')?.quantity).toBe(2)
    expect(items).not.toContain(fighter.startingChoices[3].options[0].find((p) => 'item' in p && /pack/.test(p.item)))
    expect(totalWeight(owned, equipment)).toBeGreaterThan(55)
    expect(wornFrom(owned, equipment)).toMatchObject({ armour: { index: 'chain-mail' }, shield: true })
    const attacks = attacksFrom(owned, equipment, fighter.proficiencies)
    expect(attacks.map((a) => a.name)).toEqual(['Longsword', 'Handaxe'])
    expect(attacks.every((a) => a.proficient)).toBe(true)
  })

  it('knows which weapons a class can use well', () => {
    const item = (index: string) => equipment.items.find((i) => i.index === index)!
    expect(weaponProficient(item('dagger'), classes.wizard.proficiencies)).toBe(true)
    expect(weaponProficient(item('crossbow-light'), classes.wizard.proficiencies)).toBe(true)
    expect(weaponProficient(item('longsword'), classes.wizard.proficiencies)).toBe(false)
    expect(weaponProficient(item('rapier'), classes.rogue.proficiencies)).toBe(true)
    expect(weaponProficient(item('greataxe'), classes.rogue.proficiencies)).toBe(false)
  })

  it('writes coins plainly', () => {
    expect([coinText(1500), coinText(250), coinText(8), coinText(0)]).toEqual(['15 gp', '2 gp 5 sp', '8 cp', '0 gp'])
  })
})

describe('levelling up', () => {
  it('knows when each class picks its subclass', () => {
    expect(['cleric', 'wizard', 'fighter'].map((c) => subclassLevel(classes[c]))).toEqual([1, 2, 3])
  })

  it("plans a fighter's level 3 and 4", () => {
    const three = levelPlan(classes.fighter, 3, null, none, features)
    expect(three.chooseSubclass).toBe(true)
    const champion = levelPlan(classes.fighter, 3, 'champion', none, features)
    expect(champion.chooseSubclass).toBe(false)
    expect(champion.features.map((f) => f.name)).toContain('Improved Critical')
    const four = levelPlan(classes.fighter, 4, 'champion', none, features)
    expect(four.abilityIncrease).toBe(true)
    const five = levelPlan(classes.fighter, 5, 'champion', none, features)
    expect(five.profUp).toBe(true)
    expect(five.features.map((f) => f.name)).toContain('Extra Attack')
    expect(five.numbers).toContainEqual({ key: 'extra_attacks', label: 'Extra attacks', before: '0', after: '1' })
  })

  it('asks for a fighting style, and for expertise', () => {
    const one = levelPlan(classes.fighter, 1, null, none, features)
    expect(one.choices[0]).toMatchObject({ feature: 'fighter-fighting-style', choose: 1 })
    expect(one.choices[0].options.map((o) => o.name)).toContain('Archery')
    const rogue = levelPlan(classes.rogue, 1, null, none, features)
    expect(rogue.choices.find((c) => c.kind === 'skill')).toMatchObject({ choose: 2 })
  })

  it('offers invocations with their prerequisites', () => {
    const two = levelPlan(classes.warlock, 2, 'fiend', none, features)
    const invocations = two.choices.find((c) => c.feature === 'eldritch-invocations')
    expect(invocations?.choose).toBe(2)
    const agonizing = invocations?.options.find((o) => o.index === 'eldritch-invocation-agonizing-blast')
    expect(agonizing).toMatchObject({ allowed: false, why: 'needs the Eldritch Blast cantrip' })
    const withBlast = levelPlan(classes.warlock, 2, 'fiend', { features: [], spells: ['eldritch-blast'] }, features)
    expect(withBlast.choices[0].options.find((o) => o.index === 'eldritch-invocation-agonizing-blast')?.allowed).toBe(
      true,
    )
    const thirsting = withBlast.choices[0].options.find((o) => o.index === 'eldritch-invocation-thirsting-blade')
    expect(thirsting?.why).toBe('from level 5')
  })

  it('counts new spells and spell levels', () => {
    const wizard = levelPlan(classes.wizard, 3, 'evocation', none, features)
    expect(wizard).toMatchObject({ spells: 2, newSpellLevel: 2 })
    const bard = levelPlan(classes.bard, 4, 'lore', none, features)
    expect(bard).toMatchObject({ cantrips: 1, spells: 1 })
    expect(preparedCount('cleric', 3, { wisdom: 16 })).toBe(6)
    expect(preparedCount('paladin', 5, { charisma: 14 })).toBe(4)
    expect(preparedCount('sorcerer', 5, {})).toBeNull()
  })

  it('shows the whole path ahead', () => {
    const path = pathAhead(classes.barbarian, 1, null, none, features)
    expect(path).toHaveLength(19)
    expect(path.find((p) => p.level === 3)?.chooseSubclass).toBe(true)
    expect(path.find((p) => p.level === 3)?.numbers).toContainEqual({
      key: 'rage_count',
      label: 'Rages',
      before: '2',
      after: '3',
    })
  })
})

describe('Wild Shape', () => {
  it('limits the beasts by level', () => {
    expect(wildShapeLimits(classes.druid, 1)).toBeNull()
    const two = wildShapeLimits(classes.druid, 2)!
    expect(two).toEqual({ maxCr: 0.25, swim: false, fly: false })
    const beasts = wildShapeBeasts(monsters, two)
    expect(beasts.map((b) => b.name)).toEqual(expect.arrayContaining(['Wolf', 'Cat']))
    expect(beasts.every((b) => b.type === 'beast' && b.cr <= 0.25 && !/fly|swim/.test(b.speedText))).toBe(true)
    expect(nextWildShape(classes.druid, 2)).toEqual({ level: 4, limits: { maxCr: 0.5, swim: true, fly: false } })
    expect(wildShapeBeasts(monsters, { maxCr: 1, swim: true, fly: true }).map((b) => b.name)).toContain('Giant Eagle')
  })
})
