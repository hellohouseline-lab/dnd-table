# D&D Table: project rules for Claude Code

A private, browser-based Dungeons & Dragons table for one first-time DM (Matt) and 3 to 4 players who each stream to their own Twitch channel. The goal is to make the DM's life as easy as possible and make the game look great on stream.

## Read before planning or building

1. `docs/SPEC.md`: what the product does, the rules edition, hosting and the build phases.
2. `docs/DESIGN_NOTES.md`: what changed after the spec. Where the two disagree, the notes and the screens win.
3. `docs/design/png/`: the 12 screen designs. Look at every image before planning UI work.
4. `docs/design/*.dc.html`: the source of those designs, for exact sizes, colours and copy. They use a design-tool template format (`{{ }}`, `<sc-for>`, `<sc-if>`, `DCLogic`) and won't render on their own. Never copy that syntax into the app.
5. `docs/PROGRESS.md`: where the build is up to. Create it if it's missing.

## Stack

- **App:** Vite, React and TypeScript, built as a static single-page app.
- **Hosting:** GitHub Pages from this public repo, deployed by a GitHub Actions workflow on every push to `main`. Use hash-based routing (Pages has no single-page fallback) and set Vite's `base` to the repo name unless a custom domain is configured.
- **Backend:** Supabase free plan, nothing else.
  - Postgres for saved data, with row-level security on every table.
  - Realtime: broadcast for short-lived events (cursors and hands, pings, dice animations, audio cues); database changes for anything that must persist.
  - Auth with email magic links.
  - Storage in private buckets, served with signed URLs, for maps, art, tokens and audio.
  - Edge Functions only where a secret or a trusted check is needed.
  - Schema changes live in `supabase/migrations/` and are applied with the Supabase CLI.
- **Libraries:** PixiJS or Konva for maps, `@3d-dice/dice-box` for dice, Howler.js for audio. Prefer free, maintained, MIT-style licences; ask before adding anything heavy.
- **Config:** the browser gets only `VITE_SUPABASE_URL` and the Supabase anon (publishable) key. The service role key never goes in the client, the repo or a workflow log.

## Hard rules

1. **This repo is public.** Never commit secrets, `.env` files, keys, player data, licensed music or art, or text from the Player's Handbook, Dungeon Master's Guide or Monster Manual. Book content lives only in the private database, entered by the group through the custom content editor.
2. **2014 rules only.** Game data comes from SRD 5.1 via the 5e-database project (its 2014 data, not the 2024 or SRD 5.2 data), plus Open5e for extra open content. Keep the rules data in its own layer so it can be swapped later.
3. **Credit the open content.** A credits page carries the SRD 5.1 CC-BY-4.0 attribution statement, Open Game Licence notices for any Open5e content used, and game-icons.net (CC BY 3.0) credits.
4. **Code does the maths.** Modifiers, proficiency, saves, checks against a DC, advantage, damage, rests, currency, jumps and encounter difficulty (2014 DMG XP thresholds plus the multiplier for several monsters) are pure functions with unit tests. A natural 20 or 1 only auto-hits or auto-misses on attack rolls; ability checks and saving throws are decided by the total.
5. **Hidden means hidden.** Players must never receive what the DM hasn't revealed: monster HP numbers, DM notes, hidden tokens and NPCs, DM-only map layers, or a DC the DM chose to keep secret. Enforce it in row-level security and server-side functions, not only in the UI. When the DC is secret, the pass or fail check runs on the server.
6. **Players edit only their own character.** The DM can edit everything in their campaign.
7. **Overlay links** for OBS are read-only and use a secret token in the URL, so nobody logs in inside OBS.
8. **The Anthropic API key** (for the optional Claude panel, Phase 2) lives only in an Edge Function secret.
9. **Stay free.** Respect the Supabase free plan: 1 GB storage, 5 GB egress a month, 2 million realtime messages, 50 MB per upload, and the project pauses after a week of inactivity. Cache audio and images in the browser and throttle cursor broadcasts.

## Design

- Match the screens in `docs/design/png/`. Tokens and patterns are in `docs/DESIGN_NOTES.md`.
- Desktop first. Player and DM screens target 1440 × 900 and up; the stream overlay is exactly 1920 × 1080 with a transparent background.
- Copy is British English, in plain words a first-time player understands. No em dashes in UI text.
- Every common DM action is one click and can have a keyboard shortcut.

## How to work

- **One phase at a time.** Plan first and wait for Matt's approval before building. Then build in small milestones, each ending in something Matt can open in a browser and try.
- **Matt isn't a developer.** When he needs to do something himself (Supabase dashboard, GitHub settings, OBS), give short numbered steps with exact names of buttons and fields. Never ask him to edit code by hand.
- **Git:** work on a branch per milestone, commit in small steps with clear messages, and merge to `main` when the milestone works. `main` is what's live.
- **Tests:** Vitest for rules maths and data import. A Playwright smoke test for the roll flow (DM asks, player rolls, both see the result) using two browser contexts.
- **Progress:** at the end of every working session, update `docs/PROGRESS.md` with what's done, what's next and anything Matt needs to do.
- **Ask, don't guess,** when a choice changes what players or viewers see.
