import { describe, expect, it } from 'vitest'
import { encounterDifficulty } from './encounter.ts'

describe('how hard a fight is', () => {
  it('adds up the party thresholds and multiplies the monsters by how many there are', () => {
    // Four level 1 characters: 100 / 200 / 300 / 400.
    const four = [1, 1, 1, 1]
    expect(encounterDifficulty(four, [50]).difficulty).toBe('trivial')
    expect(encounterDifficulty(four, [50, 50]).adjustedXp).toBe(150)
    // Three goblins: 150 XP × 2 = 300, hard.
    expect(encounterDifficulty(four, [50, 50, 50])).toMatchObject({
      adjustedXp: 300,
      difficulty: 'hard',
      thresholds: [100, 200, 300, 400],
    })
    // A bugbear (200) and four goblins (200): 400 × 2 = 800, deadly.
    expect(encounterDifficulty(four, [200, 50, 50, 50, 50]).difficulty).toBe('deadly')
  })

  it('shifts the multiplier for a small or large party', () => {
    // Two level 3 characters (150 / 300 / 450 / 800): one ogre (450) counts × 1.5.
    expect(encounterDifficulty([3, 3], [450])).toMatchObject({ adjustedXp: 675, difficulty: 'hard' })
    // Six level 1 characters: three goblins count × 1.5.
    expect(encounterDifficulty([1, 1, 1, 1, 1, 1], [50, 50, 50]).adjustedXp).toBe(225)
  })
})
