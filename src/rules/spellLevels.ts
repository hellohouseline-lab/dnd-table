/** "Cantrips", "1st level", "2nd level", "3rd level", "4th level" and so on up to 9th. */
export function spellLevelName(level: number): string {
  if (level === 0) return 'Cantrips'
  const suffix = level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'
  return `${level}${suffix} level`
}
