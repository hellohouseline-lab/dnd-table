# S1: story mode

Written after I1. **Waiting for Matt's approval.** It builds section 4b of `COMBAT_PLAN.md` (story mode), section 5 of `TABLE_TOOLS_PLAN.md` (your campaign on Screen 1, and lookups for players) and the NPCs tab that decision 48 moved here. The test one-shot on 21 to 22 November is the target: by then you should be able to run it from Screen 1, scene by scene.

## In plain words

Your adventure lives in the table, split into chapters and scenes. On Screen 1 you see where the party is, what to read out, what they might miss, who's there, and the rolls and fights you planned. **Go here** on a scene changes everything at once: the picture and music on stage, the read-aloud in front of you, and buttons for that scene's rolls, people and fight. When the players wander off, jump to any scene, or carry on without one.

You can type scenes in, or paste your notes and let the table split them up for you to tidy.

## What's already there

- **The notebook** on Screen 1: where we are, what happens next, key items and who has them, a quick note.
- **The stage** on Screen 2: the picture or battle map everyone sees, music, ambience and sound effects, and your library of uploads.
- **Ask for a roll**, with a secret DC if you like, and you rule pass or fail.
- **Start combat**, with monsters from the free rules and a map from the library.
- **Give**, **Open a box** and **Shops**.
- **The log** of rolls, damage, gifts and notes.

Story mode ties these together. It doesn't replace them.

## 1. Chapters and scenes, and Go here (S1a)

**A Story tab on Screen 1**, first in the row, and where Screen 1 opens out of a fight (decision 55). On the left, the chapters and their scenes; the current one marked **Where we are**. On the right, the scene itself:

- its title and place;
- **Read aloud**, on parchment, big enough to read from;
- **Reminders** for you: where they can go next, what they might miss, what's true but unsaid;
- its **picture**, **music** and **ambience**, from your library.

**Go here** on any scene, one click:

- puts its picture on stage and plays its music and ambience (crossfading);
- sets the scene name players see;
- marks it Where we are, and notes it in the log;
- shows its read-aloud and reminders.

**Making scenes:** **New chapter**, **New scene**, drag to reorder, and every part editable where it sits. **Show the read-aloud** puts the text on stage as parchment for everyone, for the times you'd rather they read it (decision 56); otherwise it stays yours to read out.

## 2. What happens in a scene (S1b)

Each scene can carry what you've planned, as buttons:

- **Planned rolls:** "Perception, DC 13, secret" opens Ask for a roll already filled in (who, what, how hard, whether they see the number). One click sends it.
- **Tell players the outcome** (decision 57): a new tick in Ask for a roll, on by default. Untick it and players see only "You rolled 14", never whether they passed; you see Passed or Failed. The verdict stays on the server, so it can't leak.
- **Roll behind the screen** (decision 58): for the rare roll they shouldn't see at all (did they notice the assassin?), you throw it for them with their bonus, and only you see it.
- **Choices:** "If they take the mill road: The Old Mill" as a link that jumps there.
- **Things here:** items or a box to give, a key item, or a shop to open, each one click.
- **A fight ready to start:** its monsters and its map, so **Start combat** opens already filled in.

## 3. People: the NPCs tab (S1c)

The **NPCs** tab on Screen 1 (greyed out today) comes to life:

- **People** with a portrait (from your library), a role ("innkeeper"), where they are, how they talk ("gravelly, calls everyone friend"), what they want, what they know, their secrets, and how they feel about the party (friendly to hostile, a click to change).
- **In a scene:** each scene lists who's there; their cards show beside the read-aloud.
- **Show an NPC** (the bottom button, greyed out today): their portrait goes on stage with a name card, for everyone (decision 59). **Hide** takes it down.
- **Make someone up** (decision 60): for when players talk to someone you didn't plan. A name, a look, a quirk and a voice in one click, from our own tables (no book text), with **Keep them** to save.
- **Shopkeepers** link to their shop, so you can open it from the person.

Everything about an NPC is yours alone until you show them, and even then players see only the portrait and name.

## 4. Getting your campaign in (S1d)

**Paste your notes** (decision 61): paste plain text or Markdown and the table splits it:

- into **chapters** at top headings ("# Chapter 1" or "Chapter 1: ..."),
- into **scenes** at smaller headings or numbered lines ("## The Tavern", "3. The road north"),
- **read-aloud** from boxed text, quotes or lines marked "Read aloud:",
- everything else into **reminders**.

