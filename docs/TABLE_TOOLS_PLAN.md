# The table's tools: the plan after C1b

Written 26 October 2026, from Matt's notes after testing C1b. **Nothing here is built yet; it waits for Matt's approval.** The bugs from that test are already fixed and live (see `PROGRESS.md`). This plan covers the bigger ideas, fits them around the character builder (C2) and story mode (S1) already planned in `COMBAT_PLAN.md`, and keeps the dates in view: the test one-shot on 21 to 22 November and the first stream on 5 to 6 December.

The rule behind all of it, in Matt's words: **as little as possible for players or the DM to update by hand.** The table keeps the sheets up to date as things happen and flags what someone needs to decide.

## 1. Cards that explain themselves (players)

**The problem:** clicking Club or Rage just does it. Players can't see what a card does, what they'll roll, or undo it.

**The fix:** clicking a card opens a small panel at the side of the screen (left, above the hand, so the map and cameras stay clear):

- **What it does, in plain words:** "Melee attack, +5 to hit, 1d6+3 bludgeoning, reach 5 ft", or for Rage "Bonus action. For 1 minute: advantage on Strength checks and saves, +2 damage on Strength melee attacks, resistance to bludgeoning, piercing and slashing. 2 of 3 uses left." The SRD's full text sits under **More**.
- **What it costs:** action, bonus action or reaction, with the turn's pips, so you can see it's free before you use it.
- **What happens next:** "Pick a target" (the range band shows), "Put the area on the map", or for Rage a single **Rage** button.
- **Confirm, then roll.** The dice only go once you press the button, and **Undo** sits in the panel straight after.

Features change the sheet themselves where the rules are clear: Rage marks you Raging and adds its resistances and damage; Second Wind heals; Action Surge gives the action back; uses come off and return on the right rest. The panel says "This changes your sheet: ..." so nothing happens silently.

The same panel lists your **bonus actions and reactions** (Cunning Action, Healing Word, Shield, opportunity attacks), so nobody forgets they have them.

## 2. The Party tab for the DM

**Quick checks, no pop-up.** Across the top of the Party tab:

- **Nine buttons:** Perception, Investigation, Insight, Stealth, Athletics, Persuasion, Dexterity save, Constitution save, Wisdom save.
- **Difficulty:** Easy (10), Medium (15), Hard (20), or a number. These are the SRD's typical DCs.
- A tick box on each party card (all ticked by default), then **Roll**.

The result shows on each card, and the old Ask for a roll stays for anything else (secret DCs, any skill).

**Party cards that tell you things:**

- **Always shown:** hit points with temporary hit points, AC, conditions (Prone, Poisoned) with what they do on hover, concentration, spell slots left as pips, exhaustion, inspiration, and death saves when at 0.
- **In a fight:** their action, bonus action, reaction and movement left.
- **Under the name:** class and level, race, background and alignment.
- **Click to open (an accordion):**
  - cantrips and spells, with what each does;
  - features and traits, with uses;
  - what they're wearing and carrying (armour, rings, the items from section 3);
  - backstory: age, height, weight, eyes, skin, hair, goals and bonds.

The character builder (C2) asks for the backstory details, so they're there from the start.

## 3. Money, items and loot

**A wallet on every sheet:** copper, silver, electrum, gold and platinum. The DM's **Give gold** (to one, or split across the party) and spending in shops update it, and change is made for you.

**An inventory on every sheet:** SRD equipment with weight, what's worn or held, magic items with attunement, and anything typed in. **Give an item** (on Screen 1) works, and so does handing an item to another player.

**Searching and loot.** When a player searches a chest, a cupboard or a body:

1. The DM clicks **Search**, picks the place (indoors, outdoors, dungeon, a body) and how rich it is (junk, ordinary, valuable, treasure).
2. The player rolls Investigation (or Perception for something hidden).
3. The table works out what they find. A failed roll finds the junk or nothing; a good roll finds the real thing; a great one, something extra.
4. The DM sees the finds first and can swap anything before **Give**. Key story items you've placed in a scene always turn up where you put them.

