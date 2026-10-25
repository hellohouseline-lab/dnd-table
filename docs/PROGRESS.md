# Progress

Live site: https://hellohouseline-lab.github.io/dnd-table/

## Done
- Spec written (`SPEC.md`).
- 12 screens designed and reviewed with Matt (`design/`, `DESIGN_NOTES.md`).
- Repository created: https://github.com/hellohouseline-lab/dnd-table (public). GitHub Pages switched on (step A1).
- Phase 1 plan written and approved (`PHASE1_PLAN.md`); Matt's answers are in its section 7.
- **Milestone 0, skeleton online (25 October).** Vite, React and TypeScript on Node 24; colours and self-hosted fonts from `DESIGN_NOTES.md`; Panel, Parchment, gold divider and button pieces; hash routes (`#/`, `#/credits`, and a "Lost in the fog" page for anything else); a holding page showing build progress; the credits page with the SRD 5.1 statement; GitHub Actions lints, tests, builds and deploys on every push to `main`.

## Next
- **Milestone 1, login and campaign:** email login links, campaign setup, join code, members, the Join screen, who is online.

## Targets
- Test one-shot with a fight: 21 to 22 November 2026.
- First stream: 5 to 6 December 2026.

## Waiting on Matt
- **Before milestone 1** (`PHASE1_PLAN.md` section 6):
  - Supabase steps B1 to B7. In B5 the local redirect is `http://localhost:5180/**`.
  - Gmail app password, step C.
  - GitHub step A2: add the two Supabase values as repository secrets.
- **Before milestone 7:** a test call with the group to choose voice and cameras (step D): Twitch Stream Together, VDO.Ninja for both, or Discord plus VDO.Ninja.

## Notes for the next session
- The project needs Node 24 (`.nvmrc`). Matt's Mac default is still Node 20, so run commands with Node 24 on the PATH (`~/.nvm/versions/node/v24.22.1/bin`).
- Local dev runs on port 5180: `npm run dev`, then open http://localhost:5180/dnd-table/.
- Pushing uses the GitHub CLI login for hellohouseline-lab (set in this repo's git config), because the Mac's saved git login is for another account.
- When a milestone merges, update `src/screens/home/roadmap.ts` so the holding page shows the new status.
