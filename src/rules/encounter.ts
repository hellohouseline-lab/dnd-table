// How hard a fight is for this party (2014 rules): each character's XP thresholds for easy, medium,
// hard and deadly added up, against the monsters' XP times a multiplier for how many there are
// (more monsters act more often). A party of fewer than three uses the next multiplier up; of six
// or more, the next one down.

export type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'

/** XP thresholds by character level: easy, medium, hard, deadly. */
const THRESHOLDS: [number, number, number, number][] = [
  [25, 50, 75, 100],
  [50, 100, 150, 200],
  [75, 150, 225, 400],
  [125, 250, 375, 500],
  [250, 500, 750, 1100],
  [300, 600, 900, 1400],
  [350, 750, 1100, 1700],
  [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400],
  [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500],
  [1100, 2200, 3400, 5100],
  [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200],
  [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500],
  [2400, 4900, 7300, 10900],
  [2800, 5700, 8500, 12700],
]

const MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 4]

/** Which step of the multiplier table a number of monsters is on (1 is a single monster). */
function step(count: number): number {
  if (count <= 1) return 1
  if (count === 2) return 2
  if (count <= 6) return 3
  if (count <= 10) return 4
  if (count <= 14) return 5
  return 6
}

export type EncounterRating = {
  difficulty: Difficulty
  /** The monsters' XP times the multiplier. */
  adjustedXp: number
  /** The party's thresholds added up: easy, medium, hard, deadly. */
  thresholds: [number, number, number, number]
}

/** How hard a fight is: the party's levels against the monsters' XP (one entry per monster). */
export function encounterDifficulty(partyLevels: number[], monsterXps: number[]): EncounterRating {
  const thresholds = partyLevels.reduce<[number, number, number, number]>(
    (sum, level) => {
      const row = THRESHOLDS[Math.min(20, Math.max(1, Math.round(level))) - 1]
      return [sum[0] + row[0], sum[1] + row[1], sum[2] + row[2], sum[3] + row[3]]
    },
    [0, 0, 0, 0],
  )
  const counted = monsterXps.filter((xp) => xp > 0)
  const party = partyLevels.length
  const at = step(counted.length) + (party > 0 && party < 3 ? 1 : party >= 6 ? -1 : 0)
  const multiplier = MULTIPLIERS[Math.min(MULTIPLIERS.length - 1, Math.max(0, at))]
  const adjustedXp = Math.round(counted.reduce((a, b) => a + b, 0) * multiplier)
  const difficulty: Difficulty =
    adjustedXp >= thresholds[3]
      ? 'deadly'
      : adjustedXp >= thresholds[2]
        ? 'hard'
        : adjustedXp >= thresholds[1]
          ? 'medium'
          : adjustedXp >= thresholds[0]
            ? 'easy'
            : 'trivial'
  return { difficulty, adjustedXp, thresholds }
}

export const DIFFICULTY_WORDS: Record<Difficulty, string> = {
  trivial: 'barely a fight',
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  deadly: 'deadly',
}
