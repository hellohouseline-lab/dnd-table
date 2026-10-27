// The shorter layout Paste your notes also reads (People, Items, "## Chapter" and "### scene"
// headings, Roll:, Choice: and Fight: lines), for the tests.

export const SHORT_LAYOUT = `# Campaign: The Ember Road

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
