# Prompts to paste into Claude Code

## 1. Plan Phase 1

Paste this first. Use Claude Fable 5.1 for this step if you have it, or Opus 5.5.

```
This repo is the start of a private D&D table for my group. Read CLAUDE.md, docs/SPEC.md and docs/DESIGN_NOTES.md, and look at every image in docs/design/png/.

Then plan Phase 1 only. Don't write any code yet.

The plan should cover:
1. Project setup: folder structure, the GitHub Actions deploy to GitHub Pages, and environment variables.
2. Supabase: the tables Phase 1 needs, the row-level security rules, what goes over realtime broadcast versus what is saved, and the storage buckets.
3. Rules data: how the SRD 5.1 (2014) data from 5e-database gets into the app, and where the credits go.
4. The Phase 1 screens in build order, matched to the design images, saying what works in Phase 1 and what is hidden until Phase 2.
5. Milestones: small steps, each ending in something I can open in a browser and try, ordered so we can run a private test session as early as possible.
6. Everything I need to do myself (accounts, keys, settings), as numbered steps.
7. Any questions you need answered before you start.

I'm not a developer, so keep it short enough to read in ten minutes and explain any jargon in plain words. Save the plan as docs/PHASE1_PLAN.md and commit it.
```

## 2. Build, one milestone at a time

Once you're happy with the plan (ask for changes first if anything looks wrong), switch to Opus 5.5 and paste:

```
The plan is approved. Build milestone 1. When it works, merge it to main, update docs/PROGRESS.md, then stop and tell me how to try it.
```

After each milestone, try it, then say "next milestone" or describe what's wrong.

## 3. Starting a new session later

Claude Code reads CLAUDE.md every time, so a new session only needs:

```
Read docs/PROGRESS.md and carry on with the next milestone.
```
