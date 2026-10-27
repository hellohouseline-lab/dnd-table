// The Rules panel's words (S1e): each rule in two or three plain sentences, written for this table
// from SRD 5.1 (CC-BY-4.0), never from the books. Each entry names where the free rules' own words
// are (a condition, or sections of src/rules/srd/rules.json), which the panel folds underneath.

import { CONDITIONS, SKILLS, type SrdSpell } from './srd/index.ts'

export type RuleSectionKey = 'conditions' | 'turn' | 'dice' | 'resting' | 'spells'

export const RULE_SECTIONS: { key: RuleSectionKey; name: string; hint: string }[] = [
  { key: 'conditions', name: 'Conditions', hint: 'What prone, poisoned and the rest do to you' },
  { key: 'turn', name: 'On your turn', hint: 'Moving, your action, bonus actions and reactions' },
  { key: 'dice', name: 'Rolling dice', hint: 'Checks, saves, attacks, advantage and skills' },
  { key: 'resting', name: 'Resting', hint: 'Short and long rests, hit dice and healing' },
  { key: 'spells', name: 'Spells', hint: 'Your class\u2019s spells, and how spells work' },
]

export type RuleEntry = {
  /** "condition:prone", "turn:dash", "dice:advantage". */
  id: string
  section: RuleSectionKey
  title: string
  /** Our own plain words. */
  plain: string
  /** A list under the plain words (exhaustion's levels, the skills). */
  list?: string[]
  /** Other words people might search for ("run" finds Dash). */
  also?: string[]
  /** The free rules' own words: a condition's index, or rules sections' indexes. */
  srdCondition?: string
  srdSections?: string[]
  /** For a spell: the spell, whose own text is the rule. */
  spell?: SrdSpell
}

const CONDITION_WORDS: Record<string, { plain: string; list?: string[]; also?: string[] }> = {
  blinded: {
    plain:
      "You can't see. Any check that needs sight fails. Attacks against you have advantage, and your own attacks have disadvantage.",
    also: ['blind'],
  },
  charmed: {
    plain:
      "You can't attack the one who charmed you, or aim anything harmful at them. They have advantage on checks to talk you round.",
  },
  deafened: { plain: "You can't hear, and any check that needs hearing fails.", also: ['deaf'] },
  frightened: {
    plain:
      "While you can see what scares you, your checks and attacks have disadvantage, and you can't choose to move closer to it.",
    also: ['fear', 'scared', 'afraid'],
  },
  grappled: {
    plain:
      "Someone has hold of you: your speed is 0. It ends if they're knocked out or you're moved out of their reach. To break free, use your action for an Athletics or Acrobatics check against their Athletics.",
    also: ['grab', 'held'],
  },
  incapacitated: { plain: "You can't take actions or reactions." },
  invisible: {
    plain:
      'Nobody can see you without magic or special senses, though they may still hear you or spot your footprints. Your attacks have advantage, and attacks against you have disadvantage.',
  },
  paralyzed: {
    plain:
      "You're incapacitated and can't move or speak. You fail Strength and Dexterity saves. Attacks against you have advantage, and any hit from within 5 feet is a critical hit.",
    also: ['paralysed'],
  },
  petrified: {
    plain:
      "You're turned to stone, with everything you wear and carry. You can't act, move or speak, and you fail Strength and Dexterity saves. Attacks against you have advantage, you resist all damage, and any poison or disease is paused.",
    also: ['stone'],
  },
  poisoned: { plain: 'Your attack rolls and ability checks have disadvantage.', also: ['poison'] },
  prone: {
    plain:
      "You're lying on the ground. You can only crawl (each foot costs an extra foot) until you stand up, which costs half your speed. Your attacks have disadvantage. Attacks from within 5 feet have advantage against you; from further away, disadvantage.",
    also: ['knocked down', 'lying down', 'fall over'],
  },
  restrained: {
    plain:
      'Your speed is 0. Attacks against you have advantage, your own attacks have disadvantage, and your Dexterity saves have disadvantage.',
    also: ['tied', 'webbed', 'net'],
  },
  stunned: {
    plain:
      "You're incapacitated, can't move, and can only speak a few faltering words. You fail Strength and Dexterity saves, and attacks against you have advantage.",
  },
  unconscious: {
    plain:
      "You're out cold: you can't act, move or speak, and don't know what's going on. You drop what you're holding and fall prone. You fail Strength and Dexterity saves; attacks against you have advantage, and any hit from within 5 feet is a critical hit.",
    also: ['knocked out', 'asleep'],
  },
  exhaustion: {
    plain:
      'Tiredness that builds up in six levels, each adding to the ones before it. A long rest with food and drink takes away one level.',
    list: [
      'Level 1: disadvantage on ability checks',
      'Level 2: your speed is halved',
      'Level 3: disadvantage on attack rolls and saving throws',
      'Level 4: your hit point maximum is halved',
      'Level 5: your speed is 0',
      'Level 6: death',
    ],
    also: ['tired', 'exhausted'],
  },
}

