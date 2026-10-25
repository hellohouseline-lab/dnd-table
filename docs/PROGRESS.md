# Progress

Live site: https://hellohouseline-lab.github.io/dnd-table/

## Done
- Spec written (`SPEC.md`).
- 12 screens designed and reviewed with Matt (`design/`, `DESIGN_NOTES.md`).
- Repository created: https://github.com/hellohouseline-lab/dnd-table (public). GitHub Pages switched on (step A1).
- Phase 1 plan written and approved (`PHASE1_PLAN.md`); Matt's answers are in its section 7.
- **Supabase and email set up (25 October).** Project `dnd-table` in West EU (Ireland), URL `https://ezvogsqupheisvruujwl.supabase.co`. Site URL and redirect URLs set (live site and `http://localhost:5180/**`), email and anonymous sign-ins on, Gmail custom SMTP working (test invite arrived), email rate limit 30 an hour. The URL and publishable key are GitHub repository secrets and in Matt's local `.env.local`.
- **Milestone 0, skeleton online (25 October).** Vite, React and TypeScript on Node 24; colours and self-hosted fonts from `DESIGN_NOTES.md`; Panel, Parchment, gold divider and button pieces; hash routes (`#/`, `#/credits`, and a "Lost in the fog" page for anything else); a holding page showing build progress; the credits page with the SRD 5.1 statement; GitHub Actions lints, tests, builds and deploys on every push to `main`.
- **Login code and Sign out button (25 October).** Login emails carry a code as well as the link (templates pasted into Supabase; Matt confirmed it works). Signed-in pages have Your tables and a Sign out button at the top right.
- **Milestone 1, login and campaign (25 October).** Sign in with an email link (`#/`), which returns to the screen you were heading for. "Your tables" lists your campaigns and has a join-code box. "Start a campaign" (`#/new`) makes you the DM. Invite links (`#/join/<code>`) show which table a code opens and ask for your name at the table. The Join screen (`#/c/<id>`, design 01) shows the DM the join code, invite link with copy, "Make a new code", the party with Here tonight and Remove, and campaign details; players see the two character cards from the design, switched off until milestone 2. Both see "At the table now" with live presence and empty seats, and the camera box held for milestone 7. Database: `campaigns` and `campaign_members` with row-level security, join and create functions that refuse anonymous guests, and private live channels per campaign; 38 database tests and 40 unit tests pass.

## Next
- **Milestone 2, character sheets:** SRD import, the sheet typed in with live maths, the player plate, "players edit only their own".

## Targets
- Test one-shot with a fight: 21 to 22 November 2026.
- First stream: 5 to 6 December 2026.

## Waiting on Matt
- **Try milestone 1** on the live site (steps in the milestone 1 hand-over): sign in, start the campaign, and join as a player with a second email address.
- **Before milestone 7:** a test call with the group to choose voice and cameras (step D): Twitch Stream Together, VDO.Ninja for both, or Discord plus VDO.Ninja.

## Notes for the next session
- The project needs Node 24 (`.nvmrc`). Matt's Mac default is still Node 20, so run commands with Node 24 on the PATH (`~/.nvm/versions/node/v24.22.1/bin`).
- Local dev runs on port 5180: `npm run dev`, then open http://localhost:5180/dnd-table/.
- Pushing uses the GitHub CLI login for hellohouseline-lab (set in this repo's git config), because the Mac's saved git login is for another account.
- When a milestone merges, update `src/screens/progress/roadmap.ts` so the Build progress page shows the new status.
- Database: the Supabase CLI is logged in and linked. `npm run db:push` applies new files in `supabase/migrations/`, `npm run db:types` regenerates `src/live/database.types.ts`, and `npm run test:db` runs the pgTAP tests in `supabase/tests/database/` against the live project inside a transaction that is always undone (no Docker on this Mac, so `supabase test db` can't run).
- Supabase's advisor warns that signed-in users can call the security-definer functions and that the table rules apply to anonymous guests too. Both are on purpose: each function checks the caller, and guests can't join a table, so they see nothing (covered by tests). Leaked-password protection doesn't apply, as nobody uses passwords.
- Login uses the implicit flow (see the corrected note in `PHASE1_PLAN.md` section 1). A link opened on a different device, such as a phone, signs in that device, so the email also carries a code: after asking for a login, the "Check your email" step has a box for it. The email wording lives in `supabase/templates/` and must match the dashboard's Magic Link and Confirm signup templates.
- Design previews with made-up data, only under `npm run dev`: `#/dev/join/dm`, `#/dev/join/player` and `#/dev/check-email`.
