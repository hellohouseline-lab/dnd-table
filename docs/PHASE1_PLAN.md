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
    dice/  map/  audio/          wrappers around dice-box-threejs, Konva and Howler
  scripts/import-srd.ts          fetches 5e-database's 2014 files and writes src/rules/srd/
  supabase/migrations/           every database change as a numbered SQL file
  e2e/                           the Playwright roll-flow test
  docs/                          spec, designs, this plan, PROGRESS.md
  CREDITS.md  .env.example  README.md  CLAUDE.md
```

Stack as `CLAUDE.md` says: Vite, React and TypeScript, one static page, hash routes (`/#/play`, `/#/dm`, `/#/stage`, `/#/overlay/<secret>`), Vite `base` set to `/dnd-table/`.

### Deploy to GitHub Pages

One **workflow** file. On every push to `main` it installs, runs the tests, builds the site with the two Supabase settings baked in, then publishes with GitHub's own actions (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`). It needs the Pages source set to "GitHub Actions" in the repository settings (your step A1). The live address will be `https://hellohouseline-lab.github.io/dnd-table/`. Checked today: Pages has no single-page fallback, which is why we use hash routes; sites built by a custom workflow are not subject to the 10-builds-an-hour limit.

### Environment variables

| Name | Where it lives | What it is |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | GitHub repository secret, and `.env.local` on your Mac | Your Supabase project's web address |
| `VITE_SUPABASE_ANON_KEY` | Same | The "publishable" key. Safe in a browser; the database rules do the protecting |
| Supabase command-line login | Your Mac's keychain, saved by `supabase login` | Lets the Supabase command line apply migrations. Never in the repository or a file |

`.env.local` is ignored by git. `.env.example` is committed with blank values so the names are documented. The service role key is never used anywhere in Phase 1.

### Two technical choices worth knowing

- **Login links and hash routes.** (Corrected in milestone 1.) Supabase's browser default is the "implicit" flow, which puts the login after the `#` where our screens live. We keep it, because unlike the `?code=` (PKCE) flow it works whichever browser opens the email, and the app reads the login first, then tidies the address and opens the right screen.
- **Libraries, checked today.** All MIT licensed and free.

| Job | Library | Version | Note |
| --- | --- | --- | --- |
| 3D dice | `@3d-dice/dice-box-threejs` | 0.0.12 (Oct 2022) | **Changed in milestone 3.** The planned `@3d-dice/dice-box` 1.1.4 can't make dice land on a number decided beforehand, so each screen would show different faces. Its three.js sibling from the same project can, so the server throws the numbers and every screen animates the same result. MIT, about 140 KB zipped, loaded only on the table screens, behind our own wrapper (`src/dice/diceTray.ts`). Metal and stone textures are drawn by our own code; none of the library's images or sounds are used |
| Battle map | `konva` + `react-konva` | 10.9.0 / 19.3.2 | Chosen over PixiJS 8.22: dragging tokens on a 2D grid is its home ground |
| Audio | `howler` | 2.2.4 (2023) | Stable, hugely used, no longer actively developed; also behind a wrapper |
| Tests | Vitest, Playwright | current | Unit tests for the maths; one end-to-end test of the roll flow with two logged-in browsers |

## 2. Supabase

### Tables

A **table** is a spreadsheet-like list in the database. Phase 1 needs these (all with **row-level security** on).

