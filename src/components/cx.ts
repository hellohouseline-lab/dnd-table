/** Joins class names, skipping empty ones: cx('a', false && 'b', 'c') gives 'a c'. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ')
}
