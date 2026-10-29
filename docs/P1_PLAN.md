# P1 plan: spells for players, the DM plays the monsters, voices and scene fades

Written 28 October 2026 from Matt's notes after a test session. **Approved 29 October** with decisions 84 to 95 as recommended. **P1a and P1b are built** (see the notes under sections 1, 3 and 4). The two bugs from the same notes are already fixed and live: sound effects (each table keeps its own sounds; **Bring them in** copies another table's) and music playing in two tables' tabs at once.

## In plain words

1. **Spells for players.** The Powers tab on a player's sheet gets a spellbook: every spell of their class at every level, cantrips to 9th, with a search box, whether or not they can cast it yet. They add and remove their own spells there, mark which are prepared, and change their spell slots.
2. **The DM plays the monsters like a player.** On the Battle screen, a **Play as the monsters** switch gives the acting monster the player's layout: its turn (action, bonus action, reaction, movement), its attacks and abilities as cards along the bottom, click a card then a target, and move its miniature on the map.
3. **Turn players' voices up as well as down.** The volume on each player's camera tile is always shown, not only on hover, and goes above 100% for a quiet microphone.
4. **Scenes fade for the players.** When the picture on stage changes, it fades through on every player's screen (and on the stream overlay when it exists), and the music fades across too.

## 1. Spells for players (Powers tab)

**What's there:**
- The Powers tab shows the spells a character already has, by level, and their slots as ticks.
- Spells are added on **Edit character**.
- The Rules panel can search every spell, but nothing can be added from there.

**What's new:**
- **A spellbook** under Spellcasting:
  - a search box (name or words in the spell);
  - level tabs (Cantrips, 1st to 9th, All);
  - "Your class's spells" or "Every class's spells".
  - Each spell opens to its full text from the free rules, with its casting time, range and components.
- **Adding and removing:**
  - each spell has **Add to my spells** or **Remove**;
  - prepared casters (cleric, druid, paladin, wizard) get **Prepared** on each spell;
  - the counts show beside the title ("Prepared 4 of 5", "Known 3 of 4"). Going over isn't blocked, because the DM may allow it, but it shows in red.
  - Spells above your level show "You can cast this from level 5" and can still be added, for planning ahead (decision 85).
- **Spell slots:**
  - each level's slots get − and + for how many you have (a ring or a DM's gift), as well as the ticks for how many are used;
  - a **Reset to my class** link puts them back;
  - the DM sees and can change the same (decision 86).
- **Who can change it:** players change only their own sheet; the DM can change anyone's. Nothing new on the server: the same character rules as now.
- **Built (P1b):** slots change behind **Change how many slots**, so the usual ticks stay simple. A spell added above your level comes in unprepared.

## 2. The DM plays the monsters like a player

**What's there:**
- The Battle screen's **Acting now** card lists a monster's attacks and abilities; click one, then its target.
- Movement is free for the DM, and the turn pips show what's used.

**What's new:**
- **A Play as the monsters switch** on the Battle screen, with the **M** key (decision 87). When it's on and a monster is acting, the screen shows:
  - **its turn** like a player's "This turn" panel: Action, Bonus action, Reaction and Movement, then Dash, Disengage, Dodge, Hide, End turn (which is **Next turn**);
  - **its cards along the bottom**, like a player's hand: each attack, each ability with a save (Frightful Presence, Acid Breath), its legendary actions and its bonus actions (a goblin's Nimble Escape). Click a card, then a target on the map or in the turn order. Saves roll for each target as they do now.
  - **its movement counted** like a player's: "25 of 30 ft". Moving past its speed asks "Move anyway?", so you can still overrule it (decision 88).
  - **its hit points, AC and conditions** in a small panel, as a player sees their own.
- **On characters' turns** the screen is the usual Battle screen.
- **Groups of the same monster** (three goblins) each get their own turn as now. A **Same for the rest** button repeats the last attack for the next goblin, which saves clicks (decision 89).
- **Players see nothing new:** monsters' numbers stay behind the screen.

