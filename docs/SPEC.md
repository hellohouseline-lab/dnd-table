# Remote D&D Platform: Product Spec v0.1

> **Read with `DESIGN_NOTES.md`.** The screens in `design/` were drawn after this spec and changed some layouts. Where the two disagree, the screens and `DESIGN_NOTES.md` win.

Oct 25, 2026 · @Matt

## Vision and principles

The goal is the best remote D&D table for a first-time DM. Everything the DM needs is one click away, every player has a live character in the browser, and it all looks great on stream. It is a private tool for Matt's group: 1 DM and 3 to 4 players, each streaming to their own Twitch channel.

- **The DM's life comes first.** If a feature adds work for the DM at the table, it is wrong. Prep happens before the session; play is one click.
- **Code does the maths, the DM makes the calls, Claude helps.** Modifiers, damage, encounter difficulty and currency are calculated, never guessed. Story and rulings stay with the DM.
- **Mostly imagination.** The default view is a tabletop with dice and art, not a battle map. Maps appear when a fight or a puzzle needs them.
- **Browser only.** No installs for anyone. Players open a link and log in.
- **Free to run.** Free hosting for the app, plus one managed service on its free tier for live sync, saving and files. No servers to look after, no monthly bill.
- **Stream-ready from day one.** Every streamer gets the same overlay, with windows for everyone's camera and their own chat.
- **Fun is a feature.** Animations, sounds and a game-like interface are core, not polish.
- **Nothing is lost.** Characters, inventory, money, notes and every roll save automatically and carry between sessions.

**Must-haves for session one**

- Players see each other while they play, inside the app.
- The DM controls the table: scenes, music, sound effects, maps and roll requests.
- Players roll their own dice, and pass or fail is decided automatically against the DC, with an animation.
- Battle maps with tokens that players can move.
- Every streamer's overlay shows all the cameras and their own chat.

## Screens and roles

There are four kinds of screen, all reading from one shared game state, so a change on one shows on every other within a second.

| Screen | Who | What it is for |
| --- | --- | --- |
| DM Command (screen 1) | Matt | Running the session: party status, initiative, encounter, notes, NPCs, Claude |
| DM Stage Control (screen 2) | Matt | Controlling what players and stream see: map, scene, music, sound effects, handouts |
| Player view | Each player | Their character, hand of actions and items, dice tray, map with their token |
| Stage and overlays | Everyone, plus OBS | The shared scene, and transparent layers for each stream |

**DM dual-screen layout**

- **Screen 1, Command.** Left: party cards (HP, AC, conditions, passive Perception, spell slots). Centre: initiative and the active encounter. Right: notes, NPC quick cards and the Claude panel. A camera strip of the whole table runs along the top, and a rolling log of rolls and events along the bottom.
- **Screen 2, Stage Control.** A live preview of exactly what players and stream see, with the soundboard, music deck, scene list and handout drawer beside it. DM-only layers (hidden monsters, traps, secret doors) show here in a tint players never see.
- **Single-screen mode.** The same panels as tabs, for running from one laptop.
- **Hotkeys everywhere.** Every sound, scene and common action can sit on a keyboard shortcut, so a Stream Deck or a phone can act as a control panel.

## Rules edition and content

Build on the 2014 rules, to match Matt's 2014 Player's Handbook. The 2024 revision (now labelled 5.5e) is compatible, but it changes character creation, weapon mastery and exhaustion, and mixing the two at the table causes confusion.

- **The free rules data covers a lot.** SRD 5.1, the 2014 rules reference, is under Creative Commons (CC-BY-4.0), and the open-source 5e-database project publishes it as structured data. It includes every weapon, armour and piece of gear from the Player's Handbook, all 12 classes, 9 races, most spells, around 300 monsters, magic items and conditions.
- **What it leaves out.** Each class has one subclass, each race one subrace, and there's one background (Acolyte) and one feat (Grappler). Some spells and monsters are missing too. Open5e fills many of these gaps with openly licensed extras (more backgrounds, feats, magic items and monsters), though not the official Player's Handbook subclasses.
- **Book content lives in the private database, never in the public code.** A custom content editor lets the group type in subclasses, backgrounds, feats, spells and monsters from their own books. It's stored in Supabase behind login and visible only to the campaign, so nothing copyrighted sits in the public GitHub repository.
- **Enter only what you use.** With the SRD and Open5e loaded, the only things left to enter are book extras someone actually picks, usually a subclass. If someone chooses the Battle Master, add it once; nothing else needs typing.
- **Streaming is fine.** Playing D&D on Twitch falls under Wizards' Fan Content Policy.
- **Switching later is possible.** The rules data sits in its own layer, so moving to the 2024 rules one day means swapping data, not rebuilding the app.
- **Your own adventure.** It gets prepped as scenes (see Scenes), with the Claude app helping turn ideas into sessions.

