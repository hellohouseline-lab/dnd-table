// Paste your notes (S1d): a campaign written as plain text or Markdown, split into chapters,
// scenes, people and items. The layout is in docs/CAMPAIGN_FORMAT.md (and Copy the format in the
// app), so an AI can write it: "## Chapter" headings, "### Scene" headings, and "Field: value"
// lines. Anything it doesn't recognise goes into the scene's reminders, so nothing is lost.

import { ASKABLES } from './askable.ts'
import type { Container, Richness } from './boxes.ts'
import type { Rarity, TypeTag } from './catalogue.ts'
import type { Attitude } from './npcs.ts'

export type ParsedRoll = {
  /** The check's key, if it was recognised ('skill:perception'). */
  key: string | null
  /** As written: "Perception DC 13, secret". */
  text: string
  dc: number
  dcShown: boolean
  outcomeShown: boolean
  /** Character names; empty for everyone. */
  who: string[]
  note: string
}

export type ParsedScene = {
  title: string
  place: string
  readAloud: string
  reminders: string
  people: string[]
  rolls: ParsedRoll[]
  /** "If they take the mill road" and the scene's title it leads to. */
  choices: { text: string; to: string }[]
  /** Names of items to hand out. */
  gives: string[]
  boxes: { container: Container; richness: Richness }[]
  shops: string[]
  /** Monsters by name, with how many. */
  fight: { name: string; count: number }[]
  map: string
  picture: string
  music: string
}

export type ParsedChapter = { title: string; scenes: ParsedScene[] }

export type ParsedPerson = {
  name: string
  role: string
  place: string
  voice: string
  wants: string
  knows: string
  secrets: string
  attitude: Attitude
}

export type ParsedItem = { name: string; description: string; key: boolean; type: TypeTag; rarity: Rarity | null }

export type CampaignPlan = {
  title: string
  chapters: ParsedChapter[]
  people: ParsedPerson[]
  items: ParsedItem[]
}

const blankScene = (title: string): ParsedScene => ({
  title,
  place: '',
  readAloud: '',
  reminders: '',
  people: [],
  rolls: [],
  choices: [],
  gives: [],
  boxes: [],
  shops: [],
  fight: [],
  map: '',
  picture: '',
  music: '',
})

const blankPerson = (name: string): ParsedPerson => ({
  name,
  role: '',
  place: '',
  voice: '',
  wants: '',
  knows: '',
  secrets: '',
  attitude: 'neutral',
})

const ATTITUDE_WORDS: Record<string, Attitude> = {
  friendly: 'friendly',
  warm: 'warm',
  neutral: 'neutral',
  wary: 'wary',
  suspicious: 'wary',
  unfriendly: 'wary',
  hostile: 'hostile',
}

const TYPE_WORDS: [RegExp, TypeTag][] = [
  [/weapon|sword|axe|bow|dagger|mace/i, 'weapons'],
  [/armou?r|shield/i, 'armour'],
  [/potion|elixir/i, 'potions'],
  [/ring/i, 'rings'],
  [/amulet|necklace|pendant|brooch/i, 'amulets'],
  [/cloak|robe|cape/i, 'cloaks'],
  [/boots|gloves|gauntlets|bracers/i, 'boots-gloves'],
  [/belt/i, 'belts'],
  [/hat|helm|circlet|crown/i, 'headwear'],
  [/bag|pouch|sack/i, 'bags'],
  [/wand/i, 'wands'],
  [/staff|rod/i, 'staffs-rods'],
  [/scroll|letter|map|book|note/i, 'scrolls'],
  [/tool|kit/i, 'tools'],
]

const RARITY_WORDS: Record<string, Rarity> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very rare': 'Very Rare',
  legendary: 'Legendary',
}

const CONTAINER_WORDS: [RegExp, Container][] = [
  [/chest|strongbox|coffer|crate/i, 'chest'],
  [/sack|pack|bag|satchel/i, 'sack'],
  [/body|corpse|pockets/i, 'body'],
  [/desk|cupboard|drawer|shelf|wardrobe/i, 'desk'],
  [/hoard|vault|treasury/i, 'hoard'],
]
const RICHNESS_WORDS: [RegExp, Richness][] = [
  [/junk|poor|worthless/i, 'junk'],
  [/treasure|hoard|rich/i, 'treasure'],
  [/valuable|fine|good/i, 'valuable'],
  [/ordinary|plain|common/i, 'ordinary'],
]

