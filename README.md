# D&D Table

A private, browser-based Dungeons & Dragons 5e (2014 rules) table for one DM and a small group of players who stream to Twitch. It has live dice, roll requests with automatic pass or fail, battle maps, character sheets, synced music and sound, and OBS overlays.

This is a personal project for one group, not a public service. Game rules data comes from the System Reference Document 5.1 and other openly licensed sources; credits are listed in the app and in [`CREDITS.md`](CREDITS.md).

- Live site: https://hellohouseline-lab.github.io/dnd-table/
- Product spec: [`docs/SPEC.md`](docs/SPEC.md)
- Screen designs: [`docs/design/png/`](docs/design/png/) and [`docs/DESIGN_NOTES.md`](docs/DESIGN_NOTES.md)
- Phase 1 plan: [`docs/PHASE1_PLAN.md`](docs/PHASE1_PLAN.md)
- Build progress: [`docs/PROGRESS.md`](docs/PROGRESS.md)

## Running it locally

Needs Node 24 (see `.nvmrc`).

```bash
npm install
npm run dev
```

Then open http://localhost:5180/dnd-table/. `npm test` runs the unit tests and `npm run build` makes the site in `dist/`.