| Table | What a row is | Who writes it |
| --- | --- | --- |
| `campaigns` | Name, party size, starting level, join code, the DM, a camera password | DM |
| `campaign_members` | One person at the table: role, display name, colour, camera address (made by the app for VDO.Ninja), "here tonight" | Each person their own row; DM any |
| `characters` | A character sheet: abilities, HP, AC, speed, proficiencies, saves, skills, conditions, Inspiration, attacks, features and uses, spell slots, dice style, portrait, private notes | Owner; DM any |
| `roll_requests` | A DM ask: the check, plain-words line, who rolls, whether the number is shown, status | DM |
| `roll_request_secrets` | The DC for a request. Separate table so players can never read it | DM; read by the judging function |
| `rolls` | Every roll: dice values, bonus breakdown, total, natural 20 or 1, pass or fail, DM override, secret flag | Players their own, via a server function; DM any |
| `encounters` | A fight: round, whose turn, status | DM |
| `combatants` | A row in turn order: shown name ("Unknown creature" until you reveal a monster), initiative, token, conditions, health state (Healthy, Bloodied, Near death) | DM; players roll their own initiative |
| `combatant_secrets` | A monster's real name until revealed, HP numbers, max HP and the SRD stat block snapshot | DM only, and only DM can read |
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
2. Players can read: the party (including each other's HP, as the camera tiles show), roll requests, non-secret rolls, turn order with health states only (and "Unknown creature" for any monster you haven't revealed), the map and tokens that are on stage now, the current scene image, audio files (needed to play them), portraits and the session log entries marked visible.
3. Players cannot read: `combatant_secrets`, `roll_request_secrets`, `dm_notebook`, hidden tokens, maps and art not currently on stage, and DM secret rolls.
4. Players can change only their own character, their own member row, their own token (when you allow it) and their own rolls.
5. The DM can read and change everything in their campaign.
6. **Secret DC.** The player's browser sends the bonus to a server function, which throws the d20 itself (since milestone 3 the server throws every die), reads the DC from the DM-only table, decides pass or fail, saves the roll and returns only the verdict. The DC never reaches a player's browser unless you show the number.
7. **Overlay links.** The OBS link carries a secret code. The app makes a throwaway guest login (Supabase anonymous sign-in), hands over the code, and the database lets that guest watch the campaign read-only, with player-level limits. No real login inside OBS.

### Live updates: what is broadcast and what is saved

