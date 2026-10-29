import { beforeAll, describe, expect, it } from 'vitest'
import { loadMonsters, type SrdMonster } from './srd/index.ts'
import {
  abilityReach,
  legendaryCost,
  monsterCards,
  multiattackText,
  plainName,
  rechargeOf,
  sameAsBefore,
  saveAbility,
} from './monsterTurn.ts'

let monsters: Record<string, SrdMonster>

beforeAll(async () => {
  monsters = Object.fromEntries((await loadMonsters()).map((m) => [m.index, m]))
})

describe('a monster as a hand of cards', () => {
  it('turns a goblin into its attacks and its Nimble Escape is left to the turn panel', () => {
    const cards = monsterCards(monsters.goblin)
    expect(cards.map((c) => `${c.kind}:${c.name}:${c.cost}`)).toEqual([
      'attack:Scimitar:action',
      'attack:Shortbow:action',
    ])
  })

  it('gives a dragon its attacks, its breath and Frightful Presence, legendary actions and no Multiattack card', () => {
    const cards = monsterCards(monsters['adult-black-dragon'])
    const names = cards.map((c) => `${c.kind}:${c.name}:${c.cost}`)
    expect(names).toContain('attack:Bite:action')
    expect(names).toContain('save:Acid Breath:action')
    expect(names).toContain('save:Frightful Presence:action')
    expect(names).toContain('other:Detect:legendary')
    expect(names).toContain('attack:Tail Attack:legendary')
    expect(names).toContain('save:Wing Attack:legendary')
    expect(names.some((n) => n.includes('Multiattack'))).toBe(false)
    expect(multiattackText(monsters['adult-black-dragon'])).toMatch(/Frightful Presence/)
  })
})

describe('an ability with a save', () => {
  it('reads the DC, the save, half damage and the dice', () => {
    const breath = monsters['adult-black-dragon'].actions.find((a) => a.name.startsWith('Acid Breath'))!
    expect(saveAbility(breath)).toMatchObject({
      name: 'Acid Breath',
      save: 'dexterity',
      dc: 18,
      dcSuccess: 'half',
      damage: { dice: [{ sides: 8, count: 12 }], modifier: 0 },
      damageType: 'acid',
      reach: { kind: 'area', shape: 'line', sizeFt: 60, fromSelf: true },
    })
  })

  it('has no damage and no half for Frightful Presence, which picks by choice', () => {
    const fear = monsters['adult-black-dragon'].actions.find((a) => a.name === 'Frightful Presence')!
    expect(saveAbility(fear)).toMatchObject({
      dcSuccess: 'none',
      damage: null,
      reach: { kind: 'around', feet: 120, choice: true },
    })
  })

  it('finds where it lands', () => {
    expect(abilityReach('exhales poisonous gas in a 15-foot cone')).toEqual({
      kind: 'area',
      shape: 'cone',
      sizeFt: 15,
      fromSelf: true,
    })
    expect(abilityReach('Each creature within 10 ft. of the dragon must succeed')).toEqual({
      kind: 'around',
      feet: 10,
      choice: false,
    })
    expect(abilityReach('One creature the hag can see must make a DC 12 Wisdom save')).toEqual({ kind: 'pick' })
    expect(saveAbility({ name: 'Bite', desc: '', damage: [] })).toBeNull()
  })

  it('reads names, recharges and legendary costs', () => {
    expect(plainName('Wing Attack (Costs 2 Actions)')).toBe('Wing Attack')
    expect(rechargeOf('Fire Breath (Recharge 5-6)')).toBe('Recharge 5–6')
    expect(rechargeOf('Bite')).toBeNull()
    expect(legendaryCost('Wing Attack (Costs 2 Actions)')).toBe(2)
    expect(legendaryCost('Detect')).toBe(1)
  })
})

describe('same for the rest', () => {
  const last = { actorId: 'g1', monster: 'goblin', label: 'Scimitar', targetId: 'elowen' }
  const up = () => true

  it('repeats the last goblin attack for the next goblin, before it acts', () => {
    expect(sameAsBefore(last, { id: 'g2', monster: 'goblin', acted: false }, up)).toBe(last)
  })

  it('not for the same goblin, another kind, one that has acted, or a target that is down', () => {
    expect(sameAsBefore(last, { id: 'g1', monster: 'goblin', acted: false }, up)).toBeNull()
    expect(sameAsBefore(last, { id: 'w1', monster: 'wolf', acted: false }, up)).toBeNull()
    expect(sameAsBefore(last, { id: 'g2', monster: 'goblin', acted: true }, up)).toBeNull()
    expect(sameAsBefore(last, { id: 'g2', monster: 'goblin', acted: false }, () => false)).toBeNull()
    expect(sameAsBefore(null, { id: 'g2', monster: 'goblin', acted: false }, up)).toBeNull()
  })
})

describe('what failing a monster ability save puts on', () => {
  it('frightened from Frightful Presence, with its save each turn, and prone from a Wing Attack', async () => {
    const { monsterAbilityCause } = await import('./conditionClocks.ts')
    const dragon = monsters['adult-black-dragon']
    expect(monsterAbilityCause(dragon, 'Frightful Presence')).toMatchObject({
      conditions: ['frightened'],
      rounds: 10,
      saveEachTurn: 'wisdom',
      resist: null,
      dc: 16,
    })
    expect(monsterAbilityCause(dragon, 'Wing Attack')).toMatchObject({ conditions: ['prone'], resist: null })
    expect(monsterAbilityCause(dragon, 'Acid Breath')).toBeNull()
  })
})