const yes = (v: string) => /^(yes|y|true|key)/i.test(v.trim())
const list = (v: string) =>
  v
    .split(/,|;| and /)
    .map((x) => x.trim())
    .filter(Boolean)

/** "Perception DC 13, secret, outcome hidden, Wren — to spot the figure". */
export function parseRoll(text: string): ParsedRoll {
  const [main, ...rest] = text.split(/\s+[—–-]{1,2}\s+|\s*:\s+to\s+/)
  const note = rest
    .join(' ')
    .trim()
    .replace(/^to\s+/i, '')
  const lower = main.toLowerCase()
  const askable =
    [...ASKABLES].sort((a, b) => b.name.length - a.name.length).find((a) => lower.includes(a.name.toLowerCase())) ??
    null
  const dc = Number(/dc\s*(\d+)/i.exec(main)?.[1] ?? 15)
  const parts = main.split(',').map((p) => p.trim())
  const who = parts
    .slice(1)
    .filter((p) => !/dc|secret|hidden|kept|shown|told|everyone|all|show the number|tell/i.test(p) && p.length > 0)
  return {
    key: askable?.key ?? null,
    text: main.trim(),
    dc: Math.min(40, Math.max(1, dc)),
    dcShown: /show(n)? (the )?(dc|number)|tell (them )?the (dc|number)|dc shown|open dc/i.test(main),
    outcomeShown: !/outcome (hidden|kept|secret)|hide the outcome|keep the outcome|behind the screen/i.test(main),
    who,
    note: note.slice(0, 120),
  }
}

/** "3 Goblin, 1 Goblin Boss", "Goblin x3", "2 × Wolf". */
export function parseFight(text: string): { name: string; count: number }[] {
  return list(text).flatMap((part) => {
    const lead = /^(\d+)\s*(?:×|x)?\s*(.+)$/i.exec(part)
    const tail = /^(.+?)\s*(?:×|x)\s*(\d+)$/i.exec(part)
    const name = (lead?.[2] ?? tail?.[1] ?? part).trim()
    const count = Number(lead?.[1] ?? tail?.[2] ?? 1)
    return name ? [{ name, count: Math.min(8, Math.max(1, count)) }] : []
  })
}

function parseBox(text: string): { container: Container; richness: Richness } {
  return {
    container: CONTAINER_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'chest',
    richness: RICHNESS_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'ordinary',
  }
}

type Section = 'none' | 'chapter' | 'people' | 'items'