const SKILL_EXAMPLES: Record<string, string> = {
  acrobatics: 'keeping your feet on ice, tumbling, balancing',
  'animal-handling': "calming a horse, reading an animal's mood",
  arcana: 'knowing about spells, magic items and other planes',
  athletics: 'climbing, jumping, swimming, grabbing someone',
  deception: 'lying convincingly, a disguise',
  history: 'remembering past events, kingdoms and wars',
  insight: 'telling if someone is lying, reading their mood',
  intimidation: 'threats, scaring someone into talking',
  investigation: 'searching for clues, working out how something works',
  medicine: 'saving someone who is dying, spotting an illness',
  nature: 'plants, animals, weather and the land',
  perception: 'spotting, hearing or noticing something',
  performance: 'music, dance, acting, telling a story',
  persuasion: 'talking someone round honestly, haggling',
  religion: 'gods, rites and holy symbols',
  'sleight-of-hand': 'picking a pocket, hiding something on you',
  stealth: 'sneaking, hiding, moving quietly',
  survival: 'tracking, hunting, finding your way, finding food',
}

const ABILITY_NAMES: Record<string, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
}

const TURN: Omit<RuleEntry, 'section'>[] = [
  {
    id: 'turn:order',
    title: 'How a fight goes',
    plain:
      "The DM may decide some of you are caught by surprise. Then everyone rolls initiative: a d20 plus your Dexterity bonus. Turns go from highest to lowest. Once everyone has had a turn, that's a round (about 6 seconds), and the next round starts at the top.",
    also: ['initiative', 'surprise', 'round', 'combat', 'fight'],
    srdSections: ['the-order-of-combat', 'surprise', 'initiative'],
  },
  {
    id: 'turn:your-turn',
    title: 'Your turn',
    plain:
      'You can move up to your speed and take one action, in either order, and split your move around the action. You can also do one small thing for free, such as drawing a weapon or opening a door, and take a bonus action if something you have says it uses one (a spell, a feature, or an attack with your other hand).',
    also: ['bonus action', 'action', 'move', 'speed', 'free'],
    srdSections: ['your-turn', 'breaking-up-your-move', 'interacting-with-objects-around-you'],
  },
  {
    id: 'turn:reactions',
    title: 'Reactions',
    plain:
      "A reaction is an instant response, even on somebody else's turn: an opportunity attack, or a spell such as Shield. You get one, and it comes back at the start of your turn.",
    also: ['reaction'],
    srdSections: ['reactions'],
  },
  {
    id: 'turn:moving',
    title: 'Moving around',
    plain:
      "Difficult ground (rubble, deep snow, thick undergrowth) costs 2 feet of movement for every foot. You can move through a friend's space but not stop there, and through an enemy's only if it's much bigger or smaller than you. Dropping prone is free; standing up costs half your speed.",
    also: ['difficult terrain', 'terrain', 'stand up', 'crawl'],
    srdSections: ['difficult-terrain', 'being-prone', 'moving-around-other-creatures'],
  },
  {
    id: 'turn:attack',
    title: 'Action: Attack',
    plain:
      'Make one attack with a weapon or your fists. Some classes get more than one attack with this action later on.',
    also: ['hit', 'strike', 'swing', 'punch'],
    srdSections: ['attack'],
  },
  {
    id: 'turn:cast-a-spell',
    title: 'Action: Cast a spell',
    plain:
      'Cast a spell that takes 1 action. A spell that takes a bonus action or a reaction uses that instead. If you cast a spell as a bonus action, the only other spell you can cast that turn is a cantrip that takes 1 action.',
    also: ['spell', 'magic'],
    srdSections: ['cast-a-spell', 'casting-time'],
  },
  {
    id: 'turn:dash',
    title: 'Action: Dash',
    plain: 'Move further: you get extra movement equal to your speed for this turn.',
    also: ['run', 'sprint', 'double move'],
    srdSections: ['dash'],
  },
  {
    id: 'turn:disengage',
    title: 'Action: Disengage',
    plain: 'Move away safely: nobody gets an opportunity attack on you for the rest of your turn.',
    also: ['retreat', 'flee', 'back off', 'escape'],
    srdSections: ['disengage'],
  },
  {
    id: 'turn:dodge',
    title: 'Action: Dodge',
    plain:
      'Until your next turn, attacks against you have disadvantage if you can see the attacker, and your Dexterity saves have advantage.',
    also: ['defend', 'defence'],
    srdSections: ['dodge'],
  },
  {
    id: 'turn:help',
    title: 'Action: Help',
    plain:
      "Give a friend advantage on their next check, or on their next attack against an enemy within 5 feet of you, as long as it's before your next turn.",
    also: ['assist', 'aid'],
    srdSections: ['help'],
  },
  {
    id: 'turn:hide',
    title: 'Action: Hide',
    plain:
      "Make a Stealth check to hide, when you're out of sight. The DM decides when hiding is possible. While hidden, your first attack has advantage, and it gives you away.",
    also: ['sneak', 'stealth'],
    srdSections: ['hide'],
  },
  {
    id: 'turn:ready',
    title: 'Action: Ready',
    plain:
      'Choose a trigger and what you\'ll do when it happens ("when the door opens, I shoot"). When it happens, you use your reaction to do it. A readied spell needs your concentration until then.',
    also: ['wait', 'hold', 'prepare'],
    srdSections: ['ready'],
  },
  {
    id: 'turn:search',
    title: 'Action: Search',
    plain: 'Look for something. The DM may ask for a Perception or Investigation check.',
    also: ['look', 'find'],
    srdSections: ['search'],
  },
  {
    id: 'turn:use-an-object',
    title: 'Action: Use an object',
    plain:
      'Use something that takes real effort, such as drinking a potion, or a second small thing beyond your free one.',
    also: ['potion', 'drink', 'item'],
    srdSections: ['use-an-object'],
  },
  {
    id: 'turn:opportunity-attacks',
    title: 'Opportunity attacks',
    plain:
      "When an enemy you can see moves out of your reach, you can use your reaction to make one melee attack against it. Taking the Disengage action, or being moved by someone else, doesn't give anyone the chance.",
    also: ['attack of opportunity', 'leaving reach'],
    srdSections: ['melee-attacks'],
  },
  {
    id: 'turn:two-weapons',
    title: 'Fighting with two weapons',
    plain:
      "When you attack with a light weapon in one hand, you can use your bonus action to attack with a light weapon in the other. Don't add your ability bonus to that second hit's damage, unless it's below zero.",
    also: ['off hand', 'off-hand', 'dual wield', 'two weapon'],
    srdSections: ['melee-attacks'],
  },
  {
    id: 'turn:grapple-shove',
    title: 'Grabbing and shoving',
    plain:
      'Instead of one of your attacks, grab or shove a creature no more than one size bigger than you: your Athletics against its Athletics or Acrobatics. A grab sets its speed to 0; a shove knocks it prone or pushes it 5 feet away.',
    also: ['grapple', 'push', 'shove', 'trip'],
    srdSections: ['melee-attacks'],
  },
  {
    id: 'turn:ranged',
    title: 'Shooting and throwing',
    plain:
      "Ranged weapons have two ranges, such as 80/320 feet. Beyond the first, you have disadvantage; beyond the second, you can't. You also have disadvantage when an enemy who can see you is within 5 feet.",
    also: ['bow', 'range', 'throw', 'shoot'],
    srdSections: ['ranged-attacks'],
  },
  {
    id: 'turn:cover',
    title: 'Cover',
    plain:
      "Ducking behind something helps. Half cover adds 2 to your AC and Dexterity saves, three-quarters cover adds 5, and full cover means you can't be targeted directly.",
    srdSections: ['cover'],
  },
  {
    id: 'turn:dropping',
    title: 'Dropping to 0 hit points',
    plain:
      "You fall unconscious. At the start of each of your turns, roll a death saving throw: 10 or more is a success, under 10 a failure. Three successes and you're stable; three failures and you die. A 20 brings you back with 1 hit point, and a 1 counts as two failures. Any healing brings you back up.",
    also: ['death save', 'death saving throw', 'dying', 'stable', 'unconscious'],
    srdSections: ['dropping-to-0-hit-points'],
  },
]

