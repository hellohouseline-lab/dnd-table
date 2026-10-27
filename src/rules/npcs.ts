// Make someone up (decision 60): a name, a look, a quirk and a voice in one click, for when the
// players talk to someone the DM didn't plan. Our own tables, written for this table.

export type Attitude = 'friendly' | 'warm' | 'neutral' | 'wary' | 'hostile'

export const ATTITUDES: { key: Attitude; name: string; line: string }[] = [
  { key: 'friendly', name: 'Friendly', line: 'Glad to help, maybe too glad' },
  { key: 'warm', name: 'Warm', line: 'Likes them well enough' },
  { key: 'neutral', name: 'Neutral', line: 'Polite, nothing more' },
  { key: 'wary', name: 'Wary', line: 'Doesn’t trust them yet' },
  { key: 'hostile', name: 'Hostile', line: 'Wants them gone, or worse' },
]

const FIRST = [
  'Aldric',
  'Bree',
  'Cormac',
  'Della',
  'Edda',
  'Fenwick',
  'Garrow',
  'Hester',
  'Ilsa',
  'Jory',
  'Kestrel',
  'Lark',
  'Maddox',
  'Nell',
  'Osric',
  'Pell',
  'Quill',
  'Rosamund',
  'Sable',
  'Tamsin',
  'Ulric',
  'Vesna',
  'Wynn',
  'Yara',
  'Brom',
  'Dagny',
  'Thrain',
  'Hilde',
  'Pip',
  'Merry',
  'Tobin',
  'Nim',
  'Elowen',
  'Faelar',
  'Ithil',
  'Saria',
]
const FAMILY = [
  'Ashdown',
  'Blackwood',
  'Copperkettle',
  'Dunmore',
  'Elmsworth',
  'Fairweather',
  'Greaves',
  'Hollins',
  'Ironside',
  'Kettleby',
  'Larkspur',
  'Mossbank',
  'Nettle',
  'Oakhart',
  'Pennywhistle',
  'Quarry',
  'Redfern',
  'Stonebrook',
  'Thistledown',
  'Underhill',
  'Varrow',
  'Whitlock',
  'Yarrow',
  'Brightwater',
]
const ROLES = [
  'farmer',
  'stable hand',
  'barmaid',
  'blacksmith’s apprentice',
  'travelling tinker',
  'priest of a small shrine',
  'town guard',
  'fishwife',
  'retired soldier',
  'herbalist',
  'pickpocket',
  'merchant’s clerk',
  'gravedigger',
  'shepherd',
  'minstrel',
  'tax collector',
  'miller',
  'ferryman',
  'scribe',
  'beggar',
]
const LOOKS = [
  'a scar across one eyebrow',
  'flour on their sleeves',
  'a bright green scarf',
  'missing two front teeth',
  'ink-stained fingers',
  'a tall, crooked hat',
  'a limp they try to hide',
  'very neat, very clean boots',
  'freckles everywhere',
  'a hood they never lower',
  'rings on every finger',
  'a fresh black eye',
  'a dog that follows them everywhere',
  'a laugh like a goose',
  'one blue eye and one brown',
]
const QUIRKS = [
  'counts things under their breath',
  'never finishes a sentence',
  'calls everyone “friend”',
  'eats constantly',
  'is terrified of cats',
  'quotes a holy book, slightly wrong',
  'bets on everything',
  'hums the same tune',
  'distrusts anyone with a sword',
  'owes money to someone dangerous',
  'is secretly a very good singer',
  'collects buttons',
  'talks to their horse more than to people',
  'is sure the weather is cursed',
]
const VOICES = [
  'slow and gravelly',
  'fast and breathless',
  'a whisper, always',
  'loud enough to fill the room',
  'a sing-song lilt',
  'flat and bored',
  'nervous, with a stammer',
  'posh and precise',
  'warm, like a grandparent',
  'clipped, like a soldier',
  'a thick country burr',
  'a dry, sarcastic drawl',
]

export type MadeUp = { name: string; role: string; look: string; quirk: string; voice: string }

const pick = <T>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length)]

/** Someone new: a name, what they do, a look, a quirk and a voice. */
export function makeSomeoneUp(rand: () => number = Math.random): MadeUp {
  return {
    name: `${pick(FIRST, rand)} ${pick(FAMILY, rand)}`,
    role: pick(ROLES, rand),
    look: pick(LOOKS, rand),
    quirk: pick(QUIRKS, rand),
    voice: pick(VOICES, rand),
  }
}

export const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase())

/** A made-up person's notes, for the box about how they talk: their voice, look and quirk. */
export function madeUpNotes(p: MadeUp): string {
  return `${capital(p.voice)}. Has ${p.look}, and ${p.quirk}.`
}
