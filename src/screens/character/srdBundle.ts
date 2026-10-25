import type { SrdBackground, SrdClass, SrdRaces } from '../../rules/srd/index.ts'

/** The SRD lists the character form uses. Each is null until it has loaded. */
export type SrdBundle = {
  classes: SrdClass[] | null
  races: SrdRaces | null
  backgrounds: SrdBackground[] | null
}
