# Start here

This folder is the starting point for the D&D Table repository. It holds the spec, the 12 screen designs and the rules Claude Code follows. Nothing is built yet; Claude Code writes the app from here.

## What's in it

| File | What it's for |
| --- | --- |
| `CLAUDE.md` | Rules Claude Code reads at the start of every session: stack, hard rules, how to work with you |
| `FIRST_PROMPT.md` | The messages to paste into Claude Code |
| `docs/SPEC.md` | The product spec |
| `docs/DESIGN_NOTES.md` | What changed in the screens after the spec, plus colours and fonts |
| `docs/design/png/` | The 12 screens as images |
| `docs/design/*.dc.html` | The design source files, for exact sizes and colours |
| `docs/PROGRESS.md` | Where the build is up to; Claude Code keeps it current |
| `.gitignore` | Stops secrets and build files being committed |

## Setting up (about 20 minutes)

1. **Create the repository.** On GitHub, make a new **public** repository, for example `dnd-table`. Public is what makes GitHub Pages free. Everything in it can be seen by anyone, including the spec, which is why book content, music and keys never go in it.
2. **Add these files.** Unzip this folder. In the new repository, choose **Add file → Upload files**, drag in everything from inside the folder (including the `docs` folder and `.gitignore`), and commit. If `.gitignore` doesn't show up because your computer hides files starting with a dot, Claude Code can create it in its first step.
3. **Create the Supabase project.** Sign up at supabase.com, create a new project on the free plan, pick a region near Jersey (London or another EU West region), and save the database password in your password manager. Claude Code will tell you which keys to copy later.
4. **Open Claude Code on the repository** and paste the first prompt from `FIRST_PROMPT.md`.
5. **Read the plan** it writes to `docs/PHASE1_PLAN.md`. Ask for changes until it looks right, then paste the build prompt.

## How git fits in

- Once the files are in the repository, everything runs through git.
- Each change Claude Code makes is a commit, so any step can be undone.
- Each milestone is merged into `main`, and GitHub Pages publishes `main` as the live site.
- You never need to use git yourself; just ask Claude Code if you want to see what changed or go back.

## Still to decide

These aren't blockers for planning, but Claude Code may ask:

- How many hours a week you can put in, which sets the real timeline.
- Target dates: a private test one-shot in mid-November and the first stream in early December?
- Whether your Envato Elements licence covers music playing on every player's channel, not just yours.
- Whether every player already has OBS and a camera set up.
- Discord for voice, or another call app.
