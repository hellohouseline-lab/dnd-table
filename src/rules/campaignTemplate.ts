// The campaign format (S1d), as text to copy: the layout with a short worked example (our own
// writing), and a prompt to give an AI such as Fable so it writes a campaign the table can read.
// docs/CAMPAIGN_FORMAT.md explains it at more length.

export const CAMPAIGN_FORMAT = `# Campaign: The Ember Road

## People

### Brenna
Role: Innkeeper
Place: The Rusty Flagon, Millbrook
Attitude: warm
Voice: Loud and warm, calls everyone "love".
Wants: Her son home safe from the mine.
Knows: The merchant left for the old mill two nights ago.
Secrets: She owes the goblins money.

### Snaggle
Role: Hobgoblin chief
Place: The old mill
Attitude: hostile
Voice: Shrill, giggles, talks about himself as "the great Snaggle".
Wants: The merchant's gold, and to be feared.

## Items

### The Raven Seal
Key item: yes
Type: other
What it is: A black wax seal stamped with a raven. Proof the merchant was carrying letters for the baron.

### Merchant's ledger
Key item: yes
What it is: Pages of debts. Brenna's name is on the last page.

## Chapter 1: Trouble in Millbrook

### The Rusty Flagon
Place: The Rusty Flagon, Millbrook
Picture: Tavern
Music: Tavern
Read aloud:
> Rain drums on the shutters. Inside the Rusty Flagon, smoke curls from a hearth big enough to roast an ox,
> and every head turns as you shake the water from your cloaks.
Reminders:
- Brenna knows the merchant went to the old mill.
- A hooded figure in the corner is a spy for the goblins.
People: Brenna
Roll: Perception DC 13, outcome hidden - to notice the hooded figure watching
Roll: Insight DC 15 - to see Brenna is hiding something
Choice: they take the mill road -> The Mill Road
Checkpoint: the party knows where the merchant went.

### The Mill Road
Place: North of Millbrook
Read aloud:
> The road narrows between black pines. Somewhere ahead, a wheel creaks in the wind.
Roll: Survival DC 12 - to spot goblin tracks
Fight: 3 Goblin
Map: Forest road
Balance: an easy-to-medium fight for four level 1 characters.
Box: ordinary body
Choice: they follow the tracks -> The Old Mill

## Chapter 2: The Old Mill

### The Old Mill
Read aloud:
> The mill wheel turns slowly, though there is no wind.
People: Snaggle
Fight: 1 Hobgoblin, 4 Goblin
Give: The Raven Seal, Merchant's ledger
Box: valuable chest
Level up: everyone reaches level 2 after this fight.
Side quest: the miller's daughter is missing in the woods.
If a character dies: Brenna knows a priest in town who can bring them back, for 300 gp.
`

export const AI_PROMPT = `You are helping me prepare a Dungeons & Dragons 5th edition (2014 rules) campaign for my
table. Write it in EXACTLY the format below, so my table app can read it. Use only these headings and
fields; one field per line; anything else goes in a scene's Reminders.

Format rules:
- "# Campaign: <title>" once at the top.
- "## People", then "### <name>" for each NPC, with lines: Role, Place, Attitude (friendly, warm,
  neutral, wary or hostile), Voice, Wants, Knows, Secrets.
- "## Items", then "### <name>" for each item to hand out, with lines: Key item (yes or no), Type
  (weapon, armour, potion, ring, amulet, cloak, scroll, tool or other), Rarity (common, uncommon,
  rare, very rare or legendary, or leave it out), What it is.
- "## Chapter <n>: <title>" for each chapter (one chapter per session works well).
- "### <scene title>" for each scene, with any of these lines:
  - Place: where it is.
  - Picture: and Music: a short word for the mood (Tavern, Forest, Cave, Battle).
  - Read aloud: then the text to read out, each line starting with "> ".
  - Reminders: then "- " lines for me only: what's true, what they might miss, where they can go.
  - People: the NPCs here, by name, separated by commas.
  - Roll: <skill or save> DC <number>, then "outcome hidden" if the players shouldn't learn whether they
    passed, then " - " and what it's for. One Roll line per roll.
  - Choice: <what the players do> -> <the title of the scene it leads to>.
  - Fight: <count> <monster name>, ... using monsters from the free 5e rules (SRD 5.1), by their
    exact names (Goblin, Wolf, Bugbear, Skeleton, Ogre).
  - Map: a short name for the battle map.
  - Box: <ordinary, valuable or treasure> <chest, sack, body, desk or hoard> for loot to search.
  - Give: item names from the Items list, separated by commas.
  - Balance: how hard the fight should feel for the party.
  - Checkpoint:, Level up:, Side quest:, If a character dies: for milestones, levelling up, side
    quests, and how a fallen character might be brought back.

Please write: <describe your campaign here: the story, the tone, how many sessions, the party (for
example four level 1 characters), and anything you want in it>.

Balance each fight for the party using the 2014 encounter-building rules, aim for a mix of easy,
medium and hard, and put one Level up line where the party should gain a level. Here is a short
example of the format:

`

/** The prompt with the worked example after it: what Copy for your AI copies. */
export const AI_PROMPT_WITH_EXAMPLE = `${AI_PROMPT}${CAMPAIGN_FORMAT}`
