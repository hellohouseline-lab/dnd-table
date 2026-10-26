/** "a" or "an" before a word, for button titles like "Roll an Athletics check". */
export function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`
}
