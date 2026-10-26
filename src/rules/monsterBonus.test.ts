import { beforeAll, describe, expect, it } from 'vitest'
import { loadMonsters, type SrdMonster } from './srd/index.ts'
import { monsterBonusActions, monsterSkill } from './monsterBonus.ts'

let monsters: Record<string, SrdMonster>
beforeAll(async () => {
  monsters = Object.fromEntries((await loadMonsters()).map((m) => [m.index, m]))
})
const bonus = (index: string) => monsterBonusActions(monsters[index])

describe("a monster's bonus actions", () => {
  it('reads the moves it can take', () => {
    expect(bonus('goblin')).toEqual([
      expect.objectContaining({ name: 'Nimble Escape', moves: ['disengage', 'hide'], attack: null, when: 'any' }),
    ])
    expect(bonus('spy')[0]).toMatchObject({ name: 'Cunning Action', moves: ['dash', 'disengage', 'hide'] })
    expect(bonus('orc')[0]).toMatchObject({ name: 'Aggressive', moves: ['dash'] })
  })

  it('reads the attacks, and when they can be made', () => {
    expect(bonus('lion')[0]).toMatchObject({ name: 'Pounce', attack: 'Bite', when: 'afterHit' })
    expect(bonus('gnoll')[0]).toMatchObject({ name: 'Rampage', attack: 'Bite', when: 'afterDrop' })
  })

  it('leaves out monsters that only mention a bonus, and the bandit has none', () => {
    expect(bonus('bandit')).toEqual([])
    expect(bonus('adult-red-dragon')).toEqual([])
  })

  it("uses a monster's own skill bonus, or its ability modifier", () => {
    expect(monsterSkill(monsters.goblin, 'stealth', 'dexterity')).toBe(6)
    expect(monsterSkill(monsters.orc, 'stealth', 'dexterity')).toBe(1)
  })
})
