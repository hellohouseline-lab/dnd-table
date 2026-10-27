import { describe, expect, it } from 'vitest'
import { canHear, deafHint, isOut, moraleHints, talkSkill } from './talk.ts'

const monster = (stance: 'fighting' | 'surrendered' | 'running' | 'fled', health = 'healthy') =>
  ({ kind: 'monster', health, stance }) as const

describe('who is in the fight', () => {
  it('passes over monsters that are down, surrendered or fled', () => {
    expect(isOut(monster('fighting'))).toBe(false)
    expect(isOut(monster('running'))).toBe(false)
    expect(isOut(monster('surrendered'))).toBe(true)
    expect(isOut(monster('fled'))).toBe(true)
    expect(isOut(monster('fighting', 'down'))).toBe(true)
    expect(isOut({ kind: 'character', health: 'down', stance: 'fighting' })).toBe(false)
  })

  it('talks only to monsters still there', () => {
    expect(canHear(monster('fighting'))).toBe(true)
    expect(canHear(monster('running'))).toBe(true)
    expect(canHear(monster('surrendered'))).toBe(false)
    expect(canHear(monster('fighting', 'down'))).toBe(false)
    expect(canHear({ kind: 'character', health: 'healthy', stance: 'fighting' })).toBe(false)
  })
})

describe('talk skills', () => {
  it('knows Persuade, Intimidate and Deceive', () => {
    expect(talkSkill('intimidation')?.verb).toBe('Intimidate')
    expect(talkSkill('athletics')).toBeUndefined()
  })
})

describe('creatures that cannot be talked round', () => {
  const scores = { strength: 13, dexterity: 6, constitution: 16, intelligence: 3, wisdom: 6, charisma: 5 }
  it('flags mindless undead and simple beasts', () => {
    expect(deafHint({ name: 'Zombie', type: 'undead', scores })).toBe("Zombie doesn't listen (Intelligence 3)")
    expect(deafHint({ name: 'Wolf', type: 'beast', scores })).toMatch(/can't follow words .* a scare might work/)
  })
  it('lets the rest be talked to', () => {
    expect(deafHint({ name: 'Goblin', type: 'humanoid', scores: { ...scores, intelligence: 10 } })).toBeNull()
    expect(deafHint({ name: 'Skeleton', type: 'undead', scores: { ...scores, intelligence: 6 } })).toBeNull()
  })
})

describe('the morale nudge', () => {
  const row = (id: string, cr: number | null, health = 'healthy', stance = 'fighting' as const) => ({
    id,
    name: id,
    health,
    stance,
    cr,
    listens: true,
  })

  it('says nothing while everyone is fine', () => {
    expect(moraleHints([row('Goblin A', 0.25), row('Goblin B', 0.25), row('Boss', 1)])).toEqual([])
  })

  it('names a monster nearly dead', () => {
    expect(moraleHints([row('Goblin A', 0.25, 'near-death'), row('Goblin B', 0.25)])).toEqual([
      { ids: ['Goblin A'], text: 'Goblin A is nearly dead: it might run or beg' },
    ])
  })

  it('names the rest when the leader falls', () => {
    expect(moraleHints([row('Goblin A', 0.25), row('Goblin B', 0.25, 'near-death'), row('Boss', 1, 'down')])).toEqual([
      { ids: ['Goblin A', 'Goblin B'], text: 'Boss is out of the fight: Goblin A and Goblin B might run or beg' },
    ])
  })

  it('has no leader when the top challenge is shared', () => {
    expect(moraleHints([row('Goblin A', 0.25, 'down'), row('Goblin B', 0.25)])).toEqual([])
  })

  it('leaves out those that never break, and those already out', () => {
    const zombie = { ...row('Zombie', 0.25, 'near-death'), listens: false }
    const gone = row('Goblin C', 0.25, 'near-death', 'fighting')
    expect(moraleHints([zombie, { ...gone, stance: 'surrendered' as never }])).toEqual([])
  })
})