## Campaign, login and character sheets

Players join once with an invite link, log back in with their email, and find their character exactly as they left it.

**Joining and logging in**

- **Campaign setup.** The DM names the campaign and picks the party size (3 or 4 players) and starting level. Encounter maths and the stream layout both follow it.
- **Attendance.** At the start of each session, a quick toggle marks who's playing tonight, and the encounter maths adjusts if someone can't make it.
- The DM gets an invite link plus a short join code.
- Players sign in with a magic link sent to their email (no passwords to forget), then create or claim a character.
- Players can only edit their own character; the DM can edit everything.
- A DM "view as player" toggle shows exactly what a given player sees.

**Character sheet**

- The full sheet: abilities and modifiers, proficiency bonus, saves, skills, AC, HP and temporary HP, speed, initiative, passive scores, attacks, spells and slots, features, traits, languages and proficiencies.
- Everything derived is calculated and updates instantly. Change Strength and the attack bonus, damage and carrying capacity follow.
- Trackers for hit dice, death saves, conditions, exhaustion, Inspiration, concentration and limited-use features (Rage, Channel Divinity and so on).
- Short rest and long rest buttons apply the rules (slots, hit dice, feature uses) and log what changed.
- Portrait and token upload; backstory, personality, bonds and private notes tabs.

**Creation wizard**

- Step by step: race, class, background, ability scores (standard array, point buy, or rolled with animated dice), equipment, spells.
- A plain-English explanation at every choice, so new players aren't lost.
- Manual entry for anyone bringing an existing character from elsewhere.

**Levelling up**

- The DM awards XP or milestone levels. Players get a level-up prompt and a guided wizard for HP, new features, spells and feats.

**Progress history**

- Every change is saved as a version: level-ups, items gained and lost, gold earned, HP over time.
- A character timeline shows their story so far, and any mistake can be undone.

## Inventory, money and loot

Inventory works like a card game: every item is a card you can see, drag, equip and hand to each other, and none of it is typed in by hand.

**Where the items come from**

- **Every standard item is already loaded.** All weapons, armour, adventuring gear, tools and mounts from the 2014 rules come in from the SRD data, with damage, properties, weight and cost filled in.
- **Far more magic items from Open5e.** A free, open database that also adds extra monsters, spells, feats and backgrounds from the SRD and openly licensed third-party books, imported the same way.
- **Card art without drawing.** Each card gets an icon matched to its type (sword, bow, potion, scroll) from game-icons.net, a free library of thousands of game icons, inside a rarity-coloured frame. Envato art can replace any of them.
- **The rare missing item** takes one short form, or Claude can draft it from a description.

**How cards work in play**

