# S1e plan: Rules for players

Written 27 October 2026, after S1d. **Waiting for Matt's approval** of decisions 64 to 71. It builds section 5 of `S1_PLAN.md` (lookups for players, decision 62, already approved) and the "Rules reference" in `SPEC.md`. The aim is to have it ready for the test one-shot on 21 to 22 November, so a first-time player can answer "what does prone do?" without stopping the game.

## In plain words

A **Rules** button on the player's table opens a panel beside the table. It explains the rules in a few plain sentences each, with the free rules' own wording underneath for anyone who wants it. It covers what your conditions do, what you can do on your turn, how dice rolls work, resting, and your class's spells. Anything you see on your own character (a condition, a spell) links straight to its explanation. You get the same panel on Screen 1.

It is all from the free rules (SRD 5.1), written in our own words. There are no book quotes, no campaign data and no server changes.

## What's already there

- The free rules' 15 conditions (with their SRD text), 18 skills and 319 spells (with level, school, casting time, range, components, duration, concentration, ritual, classes and text) are already in the app.
- The player's plate shows "Conditions: …", and spell cards in the hand already open a spell's details.
- The rest maths (`src/rules/rest.ts`) and turn order (`src/rules/turn.ts`) are already written and tested, so the panel can describe exactly what the table does.
- The row of buttons under the abilities has **Sheet**, **Items** and **Powers**, plus **Journal** and **Lore**, which are switched off until Phase 2.
- The credits page already carries the SRD 5.1 attribution.

## What's in the panel

A search box at the top searches everything ("prone", "dash", "short rest", "fire bolt"), with five sections under it:

1. **Conditions.** All 15, each in two or three plain sentences ("Prone: you're on the ground. Standing up costs half your speed. Attacks from next to you have advantage; from further away, disadvantage."), with the free rules' wording folded underneath. Exhaustion shows its six levels as a list. **Yours** come first, marked, if you have any.
2. **On your turn.** The order of a fight (initiative, then turns), then what a turn holds: your move, one action, maybe a bonus action, one free thing such as opening a door, and a reaction that comes back at the start of your turn. Then each action in a line: Attack, Cast a spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an object. Then opportunity attacks, fighting with two weapons, and grappling and shoving.
3. **Rolling dice.** The difference between checks, saves and attacks; what a DC is; advantage and disadvantage; that a natural 20 or 1 only auto-hits or auto-misses on attacks; and the 18 skills, each with its ability and an everyday example ("Athletics, Strength: climbing, swimming, jumping").
4. **Resting.** A short rest (an hour, spending hit dice), a long rest (8 hours, all hit points back, half your hit dice back, once a day), and what the table does for you when the DM calls one.
5. **Spells.** Your class's spells, with your own known or prepared spells first, filtered by level (cantrips to 9th) and searchable. Each opens the same spell details as the hand. A short "How spells work" heading explains slots, concentration, components and rituals. Non-casters see only "How spells work" (useful when the party wizard explains Fireball).

## Linking from the table

- Each condition on your plate ("Conditions: Prone, Poisoned") opens its explanation.
- So does each condition chip in the turn order during a fight.
- So does "Concentrating" on your plate.
- **?** opens and closes the panel from the keyboard, on both screens. **/** jumps to the search box while it's open.

## Hidden means hidden

Nothing changes. The panel holds only the free rules, which are the same for everyone, so it reads nothing from the campaign or the database. It never shows a monster's numbers, a DC, or anything the DM hasn't revealed.

## How it's built

- **Rules text:** `src/rules/rulesGuide.ts` holds our plain-words lines, keyed by condition, action and section, written by me from SRD 5.1 (CC-BY-4.0). No Player's Handbook text. The SRD's own wording comes from the data already loaded.
- **Search:** a small pure function over titles, plain lines and SRD text, with unit tests (for example "prone" finds Prone first; "dash" finds the action; "fire" finds Fire Bolt and Fireball).
- **Spells:** "your class" means the class (or classes) on your character. A **Show all classes' spells** tick widens it.
- **Panel:** `src/screens/rules/RulesPanel.tsx`, used on the player table and Screen 1. It's lazy-loaded, so it costs nothing until opened.
- **Free plan:** text only, already in the app; no storage, no realtime messages.
- **Tests:**
  - unit tests check that every condition and action has a plain line, that the plain lines have no em dashes, and how search ranks results;
  - preview browser tests: a player looks up prone from the button and from their plate, searches for a spell, and the DM opens Rules on Screen 1.

## Milestones (each ends with something to try)

| | What | You can try |
|---|---|---|
| **S1e-1** | The Rules button and panel: conditions, on your turn, rolling dice, resting, and search; conditions on the plate link to it | As a player, look up what prone does, then click "Prone" on your plate |
| **S1e-2** | Spells (yours first, by level, search), linking from the turn order and Concentrating, the **?** key, and the panel on Screen 1 | Find Cure Wounds as a cleric; as the DM press **?** mid-fight |

The preview routes will be `#/dev/table/rules` and `#/dev/dm/rules`. `PROGRESS.md` gets a line after each milestone.

## Decisions for Matt (recommendations first)

64. **Where the button goes:** **Rules** takes the place of the switched-off **Journal**, keeping five buttons as in the design. Journal comes back in Phase 2, when the row can grow. *Recommended.* Or a sixth, narrower button; or Rules replaces **Lore** instead.
65. **How it opens:** a panel to the right of your plate, over the edge of the scene but not darkening the table, so you can keep watching and rolling. **Esc**, **?** or the button closes it. *Recommended.* Or over the camera column on the right.
66. **Plain words first:** two or three sentences in our own words, with the free rules' wording folded underneath (**The rules' words**). *Recommended.* Or the free rules' wording only.
67. **Your own things link to it:** conditions on your plate and in the turn order, and Concentrating, open their explanation. *Recommended.*
68. **Spells shows your class's list**, your own spells first, with a tick to see every class's. *Recommended.* Or only the spells on your sheet.
69. **The DM gets the same panel** on Screen 1 (a **Rules** button by the tabs, and **?**). *Recommended.* Or players only.
70. **Rolling dice is a fifth section** (checks, saves, advantage, DCs and the 18 skills with examples), beyond the four in decision 62, because first-time players ask "which skill is that?" most. *Recommended.*
71. **The order:** S1e-1 then S1e-2, both well before the one-shot. *Recommended.*

## What stays out (for now)

- Rules beyond the free rules (feats, subclasses and backgrounds from the books). The custom content editor is where the group will add those.
- Asking Claude a rules question (the Claude panel, Phase 2).
- Monster lookups for the DM. The fight's monster cards already show what they need.
- Spell area templates and the full equipment list (the shop and Give already show gear).

## Waiting on Matt

- **Approve the plan**, or change any of decisions 64 to 71.
