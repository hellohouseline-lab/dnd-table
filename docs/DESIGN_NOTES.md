# Design notes

The screens in `design/` were drawn after `SPEC.md`, with Matt's feedback. Where the two disagree, these notes and the screens win.

Names, numbers, characters and items in the screens are sample content. Text in square brackets, such as [Campaign name] or [Tavern scene art], is a placeholder.

## The screens

| # | Image | Source | What it shows |
| --- | --- | --- | --- |
| 1 | `png/01-PlayerJoin.png` | `PlayerJoin.dc.html` | Join: pick your character or forge a new one, see who's at the table, check your camera |
| 2 | `png/02-Main.png` | `Main.dc.html` | At the table: full-screen scene with the HUD floating over it, dice picker open |
| 3 | `png/03-PlayerRoll.png` | `PlayerRoll.dc.html` | The DM calls for a roll: the player's prompt |
| 4 | `png/04-PlayerResult.png` | `PlayerResult.dc.html` | Pass or fail (the source has pass, fail, natural 20 and natural 1 variants) |
| 5 | `png/05-PlayerCombat.png` | `PlayerCombat.dc.html` | Combat: your turn on the battle map |
| 6 | `png/06-PlayerSheet.png` | `PlayerSheet.dc.html` | Inventory cards and the sheet panel |
| 7 | `png/07-DMCommand.png` | `DMCommand.dc.html` | DM screen 1: the story notebook and the party |
| 8 | `png/08-DMRollAsk.png` | `DMRollAsk.dc.html` | DM: ask for a roll |
| 9 | `png/09-DMRollResults.png` | `DMRollResults.dc.html` | DM: the results and what happens now |
| 10 | `png/10-DMCombat.png` | `DMCombat.dc.html` | DM screen 1, Encounter tab: running a fight |
| 11 | `png/11-DMStage.png` | `DMStage.dc.html` | DM screen 2: the stage, art library and sound |
| 12 | `png/12-OBSOverlay.png` | `OBSOverlay.dc.html` | The stream overlay at 1920 × 1080 |

The roll flow runs 8, then 3, then 4, then 9: the DM asks, each player gets the prompt, rolls and sees pass or fail, and the DM gets the results to apply the outcome and play on.

## What changed from the spec

### Cameras
- Cameras are 16:9 tiles in a column down the right of every in-app screen, not a strip along the top. Player and DM Command tiles are 248 × 140; the DM Stage tiles are 200 × 113.
- Each tile has a name plate (character name, player, HP bar). The active player's tile glows gold.
- In combat the column doubles as the turn order: an initiative number on each tile, "acting now" and "next" labels, and the DM tile standing in for the monsters.
- During a roll request, each tile shows a status chip (waiting, rolled, passed, failed).

### Player screen
- The DM's scene fills the whole screen. Everything else floats over it:
  - Top left: character plate (portrait, HP, AC, speed, initiative, passive Perception), the six ability medallions, conditions and Inspiration.
  - Under that: five small panel buttons (Sheet, Items, Powers, Journal, Lore), 60 × 56 each. Each opens a large panel over the scene with matching tabs.
  - Top centre: "Now playing" and handout toasts.
  - Bottom centre: a fanned hand of small cards (96 × 136 at the table, smaller in combat) for attacks, features and quick items.
  - Bottom left: the dice medallion, labelled with the player's dice style.
  - Right: the camera column.
- This replaces the spec's "table in the middle with a right-hand drawer" layout.

### Dice
- The dice medallion pops out a picker: d4, d6, d8, d10, d12, d20 and d100, a count from 1 to 10, and a "Roll 2d20"-style button.
- Rolling from a card or a sheet entry adds the right bonuses automatically; the picker is for free rolls.

### Asking for a roll (screens 8, 3, 4, 9)
- **The DM picks a check in plain words**, for example "Constitution save: resist poison or exhaustion", then who rolls (everyone, some or one), then the difficulty.
- **Difficulty presets:** Easy 10 ("Most people manage"), Medium 15 ("A real challenge"), Hard 20, Very hard 25 ("The stuff of legend"), or a custom number.
- **"Tell players the number"** is a toggle, off by default, so the target stays secret. A sentence confirms what's about to be sent, then "Send to players".
- **The player's prompt** is a parchment card with a wax seal: the check's name, a one-line plain-English explanation of what it's for, their bonus, whether the target is secret, and one roll button.
- **The result screen** shows a rune ring around the die with a label in Cinzel Decorative:
  - Pass: spectral blue `#86D4E8`.
  - Fail: ember orange `#E07B42`.
  - Natural 20: a gold burst.
  - Natural 1: a thunder crack.
  - On checks and saves the total still decides, so a natural 20 that falls short fails, and the screen says so.
- **The DM results** list everyone with pass or fail, per-row override buttons, "What happens now?" outcome buttons (reveal something to those who passed, apply damage or a condition to those who failed, and so on), and "Done, play on".

### DM screen 1: the story notebook
- **Header:** campaign, chapter, the scene now, session time, and a button to Screen 2.
- **Left, on parchment:**
  - "Where we are": editable story text.
  - "What happens next": a checklist.
  - "Key items to collect": each item and who has it.
  - "Quick note".
- **Centre tabs:** Party, Encounter, NPCs, Items and loot, Log.
  - Party is a 2 × 2 grid of cards with HP, AC, passive Perception ("Notices 13+"), spell slots and conditions, plus "Damage or heal", "Ask to roll" and "Give item".
