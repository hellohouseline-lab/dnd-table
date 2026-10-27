// Paste your notes (S1d): a campaign written as plain text or Markdown, split into chapters,
// scenes, people and items. It reads the campaign template (docs/CAMPAIGN_TEMPLATE.md: "# Chapter",
// "## Scene 1.1", "## Cast" with "### NPC:", labels one per line), an older shorter layout
// (People, Items, "### scene" headings), and loose notes with headings. Anything it can't place goes into
// reminders (or a "Campaign notes" chapter, for the campaign's own notes), so nothing is lost.

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
  /** "1.2" from "Scene 1.2: The Mill", for choices that say "Scene 1.2". */
  number: string
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
  /** A picture's name in the library. */
  portrait: string
}

export type ParsedItem = { name: string; description: string; key: boolean; type: TypeTag; rarity: Rarity | null }

export type CampaignPlan = {
  title: string
  chapters: ParsedChapter[]
  people: ParsedPerson[]
  items: ParsedItem[]
}

const blankScene = (title: string, number = ''): ParsedScene => ({
  number,
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
  portrait: '',
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

/**
 * "Perception DC 13, secret DC, outcome hidden: to spot the figure. Pass: they see her. Fail: ...",
 * or "Perception DC 13 - to spot the figure". Pass and Fail come back as their own words.
 */
export function parseRoll(text: string): ParsedRoll & { pass: string; fail: string } {
  const pass = /\bPass:\s*(.*?)(?=\s*\bFail:|$)/i.exec(text)?.[1].trim().replace(/\.$/, '') ?? ''
  const fail = /\bFail:\s*(.*)$/i.exec(text)?.[1].trim().replace(/\.$/, '') ?? ''
  const body = text
    .replace(/\s*\bPass:.*$/i, '')
    .replace(/\s*\bFail:.*$/i, '')
    .trim()
  const dash = body.split(/\s+[\u2014\u2013-]{1,2}\s+/)
  let main = dash[0]
  let note = dash.slice(1).join(' ')
  if (dash.length === 1) {
    const colon = /^(.*?\bDC\s*\d+[^:]*?):\s*(.*)$/i.exec(body)
    if (colon) {
      main = colon[1]
      note = colon[2]
    }
  }
  note = note
    .trim()
    .replace(/^to\s+/i, '')
    .replace(/\.$/, '')
  const lower = main.toLowerCase()
  // "Dexterity saving throw" is a save; a bare "Strength DC 12" (or "Dexterity (thieves' tools)") a check.
  const ability = /^(strength|dexterity|constitution|intelligence|wisdom|charisma)\b/.exec(lower)?.[1]
  const askable =
    [...ASKABLES].sort((a, b) => b.name.length - a.name.length).find((a) => lower.includes(a.name.toLowerCase())) ??
    (ability
      ? (ASKABLES.find((a) => a.key === (/saving throw/.test(lower) ? `save:${ability}` : `ability:${ability}`)) ??
        null)
      : null)
  const dc = Number(/dc\s*(\d+)/i.exec(main)?.[1] ?? 15)
  const parts = main.split(',').map((p) => p.trim())
  const who = parts
    .slice(1)
    .filter(
      (p) => !/dc|secret|hidden|kept|shown|told|everyone|all|show the number|tell|outcome/i.test(p) && p.length > 0,
    )
  return {
    key: askable?.key ?? null,
    text: main.trim(),
    dc: Math.min(40, Math.max(1, dc)),
    dcShown: /show(n)? (the )?(dc|number)|tell (them )?the (dc|number)|dc shown|open dc/i.test(main),
    outcomeShown: !/outcome (hidden|kept|secret)|hide the outcome|keep the outcome|behind the screen/i.test(main),
    who,
    note: note.slice(0, 120),
    pass,
    fail,
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

type Section = 'none' | 'chapter' | 'people' | 'items' | 'notes'

const FIELD = /^\s*(?:[-*]\s+)?\*{0,2}([A-Za-z][A-Za-z ']{1,30}?)\*{0,2}\s*:\s*(.*)$/
const BULLET = /^\s*[-*]\s+/

/** Splits pasted notes into chapters, scenes, people and items. */
export function parseCampaign(text: string): CampaignPlan {
  const plan: CampaignPlan = { title: '', chapters: [], people: [], items: [] }
  let section: Section = 'none'
  let chapter: ParsedChapter | null = null
  let scene: ParsedScene | null = null
  let person: ParsedPerson | null = null
  let item: ParsedItem | null = null
  // A chapter's own lines (Goal, Ends when) wait for its first scene.
  let chapterNotes: string[] = []
  // The campaign's own notes (pitch, truth, monsters, flags, places), each a scene in Campaign notes.
  const notes: { title: string; lines: string[] }[] = []
  let note: { title: string; lines: string[] } | null = null
  // The field being filled over several lines: read-aloud, reminders, a list of rolls, and so on.
  let open: ((line: string) => void) | null = null

  const noteSection = (title: string) => {
    note = { title, lines: [] }
    notes.push(note)
    return note
  }
  const startScene = (title: string, number = '') => {
    if (!chapter) {
      chapter = { title: 'Chapter 1', scenes: [] }
      plan.chapters.push(chapter)
    }
    const made = blankScene(title, number)
    if (chapterNotes.length > 0) made.reminders = chapterNotes.join('\n')
    chapterNotes = []
    chapter.scenes.push(made)
    return made
  }

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      open = null
      const level = heading[1].length
      const title = heading[2].trim().replace(/\*+/g, '')
      const sceneHeading = /^scene\s*([\d.]*)\s*[:.]?\s*(.*)$/i.exec(title)
      const ending = /^ending\s*:\s*(.*)$/i.exec(title)
      if (
        /^campaign\s*:/i.test(title) ||
        (level === 1 && !/^(chapter|part|act|endings?)\b/i.test(title) && !plan.title)
      ) {
        plan.title = title.replace(/^campaign\s*:\s*/i, '')
        section = 'notes'
        noteSection('The campaign')
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
      if (/^(monsters|flags|places|handouts|notes)\b/i.test(title) && !sceneHeading) {
        section = 'notes'
        noteSection(title)
        continue
      }
      if (section === 'people' && level >= 3) {
        person = blankPerson(title.replace(/^npc\s*:\s*/i, '').replace(/\s*\(suggested[^)]*\)\s*$/i, ''))
        plan.people.push(person)
        continue
      }
      if (section === 'items' && level >= 3) {
        item = { name: title.replace(/^item\s*:\s*/i, ''), description: '', key: false, type: 'other', rarity: null }
        plan.items.push(item)
        continue
      }
      if (section === 'notes' && level >= 3 && note) {
        ;(note as { lines: string[] }).lines.push(`${title.replace(/^monster\s*:\s*/i, '')}:`)
        continue
      }
      if (sceneHeading && sceneHeading[2]) {
        section = 'chapter'
        scene = startScene(sceneHeading[2].trim(), sceneHeading[1].replace(/\.$/, ''))
        continue
      }
      if (ending) {
        section = 'chapter'
        scene = startScene(ending[1].trim())
        continue
      }
      if (level <= 2 || /^(chapter|part|act|endings?)\b/i.test(title)) {
        section = 'chapter'
        chapter = { title, scenes: [] }
        plan.chapters.push(chapter)
        scene = null
        chapterNotes = []
        continue
      }
      section = 'chapter'
      scene = startScene(title)
      continue
    }

    const field = FIELD.exec(line)
    const name = field?.[1].trim().toLowerCase() ?? ''
    const value = field?.[2].trim() ?? ''

    if (section === 'notes' || (section === 'none' && line.trim())) {
      const n = note ?? noteSection('The campaign')
      if (line.trim()) n.lines.push(line.trim())
      continue
    }

    if (section === 'people' && person) {
      const p: ParsedPerson = person
      const add = (key: 'voice' | 'wants' | 'knows' | 'secrets', words: string) =>
        (p[key] = p[key] ? `${p[key]}\n${words}` : words)
      if (field && !BULLET.test(line)) {
        open = null
        if (name === 'role') p.role = value
        else if (['place', 'where', 'found'].includes(name)) p.place = value
        else if (['attitude', 'feels'].includes(name))
          p.attitude = ATTITUDE_WORDS[value.toLowerCase().split(/\W/)[0]] ?? 'neutral'
        else if (name === 'portrait') p.portrait = value
        else if (['voice', 'talks', 'wants', 'knows', 'secrets', 'secret'].includes(name)) {
          const key = (name === 'talks' ? 'voice' : name === 'secret' ? 'secrets' : name) as
            'voice' | 'wants' | 'knows' | 'secrets'
          add(key, value)
          open = (more) => add(key, more)
        } else if (name === 'look') add('voice', `Look: ${value}`)
        else if (name === 'quest') add('wants', `Quest: ${value}`)
        else {
          // Fights as, Bond and the rest: kept with how to play them.
          add('voice', `${field[1].trim()}: ${value}`)
          const label = field[1].trim()
          open = (more) => add('voice', `${label}: ${more}`)
        }
      } else if (line.trim()) {
        const words = line.trim().replace(BULLET, '')
        if (open) open(words)
        else add('knows', words)
      }
      continue
    }

    if (section === 'items' && item) {
      const it: ParsedItem = item
      const add = (words: string) => (it.description = it.description ? `${it.description}\n${words}` : words)
      if (field && !BULLET.test(line)) {
        open = null
        if (name === 'key' || name === 'key item') it.key = yes(value)
        else if (name === 'type') it.type = TYPE_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? 'other'
        else if (name === 'rarity') it.rarity = RARITY_WORDS[value.toLowerCase()] ?? null
        else if (['what it is', 'description', 'about'].includes(name)) {
          add(value)
          open = add
        } else {
          // Does, Found, Matters for, Handout: part of what it is. Something that matters is a key item.
          if (name === 'matters for') it.key = true
          add(`${field[1].trim()}: ${value}`)
          open = add
        }
      } else if (line.trim()) {
        const words = line.trim().replace(BULLET, '')
        if (open) open(words)
        else add(words)
      }
      if (it.type === 'other') it.type = TYPE_WORDS.find(([pattern]) => pattern.test(it.name))?.[1] ?? 'other'
      continue
    }

    if (!scene) {
      // A chapter's own lines before its first scene (Goal, Ends when): kept for that scene.
      if (line.trim() && chapter) chapterNotes.push(line.trim().replace(BULLET, ''))
      continue
    }
    const sc: ParsedScene = scene
    const remind = (words: string) => (sc.reminders = sc.reminders ? `${sc.reminders}\n${words}` : words)
    const addRoll = (words: string) => {
      const roll = parseRoll(words)
      sc.rolls.push(roll)
      if (roll.pass || roll.fail) {
        remind(
          `${roll.text}: ${[roll.pass && `pass: ${roll.pass}`, roll.fail && `fail: ${roll.fail}`].filter(Boolean).join('; ')}`,
        )
      }
    }
    const addChoice = (words: string) => {
      const arrow = words.split(/\s*(?:->|\u2192|=>|: go to|then go to)\s*/i)
      const [choice, to] =
        arrow.length > 1
          ? arrow
          : (/^(.*?):\s*((?:scene\s*[\d.]+|ending\s*:).*)$/i.exec(words)?.slice(1) ?? [words, ''])
      sc.choices.push({ text: choice.replace(/^if\s+/i, '').trim(), to: (to ?? '').trim() })
    }
    const addThing = (words: string) => {
      const thing = FIELD.exec(words)
      const kind = thing?.[1].trim().toLowerCase() ?? ''
      const what = thing?.[2].trim() ?? words
      if (['item', 'give', 'key item'].includes(kind)) {
        const [itemName, ...how] = what.split(',')
        sc.gives.push(itemName.trim())
        if (how.join(',').trim()) remind(`${itemName.trim()}: ${how.join(',').trim()}`)
      } else if (['box', 'loot', 'search'].includes(kind)) sc.boxes.push(parseBox(what))
      else if (kind === 'shop') sc.shops.push(what)
      else remind(words)
    }
    const addFight = (words: string) => {
      const [monsters, ...rest] = words.split(';')
      sc.fight.push(...parseFight(monsters))
      for (const part of rest) {
        const map = /^\s*map\s*:\s*(.*)$/i.exec(part)
        if (map) sc.map = map[1].trim()
        else if (part.trim()) remind(`Fight: ${part.trim()}`)
      }
    }

    if (field && !BULLET.test(line)) {
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
          open = (more) => (sc.readAloud = sc.readAloud ? `${sc.readAloud}\n${more}` : more)
          continue
        case 'reminders':
        case 'notes':
        case 'dm notes':
          if (value) remind(value)
          open = remind
          continue
        case 'people':
        case 'npcs':
        case 'who':
          sc.people.push(...list(value))
          continue
        case 'roll':
        case 'rolls':
        case 'check':
        case 'checks':
        case 'save':
          if (value) addRoll(name === 'save' && !/save/i.test(value) ? `${value} save` : value)
          open = addRoll
          continue
        case 'choice':
        case 'choices':
          if (value) addChoice(value)
          open = addChoice
          continue
        case 'if':
          // "If: they ring the bell -> Scene 2.1" is a choice; "If: has the key: the door opens" is a reminder.
          if (/->|\u2192|=>|:\s*(scene\s*[\d.]+|ending\s*:)/i.test(value)) addChoice(value)
          else remind(`If: ${value}`)
          continue
        case 'things':
          if (value) addThing(value)
          open = addThing
          continue
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
          addFight(value)
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
        default: {
          // Checkpoints, level ups, side quests, Sets, With, When and anything else: a reminder, with its label.
          const label = field[1].trim()
          remind(`${label}: ${value}`)
          open = (more) => remind(`${label}: ${more}`)
          continue
        }
      }
    }
    const quoted = /^\s*>\s?(.*)$/.exec(line)
    if (quoted) {
      sc.readAloud = sc.readAloud ? `${sc.readAloud}\n${quoted[1]}` : quoted[1]
      continue
    }
    if (!line.trim()) continue
    const words = line.trim().replace(BULLET, '')
    if (open) open(words)
    else remind(words)
  }

  // The campaign's own notes come first, as a chapter to read before playing.
  const kept = notes.filter((n) => n.lines.length > 0)
  if (kept.length > 0) {
    plan.chapters.unshift({
      title: 'Campaign notes',
      // A campaign's own "Picture:" line (its key art) is its notes' picture, to show at the start.
      scenes: kept.map((n) => ({
        ...blankScene(n.title),
        reminders: n.lines.join('\n'),
        picture: n.lines.map((l) => /^Picture:\s*(.+)$/i.exec(l)?.[1].trim() ?? '').find(Boolean) ?? '',
      })),
    })
  }
  plan.chapters = plan.chapters.filter((c) => c.scenes.length > 0)
  for (const c of plan.chapters) for (const sc of c.scenes) sc.readAloud = sc.readAloud.trim()
  return plan
}

/** The scene a choice leads to: "Scene 1.2" by its number, or by title. */
export function choiceTarget<T extends { number?: string; title: string }>(scenes: T[], to: string): T | undefined {
  const number = /^scene\s*([\d.]+)/i.exec(to.trim())?.[1].replace(/\.$/, '')
  if (number) return scenes.find((s) => s.number === number)
  const title = to.trim().replace(/^ending\s*:\s*/i, '')
  return title ? matchName(scenes, (s) => s.title, title) : undefined
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
  const out = new Set<string>()
  for (const s of scenes) {
    for (const f of s.fight) {
      if (!matchName(known.monsters, (m) => m, f.name))
        out.add(`${f.name} isn't a monster in the free rules (in ${s.title})`)
    }
    for (const r of s.rolls) if (!r.key) out.add(`“${r.text}” isn't a check the table knows (in ${s.title})`)
    for (const c of s.choices) {
      if (c.to && !choiceTarget(scenes, c.to)) out.add(`No scene called ${c.to} (a choice in ${s.title})`)
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

/**
 * The maps, pictures and portraits a campaign names: each fight's map and each scene's picture, any
 * "Map: …" or "Picture: …" line in its notes (the Places list), and each person's portrait. Used to
 * bring in pictures that come with the table.
 */
export function namedArt(plan: CampaignPlan): { maps: string[]; portraits: string[]; pictures: string[] } {
  const scenes = plan.chapters.flatMap((c) => c.scenes)
  const listed = (label: string) =>
    scenes.flatMap((s) =>
      [...`${s.place}\n${s.reminders}`.matchAll(new RegExp(`(?:^|\\n)\\s*(?:-\\s*)?${label}:\\s*([^,\\n]+)`, 'g'))].map(
        (m) => m[1].trim(),
      ),
    )
  return {
    maps: [...new Set([...scenes.map((s) => s.map), ...listed('Map')].filter(Boolean))],
    portraits: [...new Set(plan.people.map((p) => p.portrait).filter(Boolean))],
    pictures: [...new Set([...scenes.map((s) => s.picture), ...listed('Picture')].filter(Boolean))],
  }
}
