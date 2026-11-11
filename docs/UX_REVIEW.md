# A look through everything: what would make it better for players and the DM

Written 11 November 2026, ten days before the test one-shot (21 to 22 November). **A1 to A6 are built (milestone N1, the same day).** The rest waits for Matt to pick after the one-shot.

Two things turned out differently while building:
- **A2:** a player's panels are the same width on both sides, so centring the map changed nothing. The map now slides to keep whoever's acting out from under the panels.
- **A4:** the project was found already paused, 13 days after it was last used. Matt needs to restore it by hand once (steps in `PROGRESS.md`).

## How this was done, and what it can't tell you

- Every main screen was opened in the previews (made-up people, no database) as a player and as the DM, at a big screen (1440 × 900) and at laptop sizes (1440 × 800 and 1366 × 700, which is what a 1366 × 768 laptop has left once the browser's own bars are taken off).
- The code was searched for things a first night tends to need: lost connections, "it's your turn" signals, half-built buttons, and the free Supabase plan's limits.
- **Not done:** nobody played a real session for this. It can't say what feels slow or confusing to real people; the one-shot will. Treat the list as "most likely to bite", not as proof.

## A. Before the one-shot: most likely to hurt on the night

1. **End turn and Next turn fall off the bottom of a laptop screen.**
   - **Player, 1366 × 700, in a fight:** the left column shows 552 pixels of a 1,206-pixel list. **End turn** sits at 789 pixels down, so it's out of sight until they scroll. A dying player's panel pushes it further.
   - **DM's Battle screen, 1440 × 800, playing a monster:** **End turn** is at 986 pixels and **Next turn** at 1,053. Both are off the screen. The N key still works.
   - **Fix:** pin **End turn** (players) and **Next turn / Start the battle** (DM) so they never scroll away, and fold the less-used actions (Hide, Help, Search, Ready, Use an object, the jump line) behind a **More** button.
2. **Miniatures hide under the player's panels.** On the player's map a miniature near the left edge sits half under the character panel, and the "You can move 25 ft" label is cut off behind the turn banner. The DM's Battle screen now centres the map between its panels; the player's map should do the same.
3. **Nothing calls a player back when it's their turn.** A streamer looking at OBS or chat gets no sound and no change in the browser tab when their turn starts or the DM asks for a roll. The app already has a chime (it plays when you're given an item).
   - **Fix:** a soft chime and "● Your turn" in the tab's title for your turn and for a roll request, with a switch to turn the sound off.
4. **The free database goes to sleep after a week unused.** The one-shot is 21 to 22 November and the first stream 5 to 6 December: 13 days apart. If nobody opens the table in between, Supabase pauses the project and the site won't load until Matt wakes it in the dashboard.
   - **Fix:** a small daily "keep awake" job in GitHub Actions that asks the database one harmless question with the public key it already has. It should count as use; worth checking the dashboard after a quiet week to be sure.
5. **A dropped connection is silent.** The app already catches up by itself when the connection returns, but nobody is told it dropped, so a player may think the game has frozen.
   - **Fix:** a small "Reconnecting…" chip while the live link is down.
6. **Buttons that do nothing are on show.** Lore (players), Too hard? Rebalance, Reveal hidden areas, Chapter title card and Handouts all say "Arrives in Phase 2". Players' screens are streamed.
   - **Fix:** hide them until they're built.
7. **Nothing shows a player they've been hit.** Hit points just change. A short red flash on the hit point bar when you take damage (green when healed) makes it land. No such effect was found in the player's screen.

## B. For the DM

8. **Breath weapons don't know they recharge.** The rules import drops "Recharge 5–6", so the Acid Breath card is always ready. Keep it in the import, grey the card after use, and roll the recharge by itself at the start of the monster's turn.
9. **Legendary actions aren't counted.** A dragon gets three a round; the cards don't keep count. Three pips that refill on its turn would do it.
10. **Monsters you type in get no cards.** A monster that isn't in the free rules (Crassus) falls back to the old Acting now card. A short **Make a monster** form (name, AC, hit points, attacks, one save ability), or reading it from the campaign file, would give it cards too.
11. **No list of the keys.** N, U, R, A, T, P, 1 to 9 and M all work on the Battle screen, but nothing shows them. Press **?** for a small list.
12. **The Battle screen's header wraps at 1440 wide.** The table's name and the buttons each break onto two lines. Shorter labels fix it.
13. **Play as the monsters is forgotten after each fight.** Remember it for good once switched on (Matt's call).
14. **"Waiting on Matt" in `PROGRESS.md` has 36 entries,** most of them old "Try this" notes. Replace it with one **Before game night** list: sounds brought in, pictures and maps up, shop made, cameras tried, every player has a character.

## C. For players

15. **No first-night help.** A first-time player lands on a screen with a plate, cards, dice and panels, and nothing says what's what. A four-step card the first time they sit down (your character, your cards, your dice, the Rules button), which they can close, would cover it.
16. **"You're next" is easy to miss.** It's only small print on a camera tile. A line under the turn banner ("You're up after Goblin A") gives them time to plan.
17. **A dying player's screen is busy.** The Dying box sits above a full turn panel they can't use. While at 0 hit points, show only Roll a death save and End turn.

## Decisions for Matt (recommendations first)

96. **Do A1 to A6 before the one-shot,** in that order, as one milestone ("N1: ready for the night"). *Recommended.* A7 if there's time.
97. **The chime (A3) is on for everyone to start with,** each player can switch it off. *Recommended.* Or off until switched on.
98. **Hide the unbuilt buttons (A6).** *Recommended.* Or leave them greyed as a promise of what's coming.
99. **After the one-shot:** B8 to B10 (recharge, legendary count, your own monsters), then C15 to C17, then the rest. *Recommended,* but the one-shot will probably reorder this.
100. **Tidy "Waiting on Matt" into one Before game night list (B14) now.** *Recommended.*
