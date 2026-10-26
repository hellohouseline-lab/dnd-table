// Class features in play (2014 rules): what using one costs in a turn, and the ones the table runs
// itself (Rage, Second Wind, Action Surge). The rest are shown with their text and spend a use.

/** Something running on a character, such as Raging, and what it changes. */
export type Effect = {
  key: string
  name: string
  /** Damage types it gives resistance to (Rage: bludgeoning, piercing and slashing). */
  resistances?: string[]
  /** Ends when the character drops to 0 hit points. */
  endsWhenDown?: boolean
  /**
   * Rounds left in a fight; one goes at the start of each of the character's turns, and at 0 the
   * effect ends (the server counts them). A fight's end takes 10 more (a minute passes).
   */
  roundsLeft?: number
  /** A concentration timer's spell; it goes when the concentration does. */
  spell?: string
}

/** A duration in rounds of 6 seconds: "1 minute" or "Up to 1 minute" is 10; none for "Instantaneous". */
export function durationRounds(duration: string): number | null {
  const match = duration.toLowerCase().match(/(\d+)\s*(round|minute|hour|day)s?\b/)
  if (!match) return null
  const per = { round: 1, minute: 10, hour: 600, day: 14400 }[match[2] as 'round' | 'minute' | 'hour' | 'day']
  return Number(match[1]) * per
}

/** The timer for a concentration spell, if its duration is one the table counts. */
export function concentrationTimer(spell: string, duration: string): Effect | null {
  const rounds = durationRounds(duration)
  return rounds === null ? null : { key: 'concentration', name: `${spell} (concentration)`, spell, roundsLeft: rounds }
}

/** "7 rounds left", "about 10 minutes left". */
export function roundsLeftWords(rounds: number): string {
  if (rounds <= 1) return 'last round'
  if (rounds < 20) return `${rounds} rounds left`
  if (rounds < 1200) return `about ${Math.round(rounds / 10)} minutes left`
  return `about ${Math.round(rounds / 600)} hours left`
}

/** What using a feature takes from your turn; 'surge' is Action Surge, which gives the action back. */
export type FeatureCost = 'action' | 'bonus' | 'reaction' | 'free' | 'surge'

/** From the feature's name and text: "as a bonus action", "use your reaction", "as an action". */
export function featureCost(name: string, description: string): FeatureCost {
  if (/^action surge$/i.test(name.trim())) return 'surge'
  if (/\bbonus action\b/i.test(description)) return 'bonus'
  if (/\b(?:use|uses|using) your reaction\b|\bas a reaction\b/i.test(description)) return 'reaction'
  if (/\b(?:as an action|use (?:an|your) action|take (?:an|the) action)\b/i.test(description)) return 'action'
  return 'free'
}

export const COST_WORDS: Record<FeatureCost, string> = {
  action: 'Your action',
  bonus: 'Your bonus action',
  reaction: 'Your reaction',
  free: 'No action needed',
  surge: 'Gives you one more action',
}

/** The features the table runs itself, by name. */
export type FeatureRule = 'rage' | 'secondWind' | 'actionSurge' | null

export function featureRule(name: string): FeatureRule {
  const wanted = name.trim().toLowerCase()
  if (wanted === 'rage') return 'rage'
  if (wanted === 'second wind') return 'secondWind'
  if (wanted === 'action surge') return 'actionSurge'
  return null
}

export const RAGE: Effect = {
  key: 'rage',
  name: 'Raging',
  resistances: ['bludgeoning', 'piercing', 'slashing'],
  endsWhenDown: true,
  roundsLeft: 10,
}

export function isRaging(character: { effects?: Effect[] }): boolean {
  return (character.effects ?? []).some((e) => e.key === RAGE.key)
}

/** Rage's extra damage on Strength melee weapon attacks: +2, +3 from level 9, +4 from level 16. */
export function rageDamage(level: number): number {
  return level >= 16 ? 4 : level >= 9 ? 3 : 2
}

/** What a feature the table runs does, in plain words, for its card. */
export function featureSummary(rule: FeatureRule, level: number): string | null {
  if (rule === 'rage') {
    return `For 1 minute (10 rounds in a fight): advantage on Strength checks and saves, +${rageDamage(level)} damage on Strength melee attacks, resistance to bludgeoning, piercing and slashing damage. Ends early if you drop to 0 hit points.`
  }
  if (rule === 'secondWind') return `Regain 1d10 + ${level} hit points.`
  if (rule === 'actionSurge') return 'Take one more action this turn (not a second bonus action).'
  return null
}