- **Right:** the camera column.
- **Bottom: a bar of big verb buttons.** Ask for a roll, Start combat, Show an NPC, Give an item, Rest, Add a note.
- This replaces the spec's three-panel Command layout.

### DM screen 1, Encounter tab (screen 10)
- The story column switches to the fight's context.
- **Turn order** with quick HP adjust.
- **An "Acting now" card** for the current monster, showing its SRD actions (for example Goblin: Scimitar +4 to hit, 1d6+2; Shortbow; Nimble Escape).
- **A combat actions bar.**

### DM screen 2: the stage
- **Tonight's scenes:** a list of scenes. Each lists "People in this scene", and each person is either On stage or Hidden.
  - Putting someone on stage shows their portrait in the scene and a lower third on stream.
  - This replaces the old NPC "Show" button.
- **"What everyone sees":** a live preview. DM-only items are drawn dashed and labelled "only you".
- **Controls:** Switch to battle map, Reveal hidden areas, Chapter title card, and "Players move their own tokens: on/off". That toggle replaces "lock tokens".
- **Art library tabs:**
  - Places.
  - Moments: night camp, campfire, party asleep, dawn breaks, storm rolls in, on the road, feast at the inn, lost in the fog.
  - People.
  - The art is uploaded by the DM (bought or generated elsewhere) and kept for every session. The app doesn't generate images before Phase 3.
- **Sound:**
  - Music by mood: Tavern, Travel, Tension, Combat, Boss, Camp.
  - Ambience sliders: fire crackle, crowd, rain.
  - A sound effects pad on hotkeys 1 to 9.
- **Right:** the camera column.

### Combat, player side (screen 5)
- A full-screen grid map with tokens, plus a turn banner and initiative ribbon along the top.
- **Movement circle:** a shaded circle labelled "You can reach 25 ft". Difficult terrain is hatched and labelled "costs double".
- **Inspect card:** shows only what the party knows (name, art, health state such as Healthy or Bloodied).
- **Other players:** their hands show as named cursors, and their pings show as rings.
- **"This turn" panel:** Action, Bonus action, Reaction and Movement (25 of 25 ft), plus End turn.
- **Cards that can't be used now are greyed out.** For example, a reaction card reads "On their turn".

### Inventory (screen 6)
- **Equipped slots and coins.**
- **An item grid** with rarity labels.
- **An open item card** on parchment. For example, Longsword: 1d8 slashing, versatile 1d10, +5 to hit, 3 lb, 15 gp.

### Stream overlay (screen 12)
- The layout is as in the spec, restyled to match: four player camera windows, the DM camera with turn order underneath, the stage in the centre, the streamer's own character card and a lower third along the bottom, and the Twitch chat window on the right.
- Twitch chat stays on the overlay. Every streamer has two monitors and reads chat on the second one, so there's no chat inside the app.

## Phase 1 scope note

The DM screens assume features the spec puts in Phase 2, such as scenes, NPCs and inventory. In Phase 1:
- Build the layouts in full.
- Give the DM a simple stage: put an image from the library on stage, switch to a battle map, and play music and sound.
- The story notebook (where we are, what happens next, key items, quick notes) is plain text and checklists, so include it.
- Hide or disable the buttons whose features arrive in Phase 2.

## Design tokens

### Fonts (Google Fonts)
- Headings, labels and buttons: **Cinzel** 500, 600 and 700. Labels are uppercase with 0.08 to 0.14em letter spacing.
- Big result words: **Cinzel Decorative** 700.
- Body text: **EB Garamond** 400 to 700, plus italic.

### Colours

| Use | Value |
| --- | --- |
| Page background | `#0D0A12` |
| Scene placeholder | `#1F1A27` |
| Panel fill | `rgba(16,12,20,0.88)` |
| Card and medallion fill | `#15101B` |
| Chip fill / chip border | `#1C1622` / `#3A2F38` |
| Gold rule | `#A8843C` |
| Gold accent and primary button | `#D4AF5A` (text on it `#1A1209`) |
| Light gold, highlights and numbers | `#F0D58A` |
| Text | `#EFE6D2` |
| Secondary text | `#D9CDB6`, `#BDB09A` |
| Labels | `#A99C85` |
| Parchment / ink / parchment rule | `#E9DAB8` / `#2B1D12` / `#8A6A2A` |
| Wax seal | `#8E2A22` |
| HP bar | `#B8382E` on `#3A2F38` |
| Pass, magic, pings | `#86D4E8` |
| Fail, enemies, warnings | `#E07B42` (lighter `#F2A777`) |
| Dashed placeholders, DM-only | `#5A4C5E` |

### Patterns
- **Panel:** `background: rgba(16,12,20,0.88); border: 1px solid #A8843C; box-shadow: inset 0 0 0 3px rgba(16,12,20,0.88), inset 0 0 0 4px rgba(212,175,90,0.25); border-radius: 8px;`. This gives a double gold rule.
- **Parchment:** `background: #E9DAB8; color: #2B1D12; border: 2px solid #8A6A2A; box-shadow: inset 0 0 0 7px #E9DAB8, inset 0 0 0 8px rgba(138,106,42,0.55);`, with small corner flourishes. Used for the story column, roll prompts, item cards and lower thirds.
- **Medallion:** a circular button with a gold ring and inner rule, used for dice, portraits and ability scores.
- **Active turn:** a `#D4AF5A` border plus a soft gold glow.
