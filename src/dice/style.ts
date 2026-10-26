// How someone's dice look: a material, a colour and a number colour, each picked from a short
// named list so the dice can be described in words ("Ruby glass, gold numbers"). Saved on the
// person's place at the table and copied onto every roll, so every screen draws the same dice.

export type DiceMaterial = 'plastic' | 'glass' | 'metal' | 'stone'

export type DiceStyle = { material: DiceMaterial; colour: string; numbers: string }

export type Swatch = { key: string; name: string; hex: string }

export const DICE_MATERIALS: { key: DiceMaterial; name: string; note: string }[] = [
  { key: 'plastic', name: 'Plastic', note: 'Smooth and solid' },
  { key: 'glass', name: 'Glass', note: 'See-through and shiny' },
  { key: 'metal', name: 'Metal', note: 'Brushed and gleaming' },
  { key: 'stone', name: 'Stone', note: 'Speckled and matt' },
]

export const DICE_COLOURS: Swatch[] = [
  { key: 'obsidian', name: 'Obsidian', hex: '#1b1622' },
  { key: 'bone', name: 'Bone', hex: '#e6dac0' },
  { key: 'ruby', name: 'Ruby', hex: '#a3192d' },
  { key: 'sapphire', name: 'Sapphire', hex: '#1f4fa3' },
  { key: 'emerald', name: 'Emerald', hex: '#17804f' },
  { key: 'amethyst', name: 'Amethyst', hex: '#6a2f9a' },
  { key: 'amber', name: 'Amber', hex: '#d08a12' },
  { key: 'gold', name: 'Gold', hex: '#d4af5a' },
  { key: 'silver', name: 'Silver', hex: '#b9bec7' },
  { key: 'slate', name: 'Slate', hex: '#4f5a66' },
]

export const NUMBER_COLOURS: Swatch[] = [
  { key: 'gold', name: 'gold', hex: '#f0d58a' },
  { key: 'white', name: 'white', hex: '#ffffff' },
  { key: 'silver', name: 'silver', hex: '#d9dde3' },
  { key: 'black', name: 'black', hex: '#141018' },
  { key: 'crimson', name: 'crimson', hex: '#c0262f' },
]

export const DEFAULT_DICE_STYLE: DiceStyle = { material: 'plastic', colour: 'obsidian', numbers: 'gold' }

function swatch(list: Swatch[], key: string): Swatch {
  return list.find((s) => s.key === key) ?? list[0]
}

export function diceColour(style: DiceStyle): Swatch {
  return swatch(DICE_COLOURS, style.colour)
}

export function numberColour(style: DiceStyle): Swatch {
  return swatch(NUMBER_COLOURS, style.numbers)
}

/** Reads a saved style, filling in anything missing or unknown with the default. */
export function parseDiceStyle(value: unknown): DiceStyle {
  const saved = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const material = DICE_MATERIALS.find((m) => m.key === saved.material)?.key ?? DEFAULT_DICE_STYLE.material
  const colour = DICE_COLOURS.find((c) => c.key === saved.colour)?.key ?? DEFAULT_DICE_STYLE.colour
  const numbers = NUMBER_COLOURS.find((n) => n.key === saved.numbers)?.key ?? DEFAULT_DICE_STYLE.numbers
  return { material, colour, numbers }
}

/** "Obsidian, gold numbers" for plastic; "Ruby glass, white numbers" for anything else. */
export function describeDiceStyle(style: DiceStyle): string {
  const material = style.material === 'plastic' ? '' : ` ${style.material}`
  return `${diceColour(style).name}${material}, ${numberColour(style).name} numbers`
}

export function sameDiceStyle(a: DiceStyle, b: DiceStyle): boolean {
  return a.material === b.material && a.colour === b.colour && a.numbers === b.numbers
}
