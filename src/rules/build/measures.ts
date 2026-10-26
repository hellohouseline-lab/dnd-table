// Height and weight for a character, picked in feet and pounds or centimetres and kilograms, and
// always written with both ("5 ft 2 in (157 cm)", "150 lb (68 kg)") so everyone at the table can read it.

export const CM_PER_INCH = 2.54
export const KG_PER_POUND = 0.45359237

/** "5 ft 2 in (157 cm)" from inches. */
export function heightText(inches: number): string {
  const feet = Math.floor(inches / 12)
  const rest = Math.round(inches - feet * 12)
  return `${feet} ft${rest ? ` ${rest} in` : ''} (${Math.round(inches * CM_PER_INCH)} cm)`
}

/** "150 lb (68 kg)" from pounds. */
export function weightText(pounds: number): string {
  return `${Math.round(pounds)} lb (${Math.round(pounds * KG_PER_POUND)} kg)`
}

/** Inches from "5 ft 2 in", "5'2", "157 cm" or "1.57 m"; null if it can't be read. */
export function parseHeight(text: string): number | null {
  const t = text.toLowerCase()
  const cm = t.match(/(\d+(?:\.\d+)?)\s*cm\b/)
  const metres = t.match(/(\d+(?:\.\d+)?)\s*m\b/)
  const feet = t.match(/(\d+)\s*(?:ft|feet|foot|')/)
  const inches = t.match(/(\d+)\s*(?:in|inches|inch|")/)
  if (feet) return Number(feet[1]) * 12 + (inches ? Number(inches[1]) : 0)
  if (cm) return Number(cm[1]) / CM_PER_INCH
  if (metres) return (Number(metres[1]) * 100) / CM_PER_INCH
  return null
}

/** Pounds from "150 lb", "68 kg" or "10 st 10 lb"; null if it can't be read. */
export function parseWeight(text: string): number | null {
  const t = text.toLowerCase()
  const stone = t.match(/(\d+(?:\.\d+)?)\s*(?:st|stone)\b/)
  const pounds = t.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/)
  const kg = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b/)
  if (stone) return Number(stone[1]) * 14 + (pounds ? Number(pounds[1]) : 0)
  if (pounds) return Number(pounds[1])
  if (kg) return Number(kg[1]) / KG_PER_POUND
  return null
}

/**
 * What's usual for each race, in inches and pounds: a guide, not a rule. Small races are about
 * three feet; dragonborn are big.
 */
export const TYPICAL_SIZE: Record<string, { height: [number, number]; weight: [number, number] }> = {
  dwarf: { height: [48, 60], weight: [130, 200] },
  elf: { height: [56, 74], weight: [90, 170] },
  halfling: { height: [32, 40], weight: [35, 45] },
  human: { height: [58, 76], weight: [110, 250] },
  dragonborn: { height: [68, 80], weight: [180, 320] },
  gnome: { height: [36, 44], weight: [35, 45] },
  'half-elf': { height: [58, 74], weight: [110, 220] },
  'half-orc': { height: [60, 78], weight: [140, 300] },
  tiefling: { height: [58, 74], weight: [110, 220] },
}

/** "Most dwarves are 4 ft to 5 ft (122 to 152 cm)." */
export function typicalWords(race: string | null, name: string): { height: string; weight: string } | null {
  const size = race ? TYPICAL_SIZE[race] : undefined
  if (!size) return null
  const ft = (i: number) => `${Math.floor(i / 12)} ft${i % 12 ? ` ${i % 12} in` : ''}`
  const plural = name.toLowerCase().endsWith('f') ? `${name.toLowerCase().slice(0, -1)}ves` : `${name.toLowerCase()}s`
  return {
    height: `Most ${plural} are ${ft(size.height[0])} to ${ft(size.height[1])} (${Math.round(size.height[0] * CM_PER_INCH)} to ${Math.round(size.height[1] * CM_PER_INCH)} cm).`,
    weight: `Usually ${size.weight[0]} to ${size.weight[1]} lb (${Math.round(size.weight[0] * KG_PER_POUND)} to ${Math.round(size.weight[1] * KG_PER_POUND)} kg).`,
  }
}