const DICE: Omit<RuleEntry, 'section'>[] = [
  {
    id: 'dice:d20',
    title: 'The d20 roll',
    plain:
      "Most things come down to rolling a d20, adding a bonus, and comparing the total with a number to beat. Your bonus is the ability's modifier, plus your proficiency bonus if you're trained. The table adds it all up for you.",
    also: ['modifier', 'bonus', 'proficiency', 'proficient'],
    srdSections: ['ability-scores-and-modifiers', 'proficiency-bonus'],
  },
  {
    id: 'dice:checks',
    title: 'Ability checks',
    plain:
      "A check is trying something that might not work: climbing a wall, spotting a trap, telling a convincing lie. The DM picks a difficulty (the DC), and you need to match or beat it. A natural 20 or 1 doesn't win or lose on its own; only the total counts.",
    also: ['check', 'dc', 'difficulty'],
    srdSections: ['ability-checks'],
  },
  {
    id: 'dice:dc',
    title: 'How hard is a DC?',
    plain: 'The number to beat, set by the DM:',
    list: ['5: very easy', '10: easy', '15: medium', '20: hard', '25: very hard', '30: nearly impossible'],
    also: ['difficulty class', 'dc'],
    srdSections: ['typical-difficulty-classes'],
  },
  {
    id: 'dice:saves',
    title: 'Saving throws',
    plain:
      "A save is resisting something done to you: diving clear of a fireball (Dexterity), shrugging off poison (Constitution), fighting off a charm (Wisdom). You add the ability's modifier, plus your proficiency bonus if your class is trained in it. A natural 20 or 1 doesn't win or lose on its own; only the total counts.",
    also: ['save', 'saving throw'],
    srdSections: ['saving-throws'],
  },
  {
    id: 'dice:attacks',
    title: 'Attack rolls',
    plain:
      "To hit, roll a d20 and add your attack bonus; you need to match or beat the target's Armour Class (AC). A natural 20 always hits and is a critical hit: roll the damage dice twice. A natural 1 always misses.",
    also: ['to hit', 'armour class', 'armor class', 'ac', 'critical', 'crit', 'natural 20', 'natural 1'],
    srdSections: ['attack-rolls'],
  },
  {
    id: 'dice:advantage',
    title: 'Advantage and disadvantage',
    plain:
      'With advantage, roll two d20s and use the higher; with disadvantage, the lower. If you have both, they cancel out and you roll one, however many of each you have.',
    also: ['advantage', 'disadvantage', 'two dice'],
    srdSections: ['advantage-and-disadvantage'],
  },
  {
    id: 'dice:contests',
    title: 'Contests',
    plain:
      'When two people struggle against each other (an arm-wrestle, a tug of war), both roll and the higher total wins. A tie leaves things as they were.',
    also: ['contest', 'versus', 'opposed'],
    srdSections: ['contests'],
  },
  {
    id: 'dice:passive',
    title: 'Passive checks',
    plain:
      'When the DM wants to know if you notice something without asking you to roll, they use your passive score: 10 plus your bonus. Your passive Perception is on your plate (Percep.).',
    also: ['passive perception', 'notice'],
    srdSections: ['passive-checks'],
  },
  {
    id: 'dice:together',
    title: 'Working together',
    plain:
      'When someone helps you with a task, you roll with advantage. For a group check (sneaking past as a party), it works if at least half of you pass.',
    also: ['group check', 'help'],
    srdSections: ['working-together'],
  },
  {
    id: 'dice:skills',
    title: 'The 18 skills',
    plain: 'Skills are things you can be trained in. Each belongs to an ability, and the DM tells you which to roll:',
    list: SKILLS.map((s) => `${s.name} (${ABILITY_NAMES[s.ability]}): ${SKILL_EXAMPLES[s.index] ?? ''}`),
    also: [...SKILLS.map((s) => s.name), 'skill'],
    srdSections: ['skills'],
  },
]