const FIELD = /^\s*(?:[-*]\s+)?\*{0,2}([A-Za-z][A-Za-z ']{1,30}?)\*{0,2}\s*:\s*(.*)$/

/** Splits pasted notes into chapters, scenes, people and items. */
export function parseCampaign(text: string): CampaignPlan {
  const plan: CampaignPlan = { title: '', chapters: [], people: [], items: [] }
  let section: Section = 'none'
  let chapter: ParsedChapter | null = null
  let scene: ParsedScene | null = null
  let person: ParsedPerson | null = null
  let item: ParsedItem | null = null
  // The multi-line field being filled: read-aloud, reminders, or a person's or item's text.
  let open: { set: (line: string) => void } | null = null

  const ensureChapter = () => {
    if (!chapter) {
      chapter = { title: 'Chapter 1', scenes: [] }
      plan.chapters.push(chapter)
    }
    return chapter
  }
  const remind = (line: string) => {
    if (!scene) return
    scene.reminders = scene.reminders ? `${scene.reminders}\n${line}` : line
  }

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      open = null
      const level = heading[1].length
      const title = heading[2].trim().replace(/\*+/g, '')
      if (level === 1 && !/^chapter|^part|^act/i.test(title)) {
        plan.title = title.replace(/^campaign\s*:\s*/i, '')
        continue
      }
      if (/^(people|npcs|characters|cast)\b/i.test(title)) {
        section = 'people'
        continue
      }
      if (/^(items|key items|things|treasure)\b/i.test(title)) {
        section = 'items'
        continue
      }
      if (section === 'people' && level >= 3) {
        person = blankPerson(title)
        plan.people.push(person)
        continue
      }
      if (section === 'items' && level >= 3) {
        item = { name: title, description: '', key: false, type: 'other', rarity: null }
        plan.items.push(item)
        continue
      }
      if (level <= 2 || /^chapter|^part|^act/i.test(title)) {
        section = 'chapter'
        chapter = { title, scenes: [] }
        plan.chapters.push(chapter)
        scene = null
        continue
      }
      section = 'chapter'
      scene = blankScene(title.replace(/^scene\s*(\d+)?\s*[:.]\s*/i, ''))
      ensureChapter().scenes.push(scene)
      continue
    }

    const field = FIELD.exec(line)
    const name = field?.[1].trim().toLowerCase() ?? ''
    const value = field?.[2].trim() ?? ''

    if (section === 'people' && person) {
      const p: ParsedPerson = person
      if (
        field &&
        [
          'role',
          'place',
          'where',
          'found',
          'voice',
          'talks',
          'wants',
          'knows',
          'secrets',
          'secret',
          'attitude',
          'feels',
        ].includes(name)
      ) {
        if (name === 'role') p.role = value
        else if (['place', 'where', 'found'].includes(name)) p.place = value
        else if (['attitude', 'feels'].includes(name))
          p.attitude = ATTITUDE_WORDS[value.toLowerCase().split(/\W/)[0]] ?? 'neutral'
        else {
          const key = (name === 'talks' ? 'voice' : name === 'secret' ? 'secrets' : name) as
            'voice' | 'wants' | 'knows' | 'secrets'
          p[key] = value
          open = { set: (more) => (p[key] = p[key] ? `${p[key]}\n${more}` : more) }
        }
      } else if (line.trim()) {
        if (open) open.set(line.trim().replace(/^[-*]\s+/, ''))
        else p.knows = p.knows ? `${p.knows}\n${line.trim()}` : line.trim()
      }
      continue
    }

    if (section === 'items' && item) {
      const it: ParsedItem = item
      if (field && ['key', 'key item', 'type', 'rarity', 'what it is', 'description', 'about'].includes(name)) {
        if (name === 'key' || name === 'key item') it.key = yes(value)
        else if (name === 'type') it.type = TYPE_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? 'other'
        else if (name === 'rarity') it.rarity = RARITY_WORDS[value.toLowerCase()] ?? null
        else {
          it.description = value
          open = { set: (more) => (it.description = it.description ? `${it.description}\n${more}` : more) }
        }
      } else if (line.trim()) {
        if (open) open.set(line.trim())
        else it.description = it.description ? `${it.description}\n${line.trim()}` : line.trim()
      }
      if (it.type === 'other') it.type = TYPE_WORDS.find(([pattern]) => pattern.test(it.name))?.[1] ?? 'other'
      continue
    }

    if (!scene) {
      // Text before the first scene of a chapter: keep it as the first scene's notes.
      if (line.trim() && chapter) {
        scene = blankScene(chapter.title)
        chapter.scenes.push(scene)
      } else continue
    }
    const sc: ParsedScene = scene
    if (field) {
      open = null
      switch (name) {
        case 'place':
        case 'where':
        case 'location':
          sc.place = value
          continue
        case 'read aloud':
        case 'read-aloud':
        case 'boxed text':
          sc.readAloud = value.replace(/^>\s?/, '')
          open = { set: (more) => (sc.readAloud = sc.readAloud ? `${sc.readAloud}\n${more}` : more) }
          continue
        case 'reminders':
        case 'notes':
        case 'dm notes':
          if (value) remind(value)
          open = { set: remind }
          continue
        case 'people':
        case 'npcs':
        case 'who':
          sc.people.push(...list(value))
          continue
        case 'roll':
        case 'check':
        case 'save':
          sc.rolls.push(parseRoll(name === 'save' && !/save/i.test(value) ? `${value} save` : value))
          continue
        case 'choice':
        case 'if': {
          const [choice, to] = value.split(/\s*(?:->|→|=>|: go to|then go to)\s*/i)
          sc.choices.push({ text: choice.replace(/^if\s+/i, ''), to: (to ?? '').trim() })
          continue
        }
        case 'give':
        case 'gives':
        case 'key item':
        case 'item':
          sc.gives.push(...list(value))
          continue
        case 'box':
        case 'loot':
        case 'search':
          sc.boxes.push(parseBox(value))
          continue
        case 'shop':
          sc.shops.push(value)
          continue
        case 'fight':
        case 'monsters':
        case 'encounter':
          sc.fight.push(...parseFight(value))
          continue
        case 'map':
          sc.map = value
          continue
        case 'picture':
        case 'image':
          sc.picture = value
          continue
        case 'music':
          sc.music = value
          continue
        default:
          // Checkpoints, level ups, side quests, XP and anything else: a reminder, with its label.
          remind(`${field[1].trim()}: ${value}`)
          open = { set: remind }
          continue
      }
    }
    const quoted = /^\s*>\s?(.*)$/.exec(line)
    if (quoted) {
      sc.readAloud = sc.readAloud ? `${sc.readAloud}\n${quoted[1]}` : quoted[1]
      continue
    }
    if (!line.trim()) continue
    if (open) open.set(line.trim().replace(/^[-*]\s+/, ''))
    else remind(line.trim())
  }

  // Tidy: no empty chapters at the end, read-aloud paragraphs kept.
  plan.chapters = plan.chapters.filter((c) => c.scenes.length > 0 || c.title)
  for (const c of plan.chapters) for (const s of c.scenes) s.readAloud = s.readAloud.trim()
  return plan
}