You see the result before saving, and tidy anything after. Pictures, music, rolls, people and fights are added by hand (a click each). If it's a published book, its text lives only in your private database, never in the code (decision 27). **Send me your starter campaign** and I'll tune the splitting to it.

## 5. Lookups for players (S1e)

A **Rules** button on the players' table screen, opening beside the table, not over it (decision 62):

- **Spells** your class can learn, with search, from the free rules;
- **Conditions** in plain words (what poisoned or prone does to you);
- **On your turn:** move, an action, a bonus action, a reaction, and what each can be;
- **Resting:** short and long rests, and hit dice.

Short, plain, and only from the free rules.

## Hidden means hidden

- Chapters, scenes, read-aloud, reminders, planned rolls and DCs, choices and fights are yours alone (row-level security: only the DM can read them).
- NPCs and their secrets are yours alone; showing one sends only the portrait and name to the stage.
- With **Tell players the outcome** off, pass or fail is never sent to players' browsers.
- A roll behind the screen is never shown to players.
- Read-aloud reaches players only if you press **Show the read-aloud**.

## How it's built

- **Data:** new tables for chapters, scenes (with their parts), NPCs and scene links, all DM-only with row-level security; the stage gains a shown NPC and shown read-aloud; roll requests gain "tell the outcome".
- **Server:** `go_to_scene` (stage, scene name, Where we are and the log in one step), the outcome kept server-side when hidden, rolls behind the screen, showing and hiding an NPC.
- **Rules (with unit tests):** splitting pasted notes into chapters and scenes; the random NPC tables.
- **Free plan:** text only, small; pictures and music come from the library you already have.

## Milestones (each ends with something to try)

| | What | You can try |
|---|---|---|
| **S1a** | The Story tab, chapters and scenes, Go here (stage, music, scene name, log), read-aloud and reminders, Show the read-aloud | Make two scenes, give each a picture and music, and Go here between them |
| **S1b** | Planned rolls, Tell players the outcome, Roll behind the screen, choices, things here, a fight ready to start | A secret Perception check from a scene button; a fight that starts in one click |
| **S1c** | The NPCs tab, people in scenes, Show an NPC, Make someone up, shopkeepers | Make the innkeeper, show her on stage, then make someone up |
| **S1d** | Paste your notes, with a preview before saving | Paste your one-shot and walk it |
| **S1e** | The Rules button for players | As a player, look up what prone does |

Each milestone gets a preview with made-up data, browser tests and a line in `PROGRESS.md`. If you send your campaign early, S1d moves up so you can paste it in sooner.

## Decisions for Matt (recommendations first)

55. **Screen 1 opens on the Story tab** out of a fight; Party, Items and the rest stay as tabs beside it, and a fight still switches to Encounter. *Recommended.* Or keep Party first.
56. **Read-aloud is yours to read out**, with **Show the read-aloud** to put it on stage for everyone when you'd rather. *Recommended.* Or always show it to players.
57. **Tell players the outcome**, on by default, can be turned off per roll so players see only their total. *Recommended.* Or always tell them.
58. **Roll behind the screen**, for the rare roll players shouldn't see. *Recommended.* Or leave it out.
59. **Show an NPC** puts their portrait and name card on stage for everyone (and on the stream overlay later). *Recommended.*
60. **Make someone up** from our own tables of names, looks, quirks and voices. *Recommended.* Or leave it for the Claude panel in Phase 2.
61. **Paste your notes** splits at headings, takes boxed text and quotes as read-aloud, and shows you before saving. *Recommended.*
62. **A Rules button for players** with spells, conditions, turns and rests, from the free rules only. *Recommended.*
63. **The order** S1a, S1b, S1c, S1d, S1e, with the paste import moving up if your campaign arrives first. *Recommended.*

## What stays out (for now)

- PDF import, and the Claude prep assistant (Phase 2).
- Handouts to one player and the players' journal; quests; the "Previously on" recap built from the log.
- Chapter title cards on the stream (with the overlay, milestone 8).

## Waiting on Matt

- **Approve the plan**, or change any of decisions 55 to 63.
- **Send your starter campaign** (paste it in chat, or tell me where the file is), and say whether it's your own writing or from a published book.