## 3. Voices: always-visible volume, and a boost

**What's there:** a slider on each player's camera tile, shown on hover, from silent to 100%, remembered per browser.

**What's new:**
- **The slider always shows** under each tile as a thin bar, with the percentage (decision 90).
- **It goes up to 200%** for a quiet microphone (decision 91). VDO.Ninja, which carries the voices, only plays a voice up to 100% inside its own frame. I'll check what it allows before building:
  - **(a)** If it can boost inside its frame, the slider goes to 200%.
  - **(b)** If not, each player gets a **My microphone** level on their own tile, from 50% to 200%, which changes how loud they are for everyone.
  - The plan is (a) if possible, otherwise (b).
  - **Built as (b):** VDO.Ninja's code caps a voice at 100% where it's heard (a volume over 1 is even read as a percentage), but its sending link's `audiogain` can go to 200%. So each person has **Your microphone, for everyone** on their own tile, from 50% to 200%.
- **Still only for you:** it only changes what you hear, unless it's (b).

## 4. Scenes fade through

**What's there:** a new picture replaces the old one at once. Music changes straight away.

**What's new:**
- **The picture:** when the stage picture changes (Go here, or picking one on Screen 2), the old one fades out as the new one fades in, over about a second and a half, on every player's screen and yours (decision 92).
- **The music:** when Go here changes the music, the old track fades out and the new one fades in over two seconds (decision 93).
- **Maps:** a battle map going up or down fades the same way.
- **Read-aloud and NPC cards:** these already slide in and keep doing so.

## Hidden means hidden

Nothing here sends anything new to players. The spellbook is the free rules plus your own sheet. Monster cards and numbers stay on the DM's screen, as now.

## Milestones

| | What | You can try |
|---|---|---|
| **P1a** | Scene fades (picture and music), voices always visible with the boost | Go here between two scenes with a player watching; turn a quiet player up |
| **P1b** | The spellbook on the Powers tab, prepared spells, slots | A player searches "fire", adds Burning Hands, prepares it, adds a slot |
| **P1c** | Play as the monsters | Run a goblin's turn from the cards: move, Scimitar on a target, Nimble Escape, End turn |

## Decisions for Matt (recommendations first)

84. **The order:** P1a first (small and visible on the night), then P1b, then P1c (the biggest). *Recommended.*
85. **The spellbook shows every level and lets players add spells above their level for planning,** marked "from level N". *Recommended.* Or only spells they can cast now.
86. **Slots can be changed by the player as well as the DM,** with Reset to my class. *Recommended.* Or only the DM changes how many slots there are.
87. **Play as the monsters is a switch on the Battle screen, key M** (M already mutes your microphone, so Matt chose **P**), remembered while the fight lasts. *Recommended.* Or a separate monsters screen.
88. **A monster's movement counts like a player's,** with "Move anyway?" past its speed. *Recommended.* Or the DM moves freely, as now.
89. **Same for the rest** repeats the last attack for the next monster of the same kind. *Recommended.* Or leave it out.
90. **Voice sliders always show under each camera.** *Recommended.* Or keep them on hover.
91. **Boost up to 200%:** inside the frame if VDO.Ninja allows, otherwise a player's own microphone level. *Recommended.*
92. **Pictures fade over about a second and a half.** *Recommended.* Or quicker (half a second) or slower (three seconds).
93. **Music crossfades over two seconds on Go here.** *Recommended.* Or music changes straight away.
94. **"Move all their spell slots about":** I've read this as changing how many slots they have and how many are used. If you meant something else, such as casting a spell with a higher slot, that's already there when casting. Tell me and I'll change the plan.
95. **The overlay:** the fade is built so the stream overlay uses it later. *Recommended.*

## Waiting on Matt

- **Approve the plan**, or change any of decisions 84 to 95.