const RESTING: Omit<RuleEntry, 'section'>[] = [
  {
    id: 'rest:short',
    title: 'Short rest',
    plain:
      "At least an hour of quiet: eating, drinking, binding wounds. You can spend hit dice to heal: roll each one and add your Constitution modifier. Some features come back too, such as a fighter's Second Wind or a warlock's spell slots.",
    also: ['short rest', 'rest'],
    srdSections: ['resting', 'short-rest'],
  },
  {
    id: 'rest:long',
    title: 'Long rest',
    plain:
      'At least 8 hours, mostly sleeping. You get all your hit points back and up to half your hit dice (at least one), and your spell slots and most features come back. Only one every 24 hours, and you need at least 1 hit point to start. An hour of fighting or walking means starting again.',
    also: ['long rest', 'sleep', 'rest'],
    srdSections: ['long-rest'],
  },
  {
    id: 'rest:hit-dice',
    title: 'Hit dice',
    plain:
      "Your own small pool of healing for short rests: one die per level, and the size depends on your class (a wizard's d6, a fighter's d10, a barbarian's d12). How many you have left is on your Sheet.",
    also: ['hit die', 'hit dice', 'heal'],
    srdSections: ['short-rest', 'hit-points'],
  },
  {
    id: 'rest:at-this-table',
    title: 'Resting at this table',
    plain:
      'The DM calls the rest. After a short rest, features such as Second Wind come back by themselves, and you spend hit dice from the Hit dice box on your Sheet: the table rolls them and adds your Constitution. After a long rest everything fills back up by itself, and you lose a level of exhaustion.',
    also: ['rest'],
  },
  {
    id: 'rest:healing',
    title: 'Healing and temporary hit points',
    plain:
      "Healing can't take you above your hit point maximum. Temporary hit points are a cushion that goes first when you're hurt. They don't add together (keep whichever is bigger), healing doesn't top them up, and they're gone after a long rest.",
    also: ['heal', 'temp hp', 'temporary hit points', 'hit points'],
    srdSections: ['healing', 'temporary-hit-points'],
  },
]

