# Phase 1 plan: get to the first streamed session

Written 25 October 2026 from `CLAUDE.md`, `docs/SPEC.md`, `docs/DESIGN_NOTES.md` and the 12 screens. This covers Phase 1 only. Nothing is built yet. Words in **bold** on first use are explained in the jargon list at the end.

**In one paragraph.** Phase 1 is a website hosted free on GitHub Pages that talks to one free Supabase project (database, login, live updates and file storage). It gives you: email login and a campaign with a join code; character sheets typed in by hand with the maths done for you; 3D dice and a roll log; the ask-for-a-roll flow with automatic pass or fail; your notebook and party screen; a stage with scene art, a battle map with tokens, and synced music and sound; initiative and HP tracking; cameras in the app; and the stream overlay. Nine milestones, each one something you can open in a browser and try. Scenes, NPCs, inventory cards, handouts, fog of war, the creation wizard and the Claude panel wait for Phase 2, but every screen is built in full so those buttons exist, switched off.

## 1. Project setup

### Folders

```
dnd-table/
  .github/workflows/deploy.yml   builds the site and publishes it on every push to main
  public/                        files copied as they are: dice models, icons
  src/
    app/                         routes (the #/... addresses), login state, providers
    screens/                     one folder per screen: join, player, dm, overlay, credits
    components/                  shared pieces: Panel, Parchment, Medallion, CameraColumn, Hand
    rules/
      maths/                     pure functions with tests: modifiers, checks, rests, XP
      srd/                       the SRD 5.1 data in our own slim shape, plus the loader
    live/                        Supabase client, saved-data hooks, live-update hooks
    dice/  map/  audio/          wrappers around dice-box, Konva and Howler
  scripts/import-srd.ts          fetches 5e-database's 2014 files and writes src/rules/srd/
  supabase/migrations/           every database change as a numbered SQL file
  e2e/                           the Playwright roll-flow test
  docs/                          spec, designs, this plan, PROGRESS.md
  CREDITS.md  .env.example  README.md  CLAUDE.md
```

Stack as `CLAUDE.md` says: Vite, React and TypeScript, one static page, hash routes (`/#/play`, `/#/dm`, `/#/stage`, `/#/overlay/<secret>`), Vite `base` set to `/dnd-table/`.

### Deploy to GitHub Pages

One **workflow** file. On every push to `main` it installs, runs the tests, builds the site with the two Supabase settings baked in, then publishes with GitHub's own actions (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`). It needs the Pages source set to "GitHub Actions" in the repository settings (your step A2). The live address will be `https://hellohouseline-lab.github.io/dnd-table/`. Checked today: Pages has no single-page fallback, which is why we use hash routes; sites built by a custom workflow are not subject to the 10-builds-an-hour limit.

### Environment variables

| Name | Where it lives | What it is |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | GitHub repository secret, and `.env.local` on your Mac | Your Supabase project's web address |
| `VITE_SUPABASE_ANON_KEY` | Same | The "publishable" key. Safe in a browser; the database rules do the protecting |
| Supabase command-line login | Your Mac's keychain, saved by `supabase login` | Lets the Supabase command line apply migrations. Never in the repository or a file |

`.env.local` is ignored by git. `.env.example` is committed with blank values so the names are documented. The service role key is never used anywhere in Phase 1.

### Two technical choices worth knowing

- **Login links and hash routes.** Supabase's default login flow puts a `?code=` in the address, not something after the `#`, so it does not fight our hash routes. We keep that default.
- **Libraries, checked today.** All MIT licensed and free.

| Job | Library | Version | Note |
| --- | --- | --- | --- |
| 3D dice | `@3d-dice/dice-box` | 1.1.4 (Aug 2024) | Built on BabylonJS. Its dice models must be copied into `public/`. Updated slowly, so it sits behind our own small wrapper and can be swapped |
| Battle map | `konva` + `react-konva` | 10.9.0 / 19.3.2 | Chosen over PixiJS 8.22 because dragging tokens on a 2D grid is its home ground. PixiJS can come in for weather effects in Phase 3 |
| Audio | `howler` | 2.2.4 (2023) | Not actively developed but stable and used by 1.7 million projects a week. Also behind a wrapper |
| Tests | Vitest, Playwright | current | Unit tests for the maths; one end-to-end test for the roll flow using two logged-in browsers |