/** How much a plan holds, in words: "2 chapters, 7 scenes, 4 people and 3 items". */
export function planWords(plan: CampaignPlan): string {
  const scenes = plan.chapters.reduce((n, c) => n + c.scenes.length, 0)
  const bits = [
    `${plan.chapters.length} chapter${plan.chapters.length === 1 ? '' : 's'}`,
    `${scenes} scene${scenes === 1 ? '' : 's'}`,
    `${plan.people.length} ${plan.people.length === 1 ? 'person' : 'people'}`,
    `${plan.items.length} item${plan.items.length === 1 ? '' : 's'}`,
  ]
  return `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`
}

/** A name matched loosely: the same ignoring case, then without a plural "s", then as part of a longer name. */
export function matchName<T>(things: T[], nameOf: (t: T) => string, name: string): T | undefined {
  const want = name.trim().toLowerCase()
  if (!want) return undefined
  const singular = want.replace(/(es|s)$/, '')
  return (
    things.find((t) => nameOf(t).toLowerCase() === want) ??
    things.find((t) => nameOf(t).toLowerCase() === singular || nameOf(t).toLowerCase() === want.replace(/s$/, '')) ??
    // "Forest" finds "Forest road", but "Hobgoblin" never finds "Goblin".
    things.find((t) => nameOf(t).toLowerCase().includes(want))
  )
}

/** What won't come across as written: monsters, pictures, rolls or scenes it can't find. */
export function planWarnings(
  plan: CampaignPlan,
  known: { monsters: string[]; assets: string[]; shops: string[] },
): string[] {
  const scenes = plan.chapters.flatMap((c) => c.scenes)
  const titles = scenes.map((s) => s.title)
  const out = new Set<string>()
  for (const s of scenes) {
    for (const f of s.fight) {
      if (!matchName(known.monsters, (m) => m, f.name))
        out.add(`${f.name} isn't a monster in the free rules (in ${s.title})`)
    }
    for (const r of s.rolls) if (!r.key) out.add(`“${r.text}” isn't a check the table knows (in ${s.title})`)
    for (const c of s.choices) {
      if (c.to && !matchName(titles, (t) => t, c.to)) out.add(`No scene called ${c.to} (a choice in ${s.title})`)
    }
    for (const name of [s.picture, s.music, s.map].filter(Boolean)) {
      if (!matchName(known.assets, (a) => a, name))
        out.add(`Nothing called ${name} in your library yet (in ${s.title})`)
    }
    for (const shop of s.shops)
      if (!matchName(known.shops, (n) => n, shop)) out.add(`No shop called ${shop} (in ${s.title})`)
  }
  return [...out]
}