const SPELLCASTING: Omit<RuleEntry, 'section'>[] = [
  {
    id: 'spells:slots',
    title: 'Spell slots',
    plain:
      "Casting a spell of level 1 or higher uses up a slot of that level or higher, and a higher slot can make it stronger. Cantrips cost nothing. Slots come back after a long rest (a warlock's after a short rest).",
    also: ['slot', 'slots', 'upcast', 'higher level'],
    srdSections: ['spell-slots'],
  },
  {
    id: 'spells:known',
    title: 'Known and prepared spells',
    plain:
      'Bards, sorcerers, rangers and warlocks know a set list of spells. Clerics, druids, paladins and wizards choose which to prepare after each long rest: clerics, druids and paladins from their whole class list, wizards from their spellbook.',
    also: ['prepare', 'prepared', 'known', 'spellbook'],
    srdSections: ['known-and-prepared-spells'],
  },
  {
    id: 'spells:cantrips',
    title: 'Cantrips',
    plain: 'Simple spells you can cast as often as you like, with no slot. Many get stronger as you level up.',
    also: ['cantrip'],
    srdSections: ['cantrips'],
  },
  {
    id: 'spells:concentration',
    title: 'Concentration',
    plain:
      "Some spells last only while you concentrate on them, and you can only concentrate on one at a time: casting another ends the first. When you take damage, make a Constitution save (DC 10, or half the damage if that's more) or lose it. Being knocked out ends it too.",
    also: ['concentrating', 'concentrate'],
    srdSections: ['duration'],
  },
  {
    id: 'spells:components',
    title: 'Components',
    plain:
      'V means you have to speak, S that you need a free hand to gesture, and M that you need a material. A component pouch or a spellcasting focus covers materials, unless the spell says they have a cost.',
    also: ['verbal', 'somatic', 'material', 'focus', 'component pouch'],
    srdSections: ['components'],
  },
  {
    id: 'spells:rituals',
    title: 'Rituals',
    plain:
      'A spell marked ritual can be cast without using a slot if you take 10 minutes longer, as long as your class can cast rituals.',
    also: ['ritual'],
    srdSections: ['rituals'],
  },
  {
    id: 'spells:attacks-saves',
    title: 'Spell attacks and saves',
    plain:
      "Some spells make an attack roll (your spell attack bonus against the target's AC). Others make the target save against your spell save DC. The table works both out for you; they're on your Sheet.",
    also: ['spell attack', 'spell save dc', 'save dc'],
    srdSections: ['spell-attack-rolls', 'spell-saving-throws'],
  },
]

