# C2: the character builder

Written 26 October 2026. **Nothing here is built yet; it waits for Matt's approval.** It expands section 4 of `COMBAT_PLAN.md` with the additions from `TABLE_TOOLS_PLAN.md` (backstory, wallet, starting gear), and keeps the test one-shot on 21 to 22 November in view.

## In plain words

A first-time player opens **Make a character** and is walked through it one step at a time, with the maths done for them and nothing they can get wrong. At the end their sheet, their hand of cards, their armour class, their gear and their money are all ready to play. The DM can also make a ready-made character and hand it to a player, which is often the kindest start for someone new.

The full form stays for editing a character later, and for characters brought from somewhere else.

## The steps

On the left, the steps with ticks as each is done. In the middle, the choices as big cards. On the right, the character as it takes shape: scores, hit points, AC, skills and the hand of cards, updating as you choose. Every choice has a short line in plain words ("Dwarves are tough and hard to poison"); hold the mouse on a card for 2 seconds for the full rules, as in the hand.

1. **Race** (and subrace where there is one): ability bonuses, speed, size, languages and traits filled in. The SRD has nine races with one subrace each.
2. **Class:** hit die, saving throws, armour and weapon proficiencies, level 1 features. Skill choices limited to the class's number (a rogue picks four from its list).
3. **Background:** its two skills, tools or languages, and its feature. The SRD has one (Acolyte); **Something else** lets the player name their own and pick two skills.
4. **Ability scores,** four ways:
   - **Standard array:** drag 15, 14, 13, 12, 10 and 8 onto the abilities.
   - **Point buy:** 27 points with the 2014 costs and a live counter.
   - **Roll:** 4d6, drop the lowest, six times, thrown by the server with the 3D dice so the table sees them (no rerolling in secret).
   - **Random but balanced:** the standard array dealt for you.

   Each offers **Suggest for a Wizard**: the class's main ability gets the best score, then Constitution. Racial bonuses are added on top and shown separately.
5. **Level** (if the DM has set one above 1): for each level, hit points (the average, or roll the hit die), the new features, an ability score increase at level 4, and the subclass at level 3 (the SRD has one per class).
6. **Starting gear:** the class's choices as cards ("Chain mail, or leather armour, a longbow and 20 arrows") plus the background's kit.
   - Armour and a shield set the AC by themselves; weapons become attack cards; arrows and bolts are counted.
   - Or **take the gold instead** (the class's starting gold, rolled) and buy from a list of SRD equipment at its real prices.
   - Above level 1 the free rules have no gear-by-level tables, so the character gets level 1 gear plus the gold the DM sets.
7. **Spells** for casters: how many cantrips and spells the class table allows, from a list filtered by class and level, one click to add. A wizard's spellbook and a cleric's prepared spells are explained in one line each.
8. **Who they are:** name, alignment (nine cards with one line each), age, height, weight, eyes, skin, hair, personality traits, ideals, bonds, flaws, goals and a backstory box. All optional except the name. The portrait upload is here too.
9. **Review and save:** the whole sheet, with anything missing pointed out ("You haven't picked your second skill").

## Money and gear on the sheet

Starting gear needs somewhere to go, so C2 adds the simple parts of I1:

- **A wallet:** copper, silver, electrum, gold and platinum, shown on the sheet and the party card.
- **An inventory:** each item with how many, its weight, and whether it's worn or held. Armour worn sets the AC; a weapon held is in the hand of cards. Items typed in by hand work too.

Shops, loot, giving items and the DM's **Give gold** stay in I1.

## The DM's side

- **Starting level and gold** for the table, on the campaign settings (level 1 and the class's gold unless changed).
- **Ready-made characters:** the DM runs the same builder, then **Give to a player**, who sees it as theirs.
- **New characters** appear on the Party tab with a "New" tag; the DM can open and edit them as now.

## What the free rules include, honestly

Nine races, twelve classes with one subclass each, one background (Acolyte), and SRD equipment and spells. Anything from the Player's Handbook (another background, subclass or race) is typed in by the player with its own name and text. It's saved in the private database only, never in this public repo, as the project rules require.

## How it's built

- **Data:** the importer adds armour (AC, Dexterity cap, Strength needed, stealth disadvantage), adventuring gear, packs, the classes' starting equipment and choices, backgrounds' equipment, and starting gold, from the same 2014 5e-database commit.
- **Rules as pure functions with tests** (`src/rules/build/`): point buy costs and limits, the standard array, 4d6 drop lowest, racial bonuses, hit points by level (average or rolled), AC from armour and shield (light, medium with the Dexterity cap, heavy), carrying capacity, skill choice limits, spells known and prepared counts, and what a level adds.
- **Server:** a migration adds the wallet, inventory and backstory columns to `characters`, with the same row-level security (players edit only their own; the DM edits all). The rolled scores are thrown by the server like any roll. A `give_character` function lets the DM hand a ready-made character to a player.
- **Screens:** a new `src/screens/builder/` with one component per step and the live summary. The builder saves a draft as you go, so closing the tab loses nothing.
- **Tests:** Vitest for every rule above and the importer; a Playwright preview test that builds a level 1 dwarf fighter and a level 3 elf wizard end to end without signing in.

## Milestones (each ends with something to try)

| When | Milestone | Try it |
|---|---|---|
| 27 to 28 Oct | **C2a.** Data import and the rules functions, with tests | Nothing to see; the numbers are checked |
| 29 to 31 Oct | **C2b.** Steps 1 to 4 (race, class, background, scores) and the live summary | Build the start of a character |
| 1 to 3 Nov | **C2c.** Gear, wallet and inventory; AC from armour | Pick a kit and see the AC and hand change |
| 4 to 6 Nov | **C2d.** Spells, levels above 1, who they are, review and save | Make a level 3 wizard ready to play |
| 7 to 8 Nov | **C2e.** The DM's starting level and gold, ready-made characters, Party tab tags | Make one as the DM and give it to a player |

That leaves two weeks before the one-shot for I1, S1 and fixes, as in `TABLE_TOOLS_PLAN.md`.

## Decisions for Matt (recommendations first)

29. **Ability score methods:** all four, with the DM able to switch any off for the table (some tables forbid rolling). *Recommended.* Or only standard array and point buy.
30. **Rolled scores:** thrown by the server with the 3D dice, seen by the table and logged, one set per character. *Recommended,* so nobody rerolls quietly. Or rolled privately in the player's browser.
31. **Hit points when levelling:** the average by default, with a Roll button. *Recommended.* Or always roll.
32. **Wallet and inventory in C2** (the simple parts: coins, items, worn and held). *Recommended,* so starting gear has somewhere to go. Or keep gear as a text list until I1.
33. **Ready-made characters** the DM can give to a player. *Recommended* for first-time players. Or players always build their own.
34. **The one-shot's level:** the builder handles levels 1 to 5 (one subclass, one ability score increase). *Recommended.* Or level 1 only for now.
35. **A mock-up first?** There's no screen design for the builder. I can build step 1 in the table's look for you to react to before the rest. *Recommended.* Or build it all and adjust after.