The free rules don't include the DMG's treasure tables, so the loot tables are ours, written for this table (a cracked lantern, 3 copper pieces, a bent spoon, a silver ring worth 10 gp). You can edit them. **Locks and traps** use the same idea: a lock with a DC, opened with thieves' tools (a Dexterity check with the tools' proficiency) or forced with Athletics.

## 4. NPCs and shops

**The NPCs tab on Screen 1:**

- people with a portrait, a role, how they talk, what they want and how they feel about the party;
- **Show an NPC**, which puts them on stage for everyone;
- a quick **random NPC** (name, look, quirk) for when the players talk to someone you didn't plan for.

**Shopkeepers:**

- **Kinds of shop:** a general store, a blacksmith (weapons and armour), an alchemist (potions, oil, acid), a jeweller, a fletcher, or a pop-up merchant with a few survival things.
- **Stock** comes from the SRD equipment list at its real prices, with how many of each and a mark-up you set.
- **When you open a shop,** players browse it on their own screen and buy or sell from their wallet. You see each sale and can undo it.
- **Work that takes time,** such as upgrading or repairing a weapon, is an order with a price and "ready in 3 days". It shows on Screen 1 as a reminder when the day comes.

## 5. The story on Screen 1, and lookups for players

**Your campaign in the table.** Story mode (S1 in `COMBAT_PLAN.md`) fills Screen 1: chapters and scenes, read-aloud text, places, NPCs, key items, planned rolls and fights, each with **Go here**.

You can give me your starter campaign, and I'll build the importer around it. Paste the text and the table splits it into scenes for you to tidy. One rule matters here: **if it's from a published book, its text lives only in the table's private database, never in the code.** The importer is how it gets in.

**Lookups for players:** a **Rules** button on the table screen with:

- the spells their class can learn (SRD), with search;
- what conditions do;
- what you can do on your turn, and the order of a fight;
- how resting works.

It's short, in plain words, and opens beside the table (not over it).

## 6. Order of work (recommended)

| When | What | Why first |
|---|---|---|
| 27 Oct to 30 Oct | **T1. Cards and the Party tab** (sections 1 and 2) | You both felt these in the test, and they make every session smoother |
| 31 Oct to 6 Nov | **C2. Character builder**, now with backstory details, the wallet and starting gear in the inventory | Players need characters for the one-shot |
| 7 Nov to 12 Nov | **I1. Items, loot and shops** (sections 3 and 4, shops and NPCs in their simplest form) | Searching and buying come up in any one-shot |
| 13 Nov to 18 Nov | **S1. Story mode and the importer**, with your starter campaign, plus the player lookups | So the one-shot runs from Screen 1 |
| 19 to 20 Nov | Fixes, and a dry run | |
| 21 to 22 Nov | **Test one-shot** | |
| After | C3 lite (Talk cards, two weapons, Hide and Search), the stream overlay (milestone 8), rehearsal | Before the first stream on 5 to 6 December |

This pushes C3 lite after the one-shot. That's the price of adding items and shops before it. If you'd rather keep C3 lite first, items and shops move to after the one-shot instead.

## 7. Decisions for Matt (recommendations first)

22. **Where does a card's panel open?** On the left, above the hand, so the map and cameras stay clear.
23. **Which nine quick checks?** Perception, Investigation, Insight, Stealth, Athletics, Persuasion, Dexterity save, Constitution save and Wisdom save. You can change them later.
24. **Features change the sheet themselves (Rage, Second Wind, Action Surge)?** Yes, with Undo, and the panel says what changed.
25. **Shops:** do players buy on their own screen while you have the shop open? Yes, with each sale showing to you, and Undo.
26. **Loot:** our own tables, by place and richness, that you can edit, with your key items always found where you put them? Yes.
27. **Your campaign:** paste it in through the importer, with any published text kept only in the private database? Yes. Send me the campaign when you're ready, and say whether it's your own writing or from a book.
28. **The order** in section 6: T1, C2, I1, S1, then the one-shot, with C3 lite after it?

## What stays out (for now)

- The DMG's own treasure, magic item and NPC tables, which aren't in the free rules. Ours stand in.
- Crafting rules beyond "an order that's ready in N days".
- Encumbrance beyond showing the weight carried against what they can carry.