| Sent as a **broadcast** (fleeting, not saved) | Saved to the database (everyone sees the change within a second) |
| --- | --- |
| Hand cursors on the map: at most 4 a second, only while moving, in-app screens only | Rolls, roll requests and verdicts |
| Pings | HP, conditions, Inspiration, death saves |
| (Dice throws are not broadcast after all: since milestone 3 every screen animates the saved roll as it arrives, so secret rolls reach only the roller and the DM, by the database's rules) | Initiative, turn order, round, whose turn |
| Sound effect pad presses, natural 20 and 1 stings | Token positions, hidden flags |
| "Your turn" and "please roll" nudges | What is on stage, the track playing and its start time, ambience levels |
| Who is online, and who is in the call, muted or with their camera off (Supabase presence) | Sheets, notebook, log, library |

Music sync works by saving "track X started at time T"; each browser plays the file locally from the right offset, so no audio goes over the call. All live traffic uses one private channel per campaign, protected by the same security rules.

### Storage buckets

A **bucket** is a folder of uploaded files. All three are private and served with **signed URLs** (temporary links). Files are cached in each browser so a 300 MB music library is downloaded once, not every session.

| Bucket | Holds | Upload | Size guidance in the app |
| --- | --- | --- | --- |
| `art` | Scene art, battle maps, chapter cards | DM | JPG or WebP, up to 8 MB; a thumbnail is made in the browser on upload (Supabase's own resizing is Pro-only) |
| `portraits` | Portraits and tokens | Each player their own, DM any | PNG, up to 2 MB |
| `audio` | Music, ambience, sound effects | DM | MP3 or OGG, up to 15 MB; a "stream-safe" tick and credit line on every file |

### Staying free (limits checked today)

500 MB database, 1 GB files, 5 GB downloads a month, 2 million live messages a month, 50 MB per upload, and the project pauses after 7 days idle. With the cursor throttle, a four-hour session uses roughly 150,000 live messages, so ten sessions a month fit. Browser caching keeps downloads under 5 GB. A small scheduled task reads one row every three days to keep the project awake; if it pauses anyway, press "Restore project" in the dashboard before play. No Edge Functions are needed in Phase 1.

## 3. Rules data

**Where it comes from.** The `5e-bits/5e-database` repository named in the spec is now archived; its data moved into the `5e-bits/5e-srd-api` repository, folder `packages/5e-database/src/2014/en/` (24 files named `5e-SRD-Classes.json`, `5e-SRD-Monsters.json` and so on, about 4 MB). That folder is the 2014 SRD 5.1 data; the `2024` folder next to it is never touched.

**How it gets in.** `scripts/import-srd.ts` downloads those files from one pinned commit, keeps what Phase 1 needs (abilities and skills, conditions, equipment, classes, levels and features, races and traits, spells, monsters, rules text for hover explanations), converts them into our own slim shapes and writes `src/rules/srd/*.json`, each with a header naming the source commit and licence. The output is committed, so builds are repeatable, and Vitest checks it (counts and known entries such as Goblin and Longsword). Monsters load only on DM screens. Because it all sits in `src/rules/`, a later move to the 2024 rules or Open5e is a data swap, not a rebuild.

**Credits.** A `#/credits` page, linked from the join screen footer and both DM headers, and a `CREDITS.md` in the repository, carry: the SRD 5.1 attribution statement word for word ("This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode."); the 5e-database MIT notice; game-icons.net CC BY 3.0 with each icon author used; the dice library (dice-box-threejs, three.js and cannon-es, all MIT); the fonts. An Open Game Licence notice is added when Open5e content arrives in Phase 2. Note: the 5e-database project labels its material as Open Game Licence; Wizards also publishes SRD 5.1 under CC-BY-4.0, which is the licence we credit, as `CLAUDE.md` asks.

## 4. Screens in build order

| Order | Screen (image) | Works in Phase 1 | Hidden or disabled until Phase 2 |
| --- | --- | --- | --- |
| 1 | Credits and a small Campaign setup form (no design; join-screen style) | Create campaign, party size, starting level, invite link and join code, attendance toggle | |
| 2 | Join (01) | Email link sign-in, campaign header, "At the table now", pick your character, camera check (preview, camera and microphone pickers, Join voice and camera) | "Forge a new character" wizard: the card shows but opens a plain "type your sheet in" form |
| 3 | Player sheet panel (06, Sheet and Powers tabs) | Full sheet typed in, every derived number calculated live, weapons picked from the SRD list so damage fills in, features with uses, spell slots, hit dice, death saves, conditions, dice style, portrait upload | Inventory grid, equipped slots, coins, drag to give (a simple "gear and attacks" list sits on the Sheet tab instead); Journal and Lore tabs |
| 4 | At the table (02) | Character plate, ability medallions, panel buttons, dice medallion and picker, hand of cards (attacks, features, quick items), "Now playing", camera column | Handout toast; Journal and Lore buttons |
| 5 | Ask for a roll (08) | The nine preset checks plus "Any other skill or save", who rolls, Easy to Very hard or custom, "Tell players the number", confirmation sentence, send | |
| 6 | Player prompt (03) and result (04) | Parchment card with bonus and secret-or-shown chip, one-click roll with advantage applied, pass, fail, natural 20 and natural 1 variants, camera chips | |
| 7 | DM results (09) | Everyone's totals, passed and failed counts, per-row override, outcome buttons (damage those who failed, half to those who passed, apply a condition, just log it), Done, play on | "Tell the passers a secret" (handouts) |
| 8 | DM Command (07) | Header with scene name and session clock, notebook (where we are, checklist, key items, quick note), Party tab with Damage or heal, Ask to roll, Rest; Log tab; verb bar: Ask for a roll, Start combat, Rest, Add a note | NPCs tab, Items and loot tab, Show an NPC, Give an item, Give item on cards, "view as player" |
| 9 | DM Stage (11) | "What everyone sees" preview, art library (Places, Moments, People) with upload, put an image on stage, switch to a battle map, music by mood, ambience sliders, sound effects pad on keys 1 to 9, players-move-their-own-tokens toggle, a one-line "Scene now" name | Tonight's scenes list, people in this scene and lower thirds, Reveal hidden areas, DM-only dashed items, Chapter title card |
| 10 | Player combat (05) and DM Encounter tab (10) | Start combat rolls monster initiative and prompts players, turn order on every screen, round counter, your-turn banner, This turn pips and End turn, grid map with tokens, movement circle from remaining speed, hands and pings, inspect card (shown name, token picture, health state), Acting now card with SRD actions, HP plus and minus, conditions, "Roll its attack in secret", Add a monster from the SRD, Reveal name (players see "Unknown creature" until you click it), Next turn, End fight | Difficulty badge, Too hard? Rebalance, XP sharing, difficult terrain, fog |
| 11 | Stream overlay (12) | One 1920 by 1080 link per streamer: frame with everyone's cameras in it and a transparent chat window, name plates with HP, turn glow, turn order panel, the stage in the centre, roll toasts and nat 20 or 1 moments, now playing, the streamer's own character card. Pieces can be switched off in the link (`?stage=0`) for anyone who wants to layer differently | Lower third (NPC names, item reveals); the 3-player quest card corner stays empty |

## 5. Milestones

Each milestone is its own branch, merged to `main` when it works, so the live site always has it. "Try it" is what you do at the end.

| # | Milestone | Try it |
| --- | --- | --- |
| 0 | **Skeleton online.** App, fonts, colours, Panel and Parchment pieces, hash routes, deploy workflow, credits page | Open the live address and see a styled "table being built" page and the credits |
| 1 | **Login and campaign.** Email links, campaign setup, join code, members, the Join screen, who is online | Log in, create the campaign, join as a player from a private browser window with the code |
| 2 | **Character sheets.** SRD import, the sheet typed in with live maths, the player plate, "players edit only their own" | Type in a Dwarf Fighter, change Strength and watch attack bonus and saves move; try to edit someone else's and fail |
| 3 | **Dice and the roll log.** 3D dice with metal, glass and stone materials as well as colours, free rolls, roll from a card or skill, advantage, nat 20 and 1 effects, the Log tab; everyone sees everyone's throw | Two browsers; pick glass dice in one, roll, watch them land in both |
| 4 | **The roll flow.** Screens 08, 03, 04, 09 end to end, secret DC judged on the server, overrides and outcome buttons, status chips. Playwright test added here | Ask for a Constitution save from the DM screen, roll it as a player, apply damage to the failed |
| 5 | **Notebook and stage.** DM Command with notebook, party cards, damage or heal, rest, notes; DM Stage with art upload, image on stage, music, ambience, effects, now playing | Upload a tavern image and a track, press play, hear it on the player screen a second later |
| 6 | **Combat and the battle map.** Map upload with grid alignment, tokens, hands, pings, initiative, turn order, your turn, movement circle, Acting now, health states, hidden monster names, conditions, end fight | Run a two-goblin fight across two browsers; the player sees "Unknown creature" until you click Reveal name |
| 7 | **Cameras and voice in the app.** VDO.Ninja built in (decided 26 October): Join voice and camera, the camera check on the Join screen, live camera tiles on every screen with the name plates, turn glow and roll chips, mute, camera off and volume. Details in section 8 | Two computers with webcams see and hear each other in sync |
| 8 | **Stream overlay.** Overlay links, guest access, the 1920 by 1080 frame with everyone's cameras in it, stage mirror, toasts, own character card, an OBS scene collection file to import, voices and game audio through the overlay with "Control audio via OBS" | Add the browser source in OBS and watch a roll toast appear live |
| 9 | **Rehearsal fixes.** Keyboard shortcuts for every DM verb and effect, caching, keep-awake, whatever the test session showed | A dry run with the whole group on OBS |

**Private test one-shot:** possible after milestone 5 for a theatre-of-the-mind game, after 6 if it has a fight. Milestone 7 should land before it, so the test can use the app's own voice and cameras; Stream Together is the fallback. **First stream:** after 8 and a rehearsal.

**Do the dates fit?** Honestly: mid-November (three weeks away) is tight. It needs the Supabase and GitHub settings done this week and each milestone tried within a day or two of landing. The build is not the slow part; your testing and the group's camera and OBS setup are. My estimate: milestones 0 to 6 by 15 to 20 November, so a test one-shot on 21 to 22 November is realistic, with 14 to 15 November possible for a fight-free one. A first stream on 5 to 6 December fits if the test happens by 22 November and every player sets up VDO.Ninja and OBS during November, in parallel.

**Agreed on 25 October:** test one-shot with a fight on 21 to 22 November, first stream on 5 to 6 December, with 3 to 6 hours a week from you for trying milestones. The dice materials add a day or two to milestone 3; if that puts the test date at risk, I'll ask before moving anything.

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
5. **Authentication**, then **URL Configuration**. **Site URL**: `https://hellohouseline-lab.github.io/dnd-table/`. Under **Redirect URLs** click **Add URL** twice: `https://hellohouseline-lab.github.io/dnd-table/**` and `http://localhost:5180/**`.
6. **Authentication**, then **Sign In / Providers**. Keep **Email** enabled. Turn on **Allow anonymous sign-ins** (this is what lets OBS overlays watch without a login).
7. **Email sending (required before anyone else logs in).** Supabase's built-in email sends only 2 messages an hour and, by its own docs, only to your project's team members, so players' login links would never arrive. Set up your own sender: in **Project Settings**, then **Authentication**, find **SMTP Settings** (if the dashboard has moved it, search for "SMTP"), switch on **Enable Custom SMTP** and fill **Sender email**, **Sender name**, **Host**, **Port**, **Username**, **Password** from step C. Then **Authentication**, then **Rate Limits**: set **Rate limit for sending emails** to 30 an hour.
8. At milestone 1, Claude Code runs the Supabase login command on your Mac. A browser tab opens: check it says Supabase, click **Authorize**, and you're done. That lets the command line apply the migrations. No token to copy or paste.

**C. An email sender (about five minutes)**

Simplest: a Gmail **app password**. In your Google Account, **Security**, turn on **2-Step Verification**, then search the settings for **App passwords**, name it `Supabase`, click **Create** and copy the 16-character password. In B7 use Host `smtp.gmail.com`, Port `465`, Username and Sender email your Gmail address, Password the app password. (Chosen on 25 October.)

**D. Voice and cameras (whole group, before the test one-shot)**

Decided on 26 October: VDO.Ninja for voice and cameras together, built into the app (section 8). Nobody needs a VDO.Ninja link or account. Before the test one-shot, ask everyone to:

1. Run a speed test at speedtest.net and send you the **Upload** number. About 12 Mbps or more is comfortable while streaming. Pass on anyone's number under 10 and I'll add the relay switch for them.
2. Use **headphones**, so their microphone doesn't pick up everyone else's voices.
3. Use **Chrome** or **Edge** for the table.
4. On Windows, close other apps that use the camera (Teams, Zoom, the Camera app) before pressing **Join voice and camera**.

**E. OBS (each streamer, milestone 8; I will write the exact steps then)**

Your group streams from a mix of Macs and Windows PCs, so the steps will cover both. In short: import the scene collection file the app gives you, add one **Browser** source with your overlay link at 1920 by 1080 on top, the overlay shows everyone's cameras itself, so only your own Twitch chat goes behind its window, and hear game audio from one place only, the app tab or the overlay, never both.

**F. Decisions.** All nine questions were answered on 25 October; see section 7.

## 7. Your answers (25 October), and things I noticed

**Answers**

1. **Time and dates.** 3 to 6 hours a week. Test one-shot with a fight on 21 to 22 November, first stream on 5 to 6 December.
2. **Email sender.** Gmail app password (step C).
3. **Music licence.** Your Envato Elements licence covers music on every player's channel, so the "stream-safe" tick starts on for Envato tracks.
4. **Players' kit.** Everyone has OBS and a camera. The group is a mix of Macs and Windows PCs, so the OBS audio steps cover both.
5. **Voice.** Decided on 26 October: VDO.Ninja for voice and cameras together, built into the app (section 8). Your group knows Twitch Stream Together, whose camera links work in OBS, but Twitch won't let its pages be shown inside another website, so it couldn't fill the camera tiles.
6. **Phase 1 characters.** Typed in by hand, with race, class and background from SRD lists. The wizard waits for Phase 2.
7. **Dice looks.** Metal, glass and stone materials in Phase 1, built in milestone 3.
8. **Overlay.** One link per streamer, with switches in the address to turn pieces off.
9. **Monster names.** Hidden until revealed. Players see "Unknown creature" until you click Reveal name. The real name is kept in the DM-only table, so it never reaches players' browsers early.

**Things I noticed that you should know**

- The 5e-database repository in the spec is archived; its data lives on in `5e-srd-api`. Same files, same licence, no change to the plan.
- Supabase's built-in login email is limited to 2 an hour and to team members. Step B7 is not optional; without it the first login night fails.
- The screens show several Phase 2 features (difficulty badge, XP sharing, scenes, NPCs, inventory, handouts, fog, difficult terrain, the gold and items on the Join card). They are built as drawn and switched off, as `DESIGN_NOTES.md` asks.
- Supabase image resizing needs the Pro plan, so thumbnails are made in the browser on upload. Egress (5 GB a month) is the limit to watch, which is why caching is in milestone 5, not milestone 9.
- The free project pauses after 7 days idle. The keep-awake task helps, but check the dashboard on session day.
- The dice library and Howler are stable but slowly maintained. Both sit behind thin wrappers so they can be replaced without touching the screens.
- The realtime cursor budget only works with the throttle (4 a second, while moving, in-app only). If it ever feels laggy we lower it, not raise it.

## 8. Milestone 7 in detail: cameras and voice (planned 26 October)

**Built on 26 October** as planned below, without the talking ring (Matt said no). The relay switch waits for the upload check in step D. Also built here: **Check my camera** on the Join screen, and in a fight the camera column in turn order with the acting tile glowing and "acting now" and "next" on the plates (design 05).

**The decision (26 October).** Voice and cameras both go through VDO.Ninja, built into the app. Discord's video can't be shown inside the app. Twitch Stream Together's camera links work in everyone's OBS, which is how your group has used it, but Twitch stops its pages being shown inside any other website (checked on 26 October: every twitch.tv page, the dashboard included, tells the browser "only show me on Twitch"), so those links can't fill the camera tiles. VDO.Ninja's can, and the same feeds go into the overlay in milestone 8. VDO.Ninja is free, open source and run on donations; if it's ever down on a session night, the app still works without cameras and Stream Together is the fallback for that night.

**What you'll see**

1. **No links to copy.** The app makes each person a private camera address, and the table a camera password, at random. Nobody visits vdo.ninja, makes an account or pastes anything.
2. **The camera box on the Join screen (design 01).** Your camera in the preview, a **Camera** and a **Microphone** picker, a bar that moves when you speak, and **Join voice and camera**. The line under the preview reads "Voice and camera · Connected" once you're in. The design says "VDO.Ninja link" there; it's renamed because there is no link to paste.
3. **Nothing turns on by itself.** Your camera and microphone start only when you press **Join voice and camera** (the browser asks permission the first time). Then they stay on while the table is open, through every screen, until you press **Leave the call** or close the tab. The same click turns the table's sound on.
4. **Camera tiles on every screen** (player and DM Command 248 × 140, Stage 200 × 113). Each live camera fills its tile behind the name plate, HP bar, turn glow, roll chips and initiative badges that are already there. Your own tile shows your camera straight from your computer, mirrored, with no delay. Someone who hasn't joined shows their portrait and "Not in the call"; camera off shows their portrait and "Camera off"; a crossed-out microphone on the name plate means muted.
5. **Your controls.** On your own tile: **Mute** and **Camera off**, with a keyboard shortcut for mute. On anyone else's tile: a volume slider for their voice, on your screen only.
6. **Everyone is heard once.** With two screens open (Screen 1 and Screen 2) both show the cameras, but only one sends your camera and plays the voices, the same rule as the music.
7. **Optional, not in the designs:** a thin pale ring around whoever is talking. Say no and I'll leave it out.

**Upload speed: the one thing to check.** VDO.Ninja sends your camera straight to each person watching it (peer to peer), so every viewer takes its own copy of your upload.

- In the app the tiles are small, so each copy is light (about 0.3 Mbps): about 1.5 Mbps for the whole table, counting the DM's second screen.
- In milestone 8 each other streamer's overlay takes a sharper copy (about 1 to 1.5 Mbps): about 5 Mbps more.
- With a Twitch stream on top, plan on about 12 Mbps of upload each while streaming. Anyone well under that can send their camera through VDO.Ninja's free relay (Meshcast), which needs only one copy. I'll add that switch if the check in step D shows someone needs it.

**How it's built (for the record)**

- **Database.** `campaign_members.camera_id` and `campaigns.camera_key`, made at random by the database and readable only by members of the table. The DM can make new ones with **Make new camera links**, like the join code, if one ever leaks. Presence also carries whether each person is in the call and whether their camera and microphone are on. pgTAP tests for who can read them.
- **`src/call/`.** A pure function that builds the VDO.Ninja addresses, with unit tests: sending (`&push`, `&password`, the chosen devices, starting straight away with no VDO.Ninja screens) and watching (`&view`, a small `&videobitrate` for tiles, no sound from your own feed). A hidden sender kept at the top of the app, so moving between screens doesn't drop the call, holding a Web Lock so one tab per browser sends and plays. The camera tile and the camera check.
- **Control** through VDO.Ninja's IFRAME API (messages between the app and the embedded feed): mute, volume and how loud each person is.
- **Credits:** VDO.Ninja, free and open source.
- **Tests:** unit and render tests, design previews with sample tiles, and a two-browser check on my Mac using Chrome's built-in test camera and tone, which proves a picture and sound really travel from one browser to the other through VDO.Ninja. That check needs the internet, so it isn't part of the deploy.

**Try it.** Open the live site on two computers, press **Join voice and camera** on both, and see and hear each other in the tiles. Mute one and watch the microphone icon appear on the other screen. Open Screen 2 and check each voice is still heard once.

**What this changes in milestone 8.** The overlay shows everyone's cameras itself, so each streamer adds one browser source and puts only their own Twitch chat behind its window; there are no camera sources to place. The overlay carries everyone else's voices into OBS with "Control audio via OBS", and your own voice comes from your microphone in OBS as now, so nobody is heard twice and voices stay in step with faces. On Windows a webcam can often be used by only one app at a time, so Chrome keeps the camera and your own window on the overlay shows you from the app (or OBS's Virtual Camera feeds Chrome). I'll write the exact steps for Mac and Windows then.

## Jargon

| Word | Plain meaning |
| --- | --- |
| Repository (repo) | The folder on GitHub holding the code, with its full history |
| Workflow (GitHub Actions) | A script GitHub runs for you on every change, here to build and publish the site |
| Hash route | An address like `/#/play`. The part after `#` never leaves the browser, so a static host can serve every screen from one file |
| Environment variable | A named setting kept outside the code, such as a web address or key |
| Row-level security | Rules inside the database that decide, per row, who may read or change it |
| Server function | A small piece of code that runs inside the database with its own rights, so the browser cannot cheat it |
| Broadcast | A live message sent to everyone connected and then forgotten; nothing is saved |
| Signed URL | A temporary link to a private file that expires |
| Migration | A numbered SQL file that makes one change to the database, so the schema has a history too |
| Magic link | A login email with a one-time link; no password |
| SMTP | The way email is sent; "custom SMTP" means using your own sender rather than Supabase's |
| Anonymous sign-in | A throwaway guest login with no email, used only by the OBS overlay |
| Peer to peer | Video and sound sent straight from one computer to another, with no company's server in the middle. Free and quick, but each viewer takes its own copy of your upload |
| Upload speed | How fast your internet sends data out, in Mbps. Video calls and streaming both use it |
| Relay (Meshcast) | VDO.Ninja's free server that takes one copy of your camera and passes it on to everyone, for anyone whose upload is too small |
| IFRAME | A box inside a web page that shows another website, here a VDO.Ninja camera feed |
