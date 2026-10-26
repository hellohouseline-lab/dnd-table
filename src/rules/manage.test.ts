import { beforeAll, describe, expect, it } from 'vitest'
import { sampleFighter, sampleWizard } from '../screens/dev/sampleData.ts'
import { toBuild } from './build/applyLevelUp.ts'
import {
  loadClasses,
  loadEquipment,
  loadFeatures,
  loadSpells,
  type SrdClass,
  type SrdEquipment,
  type SrdFeature,
  type SrdSpell,
} from './srd/index.ts'
import {
  addToInventory,
  applyChoice,
  armourTrained,
  armourWords,
  choiceGroups,
  copyCost,
  costWords,
  spellChoices,
  spellCounts,
  spellLimits,
  syncAttacks,
  toggleWorn,
  weaponWords,
} from './manage.ts'

let classes: Record<string, SrdClass>
let equipment: SrdEquipment
let spells: SrdSpell[]
let features: Record<string, SrdFeature>
beforeAll(async () => {
  classes = Object.fromEntries((await loadClasses()).map((c) => [c.index, c]))
  equipment = await loadEquipment()
  spells = await loadSpells()
  features = await loadFeatures()
})
const item = (index: string) => equipment.items.find((i) => i.index === index)!

describe('changing a character', () => {
  it('knows how many spells each class may have at its level', () => {
    expect(spellLimits(sampleWizard, classes.wizard)).toEqual({
      way: 'spellbook',
      cantrips: 3,
      known: null,
      prepared: 6,
      maxLevel: 2,
    })
    expect(spellLimits({ ...sampleWizard, level: 5 }, classes.bard)).toMatchObject({
      way: 'known',
      cantrips: 3,
      known: 8,
      maxLevel: 3,
    })
    expect(
      spellLimits({ ...sampleWizard, level: 3, scores: { ...sampleWizard.scores, wisdom: 16 } }, classes.cleric),
    ).toMatchObject({
      way: 'prepared',
      prepared: 6,
    })
    expect(spellLimits(sampleFighter, classes.fighter).way).toBe('none')
    expect(spellCounts(sampleWizard)).toEqual({ cantrips: 1, spells: 5, prepared: 4 })
    const choices = spellChoices(classes.wizard, spellLimits(sampleWizard, classes.wizard), spells)
    expect(choices.every((s) => s.level <= 2 && s.classes.includes('wizard'))).toBe(true)
    expect(choices.map((s) => s.name)).toContain('Misty Step')
    expect(copyCost(2)).toBe('100 gp and 4 hours')
  })

  it('describes weapons and armour plainly', () => {
    expect(weaponWords('longsword')).toBe('1d8 slashing · versatile (1d10)')
    expect(weaponWords('longbow')).toBe('1d8 piercing · needs ammunition · heavy · two-handed · range 150/600 ft')
    expect(armourWords(item('leather-armor'))).toBe('AC 11 + Dexterity')
    expect(armourWords(item('half-plate-armor'))).toBe('AC 15 + Dexterity (up to +2) · noisy (Stealth at disadvantage)')
    expect(armourWords(item('chain-mail'))).toBe('AC 16 · needs Strength 13 · noisy (Stealth at disadvantage)')
    expect(armourWords(item('shield'))).toBe('+2 AC, in one hand')
    expect([costWords(1500), costWords(50), costWords(2)]).toEqual(['15 gp', '5 sp', '2 cp'])
  })

  it('keeps the hand of cards in step with the weapons carried', () => {
    const typed = {
      id: 't',
      name: 'Bite',
      weapon: null,
      proficient: true,
      magicBonus: 0,
      ability: 'strength' as const,
      damageDice: '1d4',
      damageType: 'piercing',
    }
    const inventory = [
      { id: '1', item: 'longsword', name: 'Longsword', quantity: 1, weight: 3, worn: false, uses: null },
      { id: '2', item: 'shortbow', name: 'Shortbow', quantity: 1, weight: 2, worn: false, uses: null },
    ]
    const attacks = syncAttacks(
      [...sampleFighter.attacks, typed],
      inventory,
      equipment,
      'Simple Weapons, Martial Weapons',
    )
    expect(attacks.map((a) => a.name)).toEqual(['Longsword', 'Bite', 'Shortbow'])
    expect(attacks.find((a) => a.weapon === 'shortbow')?.proficient).toBe(true)
    const wizard = syncAttacks([], [inventory[0]], equipment, 'Daggers, Darts, Slings, Quarterstaffs, Crossbows, light')
    expect(wizard[0]).toMatchObject({ name: 'Longsword', proficient: false })
  })

  it('adds gear, opens packs and wears one suit of armour at a time', () => {
    const one = addToInventory(
      [],
      { index: 'rope-hempen-50-feet', name: 'Rope, hempen (50 feet)', weight: 10 },
      equipment,
    )
    expect(one).toMatchObject([{ item: 'rope-hempen-50-feet', name: 'Rope, hempen (50 feet)', quantity: 1 }])
    expect(addToInventory(one, { index: 'rope-hempen-50-feet', name: '', weight: 10 }, equipment)[0].quantity).toBe(2)
    const pack = addToInventory([], { index: 'explorers-pack', name: "Explorer's Pack", weight: 59 }, equipment)
    expect(pack.map((i) => i.item)).toContain('bedroll')
    expect(pack.some((i) => i.item === 'explorers-pack')).toBe(false)

    let worn = addToInventory([], { index: 'leather-armor', name: 'Leather Armor', weight: 10 }, equipment)
    worn = addToInventory(worn, { index: 'chain-mail', name: 'Chain Mail', weight: 55 }, equipment)
    worn = addToInventory(worn, { index: 'shield', name: 'Shield', weight: 6 }, equipment)
    worn = toggleWorn(worn, worn[0].id, equipment)
    worn = toggleWorn(worn, worn[2].id, equipment)
    worn = toggleWorn(worn, worn[1].id, equipment)
    expect(worn.map((i) => i.worn)).toEqual([false, true, true])

    expect(armourTrained(item('chain-mail'), 'All armor, Shields')).toBe(true)
    expect(armourTrained(item('chain-mail'), 'Light armor, Medium armor, Shields')).toBe(false)
    expect(armourTrained(item('scale-mail'), 'Light armor, Medium armor')).toBe(true)
    expect(armourTrained(item('shield'), 'Light armor')).toBe(false)
  })

  it('finds the choices a class has made and lets them change', () => {
    const fighter = toBuild({
      ...sampleFighter,
      features: [
        ...sampleFighter.features,
        { id: 'fs', name: 'Fighting Style: Defense', description: '', usesMax: null, usesLeft: 0, recharge: null },
      ],
    })
    const [style] = choiceGroups(classes.fighter, fighter, features)
    expect(style).toMatchObject({
      name: 'Fighting Style',
      kind: 'feature',
      choose: 1,
      picked: ['fighter-fighting-style-defense'],
    })
    const changed = applyChoice(fighter, style, ['fighter-fighting-style-archery'])
    expect(changed.features.map((f) => f.name)).toContain('Fighting Style: Archery')
    expect(changed.features.map((f) => f.name)).not.toContain('Fighting Style: Defense')

    const rogue = toBuild({
      ...sampleFighter,
      className: 'Rogue',
      level: 6,
      skillExpertise: ['stealth'],
      otherProficiencies: 'Light armor, Thieves’ tools (expertise)',
      features: [],
    })
    const expertise = choiceGroups(classes.rogue, rogue, features).find((g) => g.kind === 'skill')!
    expect(expertise.choose).toBe(4)
    expect(expertise.picked.sort()).toEqual(['stealth', 'thieves-tools'])
    const swapped = applyChoice(rogue, expertise, ['stealth', 'perception'])
    expect(swapped.skillExpertise).toEqual(['stealth', 'perception'])
    expect(swapped.otherProficiencies).toBe('Light armor')
  })
})