/** A spell as a Rules entry: what kind of spell it is in a line; its own text is the rule. */
export function spellEntry(spell: SrdSpell): RuleEntry {
  const kind = `${spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}, ${spell.school.toLowerCase()}`
  return {
    id: `spell:${spell.index}`,
    section: 'spells',
    title: spell.name,
    plain: [
      kind,
      spell.castingTime,
      spell.range,
      spell.components.replace(/\s*\(.*\)$/, ''),
      spell.duration,
      spell.concentration ? 'concentration' : '',
      spell.ritual ? 'ritual' : '',
    ]
      .filter(Boolean)
      .join(' · '),
    spell,
  }
}

/** Every entry in the panel, in order: conditions, your turn, dice, resting, how spells work. */
export const RULE_ENTRIES: RuleEntry[] = [
  ...CONDITIONS.map((c): RuleEntry => ({
    id: `condition:${c.index}`,
    section: 'conditions',
    title: c.name,
    plain: CONDITION_WORDS[c.index]?.plain ?? '',
    list: CONDITION_WORDS[c.index]?.list,
    also: CONDITION_WORDS[c.index]?.also,
    srdCondition: c.index,
  })),
  ...TURN.map((e): RuleEntry => ({ ...e, section: 'turn' })),
  ...DICE.map((e): RuleEntry => ({ ...e, section: 'dice' })),
  ...RESTING.map((e): RuleEntry => ({ ...e, section: 'resting' })),
  ...SPELLCASTING.map((e): RuleEntry => ({ ...e, section: 'spells' })),
]

/** The entry for a condition the character has ("prone"), if there is one. */
export function conditionEntry(index: string): RuleEntry | undefined {
  return RULE_ENTRIES.find((e) => e.id === `condition:${index}`)
}

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z0-9']+/g, ' ')} `.replace(/\s+/g, ' ')
/** Whether the text has a word starting with what's wanted ("run" is in "run away", not "trunk"). */
const has = (text: string, wanted: string) => text.includes(` ${wanted}`)

/**
 * Entries matching what was typed, best first: a title that starts with it, then a title that has
 * it, then other words for it ("run" finds Dash), then the plain words and the free rules' words.
 * Every word typed must start a word somewhere.
 */
export function searchRules(
  entries: RuleEntry[],
  query: string,
  srdText: (entry: RuleEntry) => string = () => '',
): RuleEntry[] {
  const wanted = words(query).trim()
  if (!wanted) return entries
  const parts = wanted.split(/\s+/)
  const scored = entries.flatMap((entry) => {
    const title = words(entry.title.replace(/^Action: /, ''))
    const also = (entry.also ?? []).map(words)
    const body = words([entry.plain, ...(entry.list ?? [])].join(' '))
    // A spell's own text counts like the free rules' words.
    const srd = words(entry.spell ? entry.spell.desc : srdText(entry))
    const everything = [title, ...also, body, srd].join(' ')
    if (!parts.every((p) => has(everything, p))) return []
    const score =
      (title.startsWith(` ${wanted}`) ? 100 : 0) +
      (has(title, wanted) ? 50 : 0) +
      (also.some((a) => a.trim() === wanted) ? 40 : also.some((a) => has(a, wanted)) ? 25 : 0) +
      (has(body, wanted) ? 10 : 0) +
      (has(srd, wanted) ? 2 : 0)
    return [{ entry, score }]
  })
  return scored.sort((a, b) => b.score - a.score).map((s) => s.entry)
}
