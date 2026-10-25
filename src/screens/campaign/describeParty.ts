const NUMBER_WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

/** The line under the campaign name: "A party of four · Run by Matt · Level 1". */
export function describeParty(partySize: number, dmName: string, startingLevel: number): string {
  const size = NUMBER_WORDS[partySize] ?? String(partySize)
  return `A party of ${size} · Run by ${dmName} · Level ${startingLevel}`
}

const JUST_JOINED_MS = 10 * 60 * 1000

/** "Welcome" for someone who joined in the last ten minutes, "Welcome back" after that. */
export function welcomeWord(joinedAt: string, now: Date = new Date()): string {
  return now.getTime() - new Date(joinedAt).getTime() < JUST_JOINED_MS ? 'Welcome' : 'Welcome back'
}

/** Plain words for how many players have joined, e.g. "2 of 4 players have joined". */
export function seatsFilled(players: number, partySize: number): string {
  const noun = partySize === 1 ? 'player' : 'players'
  const verb = players === 1 ? 'has' : 'have'
  return `${players} of ${partySize} ${noun} ${verb} joined`
}