## 2. Supabase

### Tables

A **table** is a spreadsheet-like list in the database. Phase 1 needs these (all with **row-level security** on).

| Table | What a row is | Who writes it |
| --- | --- | --- |
| `campaigns` | Name, party size, starting level, join code, the DM | DM |
| `campaign_members` | One person at the table: role, display name, colour, VDO.Ninja camera link, "here tonight" | Each person their own row; DM any |
| `characters` | A character sheet: abilities, HP, AC, speed, proficiencies, saves, skills, conditions, Inspiration, attacks, features and uses, spell slots, dice style, portrait, private notes | Owner; DM any |
| `roll_requests` | A DM ask: the check, plain-words line, who rolls, whether the number is shown, status | DM |
| `roll_request_secrets` | The DC for a request. Separate table so players can never read it | DM; read by the judging function |
| `rolls` | Every roll: dice values, bonus breakdown, total, natural 20 or 1, pass or fail, DM override, secret flag | Players their own, via a server function; DM any |
| `encounters` | A fight: round, whose turn, status | DM |
| `combatants` | A row in turn order: name, initiative, token, conditions, health state (Healthy, Bloodied, Near death) | DM; players roll their own initiative |
| `combatant_secrets` | Monster HP numbers, max HP and the SRD stat block snapshot | DM only, and only DM can read |
| `maps` | A battle map: image, grid size and offset | DM |
| `tokens` | A piece on a map: who or what, size, position, hidden flag, colour | DM; players their own when the toggle is on |
| `assets` | A library file: kind (scene, map, token, portrait, music, ambience, effect), name, tags, mood, stream-safe flag, credit, hotkey slot | DM; players their own portrait |
| `stage` | One row per campaign: what everyone sees now (scene image or map), scene name, track playing and when it started, ambience levels, "players move their own tokens" | DM |
| `dm_notebook` | Where we are, what happens next (checklist), key items, quick notes | DM only |
| `log_events` | The session log: rolls, damage, notes, fights, timestamped | The app, by triggers |
| `overlay_links` and `overlay_guests` | A secret code per streamer, and which guest logins it has admitted | DM creates; the app claims |

### Who can see what (the security rules)

These rules live in the database, not just in the screens, so a curious player cannot work round them.

