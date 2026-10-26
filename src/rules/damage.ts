// Damage types and what stops them (2014 rules): resistance halves the damage, rounded down;
// vulnerability doubles it; immunity stops it; resistance and vulnerability together cancel out.
// The server applies it when an attack lands (private.damage_adjustment); this is the same rule
// for the screens and the previews, and for turning the SRD's words into entries.

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const

export type DamageType = (typeof DAMAGE_TYPES)[number]

/** A creature's defences. Each entry is a type ('cold') or one only non-magical attacks meet ('slashing:nonmagical'). */
export type Defences = { resistances: string[]; vulnerabilities: string[]; immunities: string[] }

export type Adjustment = 'resisted' | 'vulnerable' | 'immune' | null

export const NO_DEFENCES: Defences = { resistances: [], vulnerabilities: [], immunities: [] }

function covers(entry: string, type: string, magical: boolean): boolean {
  const [what, only] = entry.split(':')
  return what === type && (only === undefined || (only === 'nonmagical' && !magical))
}

export function damageAdjustment(type: string, magical: boolean, defences: Defences): Adjustment {
  const kind = type.trim().toLowerCase()
  if (defences.immunities.some((e) => covers(e, kind, magical))) return 'immune'
  const resists = defences.resistances.some((e) => covers(e, kind, magical))
  const vulnerable = defences.vulnerabilities.some((e) => e.split(':')[0] === kind)
  if (resists && vulnerable) return null
  if (resists) return 'resisted'
  if (vulnerable) return 'vulnerable'
  return null
}

/** The damage after the target's defences, and what happened to it. */
export function adjustDamage(
  amount: number,
  type: string,
  magical: boolean,
  defences: Defences,
): { amount: number; adjust: Adjustment } {
  const adjust = amount > 0 && type ? damageAdjustment(type, magical, defences) : null
  const adjusted =
    adjust === 'immune'
      ? 0
      : adjust === 'resisted'
        ? Math.floor(amount / 2)
        : adjust === 'vulnerable'
          ? amount * 2
          : amount
  return { amount: adjusted, adjust }
}

/**
 * Turns the SRD's words for a defence into entries: "cold" gives ['cold'], and "bludgeoning,
 * piercing, and slashing from nonmagical weapons" (with or without "that aren't silvered") gives
 * ['bludgeoning:nonmagical', 'piercing:nonmagical', 'slashing:nonmagical']. Anything else is left out.
 */
export function parseDefence(text: string): string[] {
  const lower = text.toLowerCase()
  const nonmagical = /from nonmagical/.test(lower)
  const listed = lower.split(/\bfrom\b/)[0]
  const types = DAMAGE_TYPES.filter((type) => new RegExp(`\\b${type}\\b`).test(listed))
  if (types.length === 0 || (!nonmagical && /\bfrom\b/.test(lower))) return []
  return types.map((type) => (nonmagical ? `${type}:nonmagical` : type))
}

/** "Resists cold; immune to poison" for the DM's Acting now card and the sheet. */
export function defencesText(defences: Defences): string {
  const words = (entries: string[]) =>
    entries.map((e) => (e.endsWith(':nonmagical') ? `${e.split(':')[0]} (non-magical)` : e)).join(', ')
  return [
    defences.resistances.length > 0 && `Resists ${words(defences.resistances)}`,
    defences.vulnerabilities.length > 0 && `vulnerable to ${words(defences.vulnerabilities)}`,
    defences.immunities.length > 0 && `immune to ${words(defences.immunities)}`,
  ]
    .filter(Boolean)
    .join('; ')
    .replace(/^./, (c) => c.toUpperCase())
}