- **Choosing gear.** In the creation wizard, players pick their class and background starting equipment as cards. Shops and loot work the same way.
- **Finding an item.** The DM searches the item library and presses Give; the card flies into the player's inventory with a sound, on their screen and on stream.
- **Opening a card.** Click any item to flip it to full size: art, stats, description, and buttons to equip, use, drop or give.
- **Equipped slots.** Main hand, off hand and armour, plus up to 3 attuned magic items (the rules' limit).
- **Hand.** A row of cards along the bottom of the player screen for attacks, spells, features and quick items. Click to use: it rolls and spends the resource, so a potion drinks itself and a spell slot ticks down.
- **Backpack.** A grid or list with search and sorting, plus containers (a bag of holding, a chest back at camp).
- **Consumables and charges.** Potions, ammunition and wand charges count down automatically.
- **Weight and encumbrance.** Optional, off by default.
- **Currency.** Copper, silver, electrum, gold and platinum, with automatic conversion, change given on purchases, and a ledger of who paid what and when.
- **Loot and the party stash.** The DM drops loot into a shared pool, players claim items, gold splits evenly with one click, and anything unclaimed goes to the party stash.
- **Shops.** The DM opens a shop with prices; players buy and sell, and items and money move automatically.
- **Unidentified items** show as unknown until someone identifies them.

## Dice

Every roll is animated, calculated, logged and visible on stream, with big moments for natural 20s and natural 1s.

- **3D physics dice** thrown across the shared table, landing on every screen and stream.
- **Custom dice.** Each player designs their own set (colour, material such as metal, glass, stone or wood, number colour and finish), saved to their character.
- **Roll from the sheet.** Click an attack and it rolls to hit and damage with every modifier included; click a skill and it rolls the check.
- **Advantage and disadvantage.** Two d20s roll and the one that counts is highlighted.
- **Free roller** for anything else, such as 4d6 drop lowest or 8d6 for a fireball.
- **Natural 20:** a gold burst, a crowd cheer and a stream celebration. **Natural 1:** a crack effect and a comic sting. The DM can mute both for serious moments.
- **Secret rolls.** The DM rolls behind the screen, and players can roll privately to the DM.
- **Roll log.** Who rolled what, with which modifiers, the result and the time, filterable by player or session.
- **Fun stats.** Nat 20 count, luckiest and unluckiest roller per session, ready for a stream end card.
- **Physical dice (later).** Roll real dice on camera and type the result in, marked as physical in the log.

## Calling for rolls

The DM asks for a roll, players roll from a prompt on their screen, and the results come back sorted into pass and fail, ready to act on.

- **Ask anyone.** Pick a check (any skill, ability check or saving throw, such as a Constitution save), then target everyone, a few players or one.
- **Set the target.** Type the DC, the number they need to meet or beat, and choose whether players see it. Or leave it blank and decide yourself.
- **Player prompt.** A card pops up on the player's screen: "Constitution save". One click rolls with their modifier, proficiency and any advantage already applied.
- **Automatic pass or fail.** The total is checked against the DC the moment the dice land. The player gets a pass or fail animation on their screen and on stream, with extra flair for a natural 20 or 1, and the DM's panel ticks them off.
- **No DC? You call it.** Pass and Fail buttons sit beside each result, and you can override any automatic result, for example to reward good roleplay.
- **Move on.** Once everyone has rolled, a summary shows who passed and failed, and a Next button clears the prompt so play continues. Anyone who hasn't rolled gets a nudge.
- **Apply the outcome.** One click from the summary to reveal a handout or note only to those who passed, apply damage or a condition to those who failed (half damage on a successful save is handled), change an NPC's attitude, or log a clue.
- **Group checks, passives and contests.** The group check rule (the group succeeds if at least half pass), silent passive Perception or Insight, and contests such as Stealth against a monster's passive Perception.
- **Story memory.** Every check and its outcome goes into the session log, so later you can see who noticed what.

## Combat, initiative and encounter balancing

Combat is where new DMs get overwhelmed, so the platform runs the bookkeeping and the DM runs the story.

**Initiative and turns**

- One button rolls initiative for every monster and prompts each player to roll theirs.
- A turn order bar on every screen and on stream, a "your turn" banner and sound for the active player, and an "on deck" warning for whoever is next.
- Round counter, plus an optional turn timer (off by default).

**Tracking**

- Monster HP is tracked by the DM and shown to players only as a health state (Healthy, Bloodied, Near death), so the numbers stay secret.
- Conditions show as icons with durations that expire on their own.
- When a concentrating caster takes damage, the Constitution save is prompted automatically with the right DC.
- Death saves are rolled and tracked on the player's turn.
- On each monster's turn, the DM sees its attacks, special abilities and recharge or legendary actions.
- Damage applies to several targets at once (a fireball, say), with saves and halving handled.

**Encounter builder and balancing**

- Pick monsters from the SRD or your own custom list. The builder rates the fight Easy, Medium, Hard or Deadly using the 2014 DMG's XP thresholds, including the multiplier for facing several monsters at once.
- It uses the party size from campaign setup and tonight's attendance, so a missing player changes the numbers automatically.
- Plain warnings, such as: "Deadly for 3 level 2 characters. Expect someone to go down."
- Fix suggestions: swap a monster, add minions, lower HP, or add terrain that helps the party.
- A quiet mid-fight dial: if a fight goes badly, adjust monster HP within its hit dice range or hold back a reinforcement.
- After the fight, XP is awarded and split automatically, and a loot roll is offered.

## Maps

There are two kinds of map, world maps for travel and battle maps for fights, and both are prepared before the session and revealed during it.

**World map**

- Upload any image (drawn, bought or generated) and add pins for towns, dungeons and quest locations, each with notes.
- A party marker moves across the map, and fog reveals regions as they are explored.

**Battle maps**

- Upload a map image; a grid overlays it, with a quick tool to line the grid up with the art (5 ft squares).
- Tokens for characters, monsters and NPCs, sized Medium, Large, Huge and so on.
- **Live hands.** Every player's cursor shows on the map as a hand in their colour with their name, so everyone can see where people are pointing.
- **Inspect.** Click a monster or NPC token to see what the party knows: name, portrait and a health state. The DM chooses what's revealed.
- **Pings and paths.** A player pings a spot or draws the path they want to take. The DM confirms the move, or lets players move their own tokens.
- **Movement circle.** On your turn, a shaded area shows everywhere you can reach with your remaining speed. Moves past it are blocked, and the DM can lock tokens.
- **Terrain.** The DM paints difficult terrain (costs double, so the shaded area shrinks), walls, water, pits and ledges.
- **Jumps.** The app shows how far a character can jump, from the 2014 rules: a running long jump of up to their Strength score in feet, a running high jump of 3 + their Strength modifier, half each from standing.
- Fog of war: the DM reveals areas with a brush or room by room. Automatic line of sight comes later.
- Ruler and spell templates (cones, spheres, lines) that highlight which tokens are caught.
- Layers: the map itself, DM-only notes (traps, secret doors), tokens, and effects such as rain, fog, darkness and torchlight.

**Where maps come from**

- **Prep mode:** the DM builds a map library per campaign before sessions.
- **Upload:** bought battle map packs (check each pack allows streaming) or maps drawn in tools like Dungeondraft or Inkarnate.
- **Generate (phase 3):** AI images for backdrops, plus a simple dungeon generator that lays out rooms and corridors on a grid.
- **Theatre of the mind:** a scene can run on a single mood image with no grid at all.

## NPCs, handouts and assets

Everything the DM prepares lives in one searchable library per campaign, ready to drop into play.

**NPCs**

- An NPC card holds name, portrait, role, location, faction, personality, a voice note ("gravelly, slow, calls everyone friend"), what they want, what they know and their secrets.
- A linked stat block, in case they end up in a fight.
- How each NPC feels about the party, updated as the story moves.
- "Show" pushes the NPC's portrait to the stage and stream with a lower-third name card.
- A quick NPC button for when players talk to someone unplanned: name, look, quirk and voice in one click (random tables in phase 1, Claude in phase 2).

**Handouts**

- Images, letters, maps and item cards, revealed to everyone or to one player only, as a secret note.
- Players keep everything they've been handed in a journal tab.

**Asset library**

- Folders for maps, tokens, portraits, handouts, music and sound effects.
- Tags and search ("tavern", "forest", "boss").
- Upload once and reuse across scenes and sessions.

## Music and sound

The DM controls three audio channels that play in sync for every player and on every stream: music, ambience and sound effects.

- **Music.** Playlists by mood (tavern, travel, tension, combat, boss, victory) with looping and 2 to 5 second crossfades.
- **Ambience.** A separate layer under the music (rain, fire crackle, crowd chatter, cave drips), several at once.
- **Sound effects pad.** A grid of buttons (door creak, sword clash, dragon roar), each on a hotkey so a Stream Deck can fire them.
- **Volume.** The DM sets the mix; each player can turn their own volume up or down without affecting anyone else.
- **How sync works.** Audio files are stored online and preloaded before the session. When the DM presses play, every browser gets "play this track from this moment" and plays it locally, so everyone hears the same thing without audio going over the call.
- **Files.** The DM drags in MP3 or OGG files from their computer; they upload once, stay in the library, and sit behind login so licensed files can't be downloaded by the public.
- **Automatic cues (optional).** Combat starts and the combat music comes in; a nat 20 plays a fanfare; an NPC walks in with their theme.
- **Stream-safe music only.** Copyrighted music gets Twitch VODs muted or a DMCA strike. The source is Matt's Envato Elements subscription. The music will play on every player's channel, not just Matt's, so check Envato's licence covers that before the first stream. Each track gets a "stream-safe" flag so nothing risky plays by accident.

## Scenes

A scene is a one-click bundle of everything for one moment in the story, and it is the single feature that most reduces a new DM's workload.

- **What a scene holds:** a map or mood image, a music playlist, ambience, the NPCs present, handouts, an encounter if there is one, and the DM's notes and read-aloud text for that moment.
- **Prep:** each session is an ordered list of scenes, such as "Arrive at the tavern", "Bar fight", "Road to the ruins".
- **Play:** click a scene and the map changes, the music crossfades, the NPCs appear in the DM's panel and the read-aloud text shows on the Command screen.
- **Going off-script:** scenes can be optional or jumped to in any order, for when the players do something unexpected (they will).
- **Transitions:** a cinematic title card on stream, such as "Chapter 2: The Sunken Keep", with a sound sting.

## DM support

The platform remembers everything so the DM doesn't have to, and Claude is on hand for rules, ideas and improvisation.

- **Session log.** Built automatically from play: rolls, damage, defeated monsters, loot, XP, level-ups and scenes visited, all timestamped.
- **Notes.** Per session, scene and NPC, plus a quick-note hotkey during play.
- **Quest tracker.** Active, completed and failed quests with clues found. Players see their version; the DM sees the secrets.
- **Recap.** A "Previously on..." built from the last session's log, shown on stream at the start of each session.
- **Rules reference.** Searchable rules, conditions and actions in a side panel.
- **Party journal.** Shared notes for players, so they remember names and clues too.
- **Session zero and safety tools.** A session zero checklist (tone, boundaries, expectations) and a discreet X-card button a player can tap to skip content without having to explain. Standard good practice, and sensible on stream.

**Claude alongside**

- **Phase 1:** the Claude app open on the second screen. No integration needed.
- **Phase 2:** a Claude panel inside the Command screen that knows the game state (party, HP, location, NPCs, last session's log). Questions like "what would this NPC say?" or "is this fight too hard?" get answers grounded in the actual campaign. It needs an Anthropic API key: Claude Haiku 5.5 for quick lookups during play, Claude Sonnet 5.5 for prep and story help.
- **Prep assistant:** turns rough notes into scenes, NPCs and encounters, ready to drop into the library.

## Stream and OBS overlays

Each streamer adds a few browser source links to OBS once, and the overlays update themselves every session.

| Overlay | What it shows | Background |
| --- | --- | --- |
| Frame | Borders, camera name plates, turn glow, windows for cameras and chat | Transparent windows |
| Stage | The table: scene art or the live map | Solid |
| Dice | Rolls, plus nat 20 and nat 1 moments | Transparent |
| Turn order | Initiative list with the active turn highlighted | Transparent |
| My character | That streamer's own character card | Transparent |
| Lower thirds | NPC name cards, scene titles, item reveals | Transparent |
| Now playing | Current music track and its credit | Transparent |

- Each link is personal to the streamer and campaign, with a secret token in the URL, so no login is needed inside OBS.
- Built for 1920 × 1080 with safe areas, and a choice of visual themes (parchment, dark fantasy, clean).
- Audio can play through a browser source so it lands in every stream; OBS's "Control audio via OBS" option lets each streamer mix it. Each streamer should hear the game audio from one place only, or they'll get echo.

**Stream layout**

Every streamer uses the same 1920 × 1080 layout, so the show looks consistent whichever channel a viewer is watching.

Layout, as drawn in `design/png/12-OBSOverlay.png`: a 3 × 3 grid at 1920 × 1080 (columns 400px, flexible, 400px; rows 224px, flexible, 224px).

- Left column: player camera window (top), DM camera window above the turn order panel (middle), player camera window (bottom).
- Centre: the stage (scene art or battle map) spanning the top two rows, with roll toasts and "now playing" on top. Below it, the streamer's own character card and a lower third (NPC name, scene title, item reveal).
- Right column: player camera window (top), Twitch chat window (middle), player camera window (bottom).
- Camera and chat windows are transparent cut-outs in the frame; each streamer puts the real sources behind them in OBS.

- The frame is one browser source sitting on top in OBS, with clear windows cut out. Each streamer places everyone's cameras and their own Twitch chat behind those windows once.
- Each camera window has a name plate with character name, class and HP, and glows when it's that player's turn.
- The layout follows the party size from campaign setup. With 3 players, the spare corner shows the current quest card.
- A ready-made OBS scene collection file to import, so every streamer's layout matches in one step.
- The table in the middle is the Stage overlay; dice, lower thirds and the character card sit on top of it.

**Video feeds**

- Everyone joins a Discord call for voice.
- Each player gets a personal VDO.Ninja camera link (free). The same links feed two places: the camera strip inside the app, so everyone sees each other while playing, and the camera windows in each streamer's OBS layout.
- The app doesn't do any video work itself; it just shows those links, which keeps it simple and free.
- Each streamer shows their own Twitch chat in the chat window. A combined chat from all channels in one feed is a later extra.

**Twitch extras (later)**

- Chat commands (!party, !hp), chat polls for side decisions, and channel points that trigger small effects the DM approves, such as a cheer sound or a blessing.

## Player UX

The player screen should look like a fun tabletop with a game HUD around it: a table in the middle where dice land and scenes appear, and your stats always on screen.

**Layout**

- **Top: everyone's faces.** A strip of live cameras for the whole table, each with the character's name and HP. In combat it doubles as the turn order, sorted by initiative, with a glow on whoever's turn it is.
- **Centre: the table.** Most of the time it shows scene art on a tabletop surface (theatre of the mind), switching to a battle map when a fight or a puzzle needs one.
- **Left:** your portrait, HP bar, AC, conditions and Inspiration, always visible.
- **Bottom:** your hand of cards for attacks, spells, features and quick items, cycled with the scroll wheel or Q and E.
- **Right:** a drawer with inventory, full sheet, journal and handouts tabs.
- **Bottom right:** your dice tray, in your custom dice.

**Moments that make it feel like a game**

- A "your turn" banner, sound and glow. Cards you can't use right now (no slot left, bonus action spent) grey out.
- Action, bonus action, reaction and movement shown as pips that empty as you use them.
- Animated reveals for new items, level-ups and handouts.
- Hover any rules term for a plain-English explanation.

**Accessibility**

- Readable type, colour-blind-safe rarity and condition colours, and full keyboard shortcuts.

## Tech approach and hosting

The app is a static website on a free host, with one managed service (Supabase, free plan) handling live sync, logins, saving and file storage. Running it should cost nothing.

Architecture summary:

- Every browser (the DM's two screens, each player, and every OBS browser source) loads the static app once from GitHub Pages.
- After that, each one talks only to Supabase: Realtime channels for live state, Postgres with row-level security for saved data, Auth for magic-link login, Storage for maps, art and audio.
- Cameras are VDO.Ninja links embedded in the app and added to OBS. Voice is a Discord call, outside the app.
- The optional Claude panel calls a Supabase Edge Function that holds the Anthropic API key; the key never reaches a browser.
- IONOS is only needed for the optional DNS record (for example dnd.chessart.me) pointing at GitHub Pages.

The app files come from the free host once; after that, every screen talks only to Supabase, and only the optional Claude panel reaches beyond it.

- **Hosting the app.** GitHub Pages, with a public code repository. That's free and fine here: the code holds only the free SRD rules data, never secrets, licensed music or book content. Railway and IONOS aren't needed, since nothing here runs a server.
- **Your own address (optional).** A subdomain such as dnd.chessart.me is one DNS record in IONOS pointing at the host. The host's own free address works fine until then.
- **Live sync, logins, saving and files: Supabase free plan.** Realtime broadcasts moves, rolls and audio cues; the database stores campaigns, characters, custom content and logs; Auth handles magic-link login; Storage holds maps, tokens and audio behind login. The free plan includes 1 GB of file storage, 5 GB of downloads a month and 2 million realtime messages, plenty for one group if files are cached in each browser.
- **The one catch.** Free Supabase projects pause after a week with no activity. Prepping during the week keeps it awake; if it does pause between sessions, restore it from the Supabase dashboard before you start.
- **Rendering.** Maps on PixiJS or Konva, dice with an existing 3D dice library such as dice-box, audio with Howler.js. All free and open source.
- **Rules data.** SRD 5.1 from 5e-database, plus extra open content from the free Open5e API, imported once and bundled with the app with the required credits (CC-BY-4.0 and Open Game Licence notices). Item icons from game-icons.net (CC BY 3.0, credited).
- **Data model.** Campaign (party size, starting level), Member, Character, CharacterVersion, Item, InventoryEntry, Ledger, Map, Token, Terrain, Scene, Session, Attendance, NPC, Encounter, Combatant, CheckRequest, CheckResult, AudioAsset, Playlist, Handout, Roll, LogEvent, Quest, Note.
- **Security.** Database rules so players can only edit their own character and only see what the DM has revealed. Overlay links use secret tokens.
- **Claude.** The Claude app on the second screen costs nothing extra. An in-app Claude panel needs a paid API key, so it stays optional.
- **How it gets built.** Claude Code, working from this spec one phase at a time: Claude Fable 5.1 to plan the architecture, Claude Opus 5.5 for the build.

## Build phases

Build in three phases, and only start the next once the group has actually played with the last.

| Phase | Goal | Estimate | Contents | Gate before the next phase |
| --- | --- | --- | --- | --- |
| 1: Session one | Run the first stream | About 3 to 4 weeks | Campaign setup and email login; character sheets with auto maths (typed in by hand); custom 3D dice and roll log; roll requests with automatic pass or fail; maps with tokens, live hands and movement; initiative and HP tracking; synced music, ambience and sound effects; cameras in the app and on stream | First session streamed |
| 2: Campaign | Run a long campaign easily | About 4 to 6 more weeks | Creation and level-up wizards; inventory cards, money and loot; encounter builder and balancing; scenes, NPCs and handouts; terrain, jumps and fog of war; spell templates and ruler; session log, recaps and quests; Claude panel (optional) | A full story arc played |
| 3: Extras | Polish and fun extras | Ongoing | Map and dungeon generation; combined chat across channels; Twitch chat commands and channel points; overlay themes and editor; phone soundboard remote; automatic line of sight; physical dice mode; session stats end card | Only if it adds fun |

Phase 1 is deliberately lean: characters are typed in by hand and maps are uploaded, so the first session comes sooner. The rough plan is a private test one-shot (no stream) around week 3, then the first streamed session once the rough edges are fixed. Counting from today, that's a test game in mid-November and a first stream in early December. These are estimates: the slow part is testing with real people, not writing code.

## Decisions and open questions

The big decisions are made; a few small ones are left before Claude Code starts on phase 1.

| Question | Decision |
| --- | --- |
| Rules | 2014, to match Matt's books, with SRD 5.1 data |
| Game data | SRD 5.1 plus Open5e, imported automatically; no manual entry for items |
| Book content | Only extras someone picks, typed in privately, never in the public code |
| First adventure | Matt's own idea, prepped as scenes |
| Party size | 3 or 4, chosen at campaign setup |
| Seeing each other | VDO.Ninja camera links, shown in the app and on stream |
| Streaming | Everyone streams to their own channel |
| Name | None needed: it's a private tool |
| Hosting | Public GitHub repository on GitHub Pages, plus the Supabase free plan |
| Music and sound | Envato Elements |
| Dice | Digital, customised per player; physical dice later |
| Build approach | From scratch, using free open-source parts |

**Still open**

- [ ] How many hours a week can Matt put in? It sets the real timeline.
- [ ] Target dates: a test one-shot in mid-November and the first stream in early December?
- [ ] Check that Envato's licence covers the music playing on every player's channel.
- [ ] Does every player already have OBS and a camera set up?
- [ ] Discord for voice, or another call app?

## Sources

- [D&D Beyond: SRD 5.2 under Creative Commons, SRD 5.2.1 update and the 5.5e label](https://www.dndbeyond.com/posts/1949-you-can-now-publish-your-own-creations-using-the)
- [Dungeon Mister: Wizards of the Coast's 2026 D&D roadmap](https://dungeonmister.com/news/wizards-of-the-coast-unveils-dds-2026-roadmap)
- [5e-database-sqlite on PyPI: 5e-database's 2014 and 2024 SRD data and licences](https://pypi.org/project/5e-database-sqlite/)
- [Open5e: free, open-source 5e content from the SRD and other open-licensed sources](https://open5e.com/)
- [Game-icons.net: free game icons under CC BY 3.0](https://game-icons.net/about.html)
- [Supabase pricing: free plan limits and the inactivity pause](https://supabase.com/pricing)
- [GitHub Docs: which plans can use GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