1. You must be a member of a campaign to read anything in it.
2. Players can read: the party (including each other's HP, as the camera tiles show), roll requests, non-secret rolls, turn order with health states only, the map and tokens that are on stage now, the current scene image, audio files (needed to play them), portraits and the session log entries marked visible.
3. Players cannot read: `combatant_secrets`, `roll_request_secrets`, `dm_notebook`, hidden tokens, maps and art not currently on stage, and DM secret rolls.
4. Players can change only their own character, their own member row, their own token (when you allow it) and their own rolls.
5. The DM can read and change everything in their campaign.
6. **Secret DC.** When you keep the number hidden, the player's browser sends the dice values and bonus to a server function (a small piece of code that runs inside the database with its own rights). It reads the secret DC, decides pass or fail, saves the roll and returns the verdict. The player's screen never receives the number. When you choose to show the number, the browser can judge instantly for the animation, using the same tested maths.
7. **Overlay links.** The OBS link carries a secret code. When OBS opens it the app makes a throwaway guest login (Supabase "anonymous sign-in"), hands over the code, and the database marks that guest as allowed to watch that campaign, read-only, with the same player-level limits. No real login inside OBS, no secret key in the page.

### Live updates: what is broadcast and what is saved

| Sent as a **broadcast** (fleeting, not saved) | Saved to the database (everyone sees the change within a second) |
| --- | --- |
| Hand cursors on the map: at most 4 a second, only while moving, in-app screens only | Rolls, roll requests and verdicts |
| Pings | HP, conditions, Inspiration, death saves |
| "Dice thrown" with the values, so every screen animates the same throw | Initiative, turn order, round, whose turn |
| Sound effect pad presses, natural 20 and 1 stings | Token positions, hidden flags |
| "Your turn" and "please roll" nudges | What is on stage, the track playing and its start time, ambience levels |
| Who is online (Supabase presence) | Sheets, notebook, log, library |

Music sync works by saving "track X started at time T"; each browser plays the file locally from the right offset, so no audio goes over the call. All live traffic uses one private channel per campaign, protected by the same security rules.

### Storage buckets

A **bucket** is a folder of uploaded files. All three are private and served with **signed URLs** (temporary links). Files are cached in each browser so a 300 MB music library is downloaded once, not every session.

| Bucket | Holds | Upload | Size guidance in the app |
| --- | --- | --- | --- |
| `art` | Scene art, battle maps, chapter cards | DM | JPG or WebP, up to 8 MB; a thumbnail is made in the browser on upload (Supabase's own resizing is Pro-only) |
| `portraits` | Portraits and tokens | Each player their own, DM any | PNG, up to 2 MB |
| `audio` | Music, ambience, sound effects | DM | MP3 or OGG, up to 15 MB; a "stream-safe" tick and credit line on every file |

### Staying free (limits checked today)

500 MB database, 1 GB files, 5 GB downloads a month, 2 million live messages a month, 50 MB per upload, 200 live connections, and the project pauses after 7 days without activity. A four-hour session with five screens and four overlays uses roughly 150,000 live messages with the cursor throttle above, so about ten sessions a month fit comfortably. Browser caching is what keeps downloads under 5 GB. A tiny scheduled task in the deploy workflow reads one row every three days to keep the project awake; if it pauses anyway, you press "Restore project" in the dashboard before play. No Edge Functions are needed in Phase 1.

## 3. Rules data

**Where it comes from.** The `5e-bits/5e-database` repository named in the spec is now archived; its data moved into the `5e-bits/5e-srd-api` repository, folder `packages/5e-database/src/2014/en/` (24 files named `5e-SRD-Classes.json`, `5e-SRD-Monsters.json` and so on, about 4 MB). That folder is the 2014 SRD 5.1 data; the `2024` folder next to it is never touched.

**How it gets in.** `scripts/import-srd.ts` downloads those files from one pinned commit, keeps what Phase 1 needs, converts them into our own slim shapes and writes `src/rules/srd/*.json`, each with a header naming the source commit and licence. The output is committed, so builds are repeatable and offline. Vitest checks the import (counts, a few known entries like Goblin and Longsword). Phase 1 uses: abilities and skills, conditions, equipment (weapons, armour, gear), classes, levels and features, races and traits, spells, monsters, rules text for hover explanations. Monsters load only on DM screens. Everything sits in `src/rules/`, so a later move to the 2024 rules or Open5e is a data swap, not a rebuild.

**Credits.** A `#/credits` page, linked from the join screen footer and both DM headers, and a `CREDITS.md` in the repository, carry: the SRD 5.1 attribution statement word for word ("This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode."); the 5e-database MIT notice; game-icons.net CC BY 3.0 with each icon author used; dice-box themes (CC0); the fonts. An Open Game Licence notice is added when Open5e content arrives in Phase 2. Note: the 5e-database project labels its material as Open Game Licence; Wizards also publishes SRD 5.1 under CC-BY-4.0, which is the licence we credit, as `CLAUDE.md` asks.

## 4. Screens in build order

| Order | Screen (image) | Works in Phase 1 | Hidden or disabled until Phase 2 |
| --- | --- | --- | --- |
| 1 | Credits and a small Campaign setup form (no design; join-screen style) | Create campaign, party size, starting level, invite link and join code, attendance toggle | |
| 2 | Join (01) | Email link sign-in, campaign header, "At the table now", pick your character, VDO.Ninja link box with preview | "Forge a new character" wizard: the card shows but opens a plain "type your sheet in" form |
| 3 | Player sheet panel (06, Sheet and Powers tabs) | Full sheet typed in, every derived number calculated live, weapons picked from the SRD list so damage fills in, features with uses, spell slots, hit dice, death saves, conditions, dice style, portrait upload | Inventory grid, equipped slots, coins, drag to give (a simple "gear and attacks" list sits on the Sheet tab instead); Journal and Lore tabs |
| 4 | At the table (02) | Character plate, ability medallions, panel buttons, dice medallion and picker, hand of cards (attacks, features, quick items), "Now playing", camera column | Handout toast; Journal and Lore buttons |
| 5 | Ask for a roll (08) | The nine preset checks plus "Any other skill or save", who rolls, Easy to Very hard or custom, "Tell players the number", confirmation sentence, send | |
| 6 | Player prompt (03) and result (04) | Parchment card with bonus and secret-or-shown chip, one-click roll with advantage applied, pass, fail, natural 20 and natural 1 variants, camera chips | |
| 7 | DM results (09) | Everyone's totals, passed and failed counts, per-row override, outcome buttons (damage those who failed, half to those who passed, apply a condition, just log it), Done, play on | "Tell the passers a secret" (handouts) |
| 8 | DM Command (07) | Header with scene name and session clock, notebook (where we are, checklist, key items, quick note), Party tab with Damage or heal, Ask to roll, Rest; Log tab; verb bar: Ask for a roll, Start combat, Rest, Add a note | NPCs tab, Items and loot tab, Show an NPC, Give an item, Give item on cards, "view as player" |
| 9 | DM Stage (11) | "What everyone sees" preview, art library (Places, Moments, People) with upload, put an image on stage, switch to a battle map, music by mood, ambience sliders, sound effects pad on keys 1 to 9, players-move-their-own-tokens toggle, a one-line "Scene now" name | Tonight's scenes list, people in this scene and lower thirds, Reveal hidden areas, DM-only dashed items, Chapter title card |
| 10 | Player combat (05) and DM Encounter tab (10) | Start combat rolls monster initiative and prompts players, turn order on every screen, round counter, your-turn banner, This turn pips and End turn, grid map with tokens, movement circle from remaining speed, hands and pings, inspect card (name, art, health state), Acting now card with SRD actions, HP plus and minus, conditions, "Roll its attack in secret", Add a monster from the SRD, Next turn, End fight | Difficulty badge, Too hard? Rebalance, XP sharing, difficult terrain, fog |
| 11 | Stream overlay (12) | One 1920 by 1080 link per streamer: frame with transparent camera and chat windows, name plates with HP, turn glow, turn order panel, the stage in the centre, roll toasts and nat 20 or 1 moments, now playing, the streamer's own character card. Pieces can be switched off in the link (`?stage=0`) for anyone who wants to layer differently | Lower third (NPC names, item reveals); the 3-player quest card corner stays empty |

## 5. Milestones

Each milestone is its own branch, merged to `main` when it works, so the live site always has it. "Try it" is what you do at the end.

| # | Milestone | Try it |
| --- | --- | --- |
| 0 | **Skeleton online.** App, fonts, colours, Panel and Parchment pieces, hash routes, deploy workflow, credits page | Open the live address and see a styled "table being built" page and the credits |
| 1 | **Login and campaign.** Email links, campaign setup, join code, members, the Join screen, who is online | Log in, create the campaign, join as a player from a private browser window with the code |
| 2 | **Character sheets.** SRD import, the sheet typed in with live maths, the player plate, "players edit only their own" | Type in a Dwarf Fighter, change Strength and watch attack bonus and saves move; try to edit someone else's and fail |
| 3 | **Dice and the roll log.** 3D dice, free rolls, roll from a card or skill, advantage, nat 20 and 1 effects, the Log tab; everyone sees everyone's throw | Two browsers; roll in one, watch it land in both |
| 4 | **The roll flow.** Screens 08, 03, 04, 09 end to end, secret DC judged on the server, overrides and outcome buttons, status chips. Playwright test added here | Ask for a Constitution save from the DM screen, roll it as a player, apply damage to the failed |
| 5 | **Notebook and stage.** DM Command with notebook, party cards, damage or heal, rest, notes; DM Stage with art upload, image on stage, music, ambience, effects, now playing | Upload a tavern image and a track, press play, hear it on the player screen a second later |
| 6 | **Combat and the battle map.** Map upload with grid alignment, tokens, hands, pings, initiative, turn order, your turn, movement circle, Acting now, health states, conditions, end fight | Run a two-goblin fight across two browsers |
| 7 | **Cameras in the app.** VDO.Ninja tiles in the column on every screen, name plates, turn glow, roll chips | Two laptops with webcams see each other inside the app |
| 8 | **Stream overlay.** Overlay links, guest access, the 1920 by 1080 frame, stage mirror, toasts, own character card, an OBS scene collection file to import, audio through the overlay with "Control audio via OBS" | Add the browser source in OBS and watch a roll toast appear live |
| 9 | **Rehearsal fixes.** Keyboard shortcuts for every DM verb and effect, caching, keep-awake, whatever the test session showed | A dry run with the whole group on OBS |

**Private test one-shot:** possible after milestone 5 for a theatre-of-the-mind game, after 6 if it has a fight. Cameras are not needed for the test (use Discord video). **First stream:** after 8 and a rehearsal.

**Do the dates fit?** Honestly: mid-November (about three weeks away) is tight. It works only if the Supabase project and GitHub settings are done this week, and you try each milestone within a day or two of it landing. The build itself is not the slow part; your testing and the group's camera and OBS setup are. My estimate: milestones 0 to 6 by 15 to 20 November, so a test one-shot the weekend of 21 to 22 November is realistic, with 14 to 15 November possible for a fight-free one. First stream the weekend of 5 to 6 December fits if the test happens by 22 November and every player sets up VDO.Ninja and OBS during November, in parallel, not after.

## 6. What you do yourself

Everything with an account, a key or a password is yours to do. I will tell you when each step is needed; A and B are needed before milestone 1.

**A. GitHub (repository `hellohouseline-lab/dnd-table`, already created and public)**

1. On the repository page: **Settings**, then **Pages** in the left menu. Under **Build and deployment**, set **Source** to **GitHub Actions**. Nothing else on that page.
2. **Settings**, then **Secrets and variables**, then **Actions**. Click **New repository secret** twice, once for `VITE_SUPABASE_URL` and once for `VITE_SUPABASE_ANON_KEY`, pasting the values from B4. If you set up GitHub before Supabase, come back for this.

**B. Supabase**

1. Go to supabase.com, **Start your project**, sign in with GitHub.
2. **New project**. Project name `dnd-table`. Click **Generate a password** and save it in your password manager. Region: **West EU (London)**. Plan: **Free**. Click **Create new project** and wait about two minutes.
3. Left menu bottom, the gear icon **Project Settings**, then **General**: copy the **Project ID** (also called reference ID) into your password manager; the command line needs it once.
4. **Project Settings**, then **Data API**: copy **Project URL**. Then **API Keys**: copy the **Publishable key** (older dashboards call it the **anon** key). Never copy anything labelled **secret** or **service_role**. Paste the URL and publishable key into the two GitHub secrets (A2) and send them to Claude Code for `.env.local`.
5. **Authentication**, then **URL Configuration**. **Site URL**: `https://hellohouseline-lab.github.io/dnd-table/`. Under **Redirect URLs** click **Add URL** twice: `https://hellohouseline-lab.github.io/dnd-table/**` and `http://localhost:5173/**`.
6. **Authentication**, then **Sign In / Providers**. Keep **Email** enabled. Turn on **Allow anonymous sign-ins** (this is what lets OBS overlays watch without a login).
7. **Email sending (required before anyone else logs in).** Supabase's built-in email sends only 2 messages an hour and, by its own docs, only to your project's team members, so players' login links would never arrive. Set up your own sender: in **Project Settings**, then **Authentication**, find **SMTP Settings** (if the dashboard has moved it, search for "SMTP"), switch on **Enable Custom SMTP** and fill **Sender email**, **Sender name**, **Host**, **Port**, **Username**, **Password** from step C. Then **Authentication**, then **Rate Limits**: set **Rate limit for sending emails** to 30 an hour.
8. At milestone 1, Claude Code runs the Supabase login command on your Mac. A browser tab opens: check it says Supabase, click **Authorize**, and you're done. That lets the command line apply the migrations. No token to copy or paste.

**C. An email sender (about five minutes)**

Simplest: a Gmail **app password**. In your Google Account, **Security**, turn on **2-Step Verification**, then search the account settings for **App passwords**, name it `Supabase`, click **Create** and copy the 16-character password. In B7 use Host `smtp.gmail.com`, Port `465`, Username and Sender email your Gmail address, Password the app password. Gmail allows about 500 emails a day, far more than we need. If you would rather links come from an address at chessart.me, Resend's free tier works but needs DNS records at IONOS; say so and I will give the steps.

**D. Cameras (each player, before milestone 7)**

1. Open vdo.ninja and click **Add your Camera to OBS**.
2. Pick the camera. Set the audio source to **No Audio** (voice stays on Discord, so no echo). Click **Start**.
3. Click the link icon at the top and copy the **view link** (it looks like `https://vdo.ninja/?view=xxxxxxxx`). Paste it into the **VDO.Ninja link** box on the Join screen. Bookmark the page: the same link works every session.

**E. OBS (each streamer, milestone 8; I will write the exact steps then)**

In short: import the scene collection file the app gives you, add one **Browser** source with your personal overlay link at 1920 by 1080 on top, place everyone's VDO.Ninja view links and your own Twitch chat behind the windows, and hear game audio from one place only: either the app tab or the overlay with **Control audio via OBS** and monitoring on, never both.

**F. Decisions and checks (section 7)**

## 7. Questions before I start, and things I noticed

**Questions**

1. **Time and dates.** How many hours a week can you give to trying milestones? Do you accept the honest dates above (test one-shot 21 to 22 November, first stream 5 to 6 December), or should I plan for mid-November with a fight-free test?
2. **Email sender.** Gmail app password as in C, or Resend with a chessart.me address?
3. **Music licence.** Does your Envato Elements licence cover tracks playing on every player's channel, not only yours? Not a build blocker, but a first-stream blocker. Until confirmed, should the "stream-safe" tick default to off?
4. **Players' kit.** Does every player have OBS and a camera, and which computers (Mac or Windows)? It changes how each stream captures game audio.
5. **Voice.** Discord confirmed? The app assumes voice is outside it.
6. **Phase 1 characters.** You pick race, class and background from SRD lists and type the numbers (HP, AC, scores); the app calculates everything else. Weapons come from the SRD list. No wizard until Phase 2. Happy with that for the first session?
7. **Dice looks.** Phase 1 offers dice-box's built-in themes plus a dice colour and number colour per player. Metal, glass and stone materials come later. Fine?
8. **One overlay link, not seven.** The spec lists seven separate OBS sources; the screen design draws one combined overlay. I plan one link per streamer with switches in the address for anyone who wants pieces separately. OK?
9. **Monster names.** Should players see a monster's real name on the inspect card by default, or a name you type ("Hooded figure") until you reveal it? I plan: the token's label, which you can rename, plus health state.

**Things I noticed that you should know**

- The 5e-database repository in the spec is archived; its data lives on in `5e-srd-api`. Same files, same licence, no change to the plan.
- Supabase's built-in login email is limited to 2 an hour and to team members. Step B7 is not optional; without it the first login night fails.
- The DM screens show Phase 2 features (difficulty badge, XP sharing, scenes, NPCs, inventory, handouts, fog, difficult terrain). They are built as drawn and switched off, as `DESIGN_NOTES.md` asks, so they can be lit up in Phase 2 without redesign.
- The Join screen shows a HP, AC, gold and items card; gold and items only mean something from Phase 2, so Phase 1 shows HP, AC and level.
- Supabase image resizing needs the Pro plan, so thumbnails are made in the browser on upload. Egress (5 GB a month) is the limit to watch, which is why caching is in milestone 5, not milestone 9.
- The free project pauses after 7 days idle. The keep-awake task helps, but check the dashboard on session day.
- dice-box and Howler are stable but slowly maintained. Both sit behind thin wrappers so they can be replaced without touching the screens.
- The realtime cursor budget only works with the throttle (4 a second, while moving, in-app only). If it ever feels laggy we lower it, not raise it.

## Jargon

| Word | Plain meaning |
| --- | --- |
| Repository (repo) | The folder on GitHub holding the code, with its full history |
| Workflow (GitHub Actions) | A script GitHub runs for you on every change, here to build and publish the site |
| Hash route | An address like `/#/play`. The part after `#` never leaves the browser, so a static host can serve every screen from one file |
| Environment variable | A named setting kept outside the code, such as a web address or key |
| Table | A list in the database, like one sheet in a spreadsheet |
| Row-level security | Rules inside the database that decide, per row, who may read or change it |
| Server function | A small piece of code that runs inside the database with its own rights, so the browser cannot cheat it |
| Broadcast | A live message sent to everyone connected and then forgotten; nothing is saved |
| Bucket | A folder of uploaded files |
| Signed URL | A temporary link to a private file that expires |
| Migration | A numbered SQL file that makes one change to the database, so the schema has a history too |
| Magic link | A login email with a one-time link; no password |
| SMTP | The way email is sent; "custom SMTP" means using your own sender rather than Supabase's |
| Anonymous sign-in | A throwaway guest login with no email, used only by the OBS overlay |
| Vitest, Playwright | Test tools: Vitest checks the maths, Playwright drives real browsers through the roll flow |
