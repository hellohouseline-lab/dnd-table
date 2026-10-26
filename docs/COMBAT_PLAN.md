# Combat and characters rework: the plan

**C1 built on 26 October**, overnight: see `PROGRESS.md` for what's in it and how to try it. **Revised on 27 October** after Matt tested C1: damage types, spells and rests come next (C1b), then the character builder (C2), then a new **story mode** (S1, section 4b), then the rest of the rules (C3 lite). Screen 1 becomes "the journey" and Screen 2 "the table". Fable researched what DMs and players struggle with (appendix B). The fixes from that test (End turn, monsters joining, placing miniatures before the first turn, reach and range) are live.

Written 26 October 2026, after Matt's first combat test, and revised the same day so the whole fight runs from one DM screen. The UX was planned with Fable (including research into how D&D Beyond and other online tables split the DM's controls, in the appendix) and checked against the code and the SRD data. Nothing here is built yet; it waits for Matt's approval. Sections 1 to 4 are plain words; section 5 is technical; sections 6 and 7 are the order of work and the decisions.

## In plain words

Matt's test found one real bug and a lot of hand work the app should be doing.

**Already fixed and live (26 October).** When the DM started a fight, a player's screen could throw away fighters that arrived while it was still loading, so the player had no place in the turn order, no Roll initiative prompt and no working End turn. New monsters' real names also didn't reach the DM's other screen. Both are fixed; each screen now loads the whole fight once a burst of changes settles. Not yet checked with a real player signed in.

**The rest is hand work.** Today the DM picks a map on Screen 2, switches to it, presses Add the party and Place the monsters, and switches screens to see the map; players tick their own action boxes; nothing targets anything; damage is typed in; and characters are typed in rather than built.

**The rework turns a fight into a guided loop.** The DM presses Start combat and the app asks which map (or none), puts everyone's miniature on it, rolls the monsters' initiative and asks the players for theirs. On your turn your screen says "Your turn", shows cards for everything you can do right now, greys out what you've used, and counts down your movement as you drag your miniature. Attacking is two clicks: the card, then the target. The server rolls, checks the hit against the target's armour class (a monster's stays secret), takes the damage off, and tells everyone who was hit and for how much. The DM gets an Undo for anything. A monster's turn is the same two clicks for the DM. The DM runs the whole fight from one screen: Screen 2 turns into a Battle screen with the big map, the turn order, the acting creature's actions, damage, conditions and Undo, while Screen 1 keeps the story. Characters are built in a step-by-step wizard with standard array, point buy, rolled or "random but balanced" scores, starting gear from the rules, and spells from a list.

## 1. The turn loop

**Turn state lives on the server.** Each fighter has a small turn record: action used, bonus action used, reaction used, feet moved, extra feet from Dash. Nothing is ticked by hand: every card and every move updates it, so the DM's screens, the player's screen and (later) the overlay always agree. End turn clears the next creature's record; your reaction comes back at the start of your own turn, as the 2014 rules say.

**The player whose turn it is sees:**
- The gold "Your turn · Round N" banner (design 05) and a short sound.
- **This turn**, read from the server: Action, Bonus action, Reaction and Movement, each Ready or Used, with movement as "15 of 30 ft", counting down live as the miniature is dragged.
- **A hand of cards for what can be used now:**
  - **Actions:** each equipped weapon ("Longsword · +5 · 1d8+3"), each attack spell, then the standard actions as plain cards: Dash, Disengage, Dodge, Help, Hide, Search, Use an object and Ready.
    - Dash adds your speed to your movement. Disengage stops opportunity attacks this turn. Dodge puts a "Dodging" chip on you until your next turn.
    - Hide rolls Stealth and Search rolls Perception.
    - Help and Ready spend the action and post a line the DM sees.
  - **Talk:** Persuade, Intimidate, Deceive. Each spends the action and rolls the skill. The DM sees "Elowen tries to talk the goblins down: Persuasion 14" with **It works**, **Partly** and **It doesn't**. For a secret DC the DM uses Ask for a roll, as today.
  - **Bonus actions:** features with uses (Second Wind, say), bonus-action spells, and "Off-hand attack", which lights up only after an attack with a light weapon while holding another (damage without the ability bonus).
  - **Reactions,** greyed on your turn and lit on others': Opportunity attack, the Shield spell.
  - **When it applies:** "Stand up" when prone (costs half your speed), and "Roll a death save" as the only card at 0 hit points.
  - **End turn,** and a quiet "Flee" hint: Dash and move, with the DM told who can take a swing.
- **Picking a target:** an attack card lights up the possible targets on the map and in the turn order. Click one to roll; Escape cancels.

**Everyone else sees:** the turn order with the acting creature lit, "Goblin A is acting", and a short feed of what happened ("Goblin A hits Thorin for 5", "Elowen misses Unknown creature 2"). If a creature moves out of their reach without Disengaging, they get "Opportunity attack?" with **Attack** and **Let it go**.

**The DM sees** the Battle screen (Screen 2 during a fight, section 3):
- The turn order, with four small pips on the acting row: action, bonus, reaction and movement left.
- The Acting now card, the big map, and the same feed with real names and numbers.
- **Undo** for the last thing that happened.

Screen 1 keeps the story. Its Encounter tab becomes a glance (the order, Next turn, Ask for a roll and the feed), and the notebook holds "Why this fight matters" and "Read aloud when it ends" from design 10.

On a player's turn the Acting now card becomes their **turn card**:
- **What's left:** the four pips, and their attacks.
- **Spells:** slots as pips for each level ("1st ●●○ · 2nd ●○"), and their spells by level with casting time and a C for concentration.
- **Everything else:** features with uses, what they're concentrating on, and conditions with the turns they have left.

It says "Elowen acts from her screen", and **Act for her** uses the same card for someone who has stepped away.

**The acting player also sees** a Spells group in their hand with the slot pips at its head:
- **Out of slots:** a spell greys out when no slot fits.
- **Casting:** spends the slot and the action (or bonus action) by itself. Attack spells roll like weapons; save spells open the DM's results screen; the rest are logged.
- **Concentration:** a caster shows a C chip on their plate, camera tile and miniature, and is asked for the save when hit.

**A monster's turn in two clicks.** The Acting now card lists its SRD actions. Click one (or press its number), then click a target on the map or in the turn order. The server rolls to hit against the character's AC, takes the damage off and posts it.
- **Multiattack:** one button, both rolls.
- **Actions with a saving throw:** open Ask for a roll already filled in with the ability and DC, and the results screen's "damage those who failed, half to those who passed" applies it.
- **Traits** such as Nimble Escape show as a reminder line.

**Keyboard:** N next turn, 1 to 9 an action or a target, U undo, R reveal the name, S the story drawer, and the key left of 1 (\`) swaps screens. M is already mute.

## 2. Targeting and what's automatic

**One server function settles an attack.** It throws the dice the fair way it does today, reads the target's AC, and decides hit or miss: a natural 20 always hits, a natural 1 always misses, otherwise the total against the AC. Then it applies the damage:
- **Temporary hit points first.**
- **Damage types.** Every attack and spell carries its type. A monster's resistances, vulnerabilities and immunities come from the SRD; a character's from a short list on the sheet. They're applied with no settings to fiddle with, and the feed says so ("Goblin A takes 3 cold, resisted"). Players learn a resistance only once it has happened, as they would at a table.
- **Reach and range** (built 27 October). On the map, an attack checks the distance first: melee 5 feet (10 with reach), thrown and ranged weapons their range, with disadvantage beyond normal range. Players can't attack what they can't reach; the DM is asked "Attack anyway?".
- **Resistance, vulnerability and immunity:** resistance halves, vulnerability doubles, immunity stops it. Monsters' come from the SRD; characters' from a short list on the sheet.
- **Health:** a monster's hit points change in its secret record and its health word updates; a character's hit points change on their sheet.
- **Never sent to players:** the monster's AC and how close the roll was.
- **Advantage and disadvantage:** applied automatically for Dodging targets, prone targets and the other conditions the app already knows.

**After damage, automatically:**
- **Concentration:** a caster who is concentrating gets a Constitution save at DC 10 or half the damage, whichever is higher. A failed save ends the spell.
- **A character at 0 hit points** falls unconscious and their turn becomes the death save card:
  - 10 or more is a success; a natural 20 brings them back with 1 hit point; a natural 1 counts as two failures.
  - Three successes means stable.
  - Three failures marks them dead, which the DM can undo.
  - Healing clears the saves.
- **A monster at 0** is down and skipped.

**Where the DM keeps judgement:**
- **Undo:** everything applied can be undone (hit points, temporary hit points and conditions come back as they were).
- **Saves from spells and breath weapons** still go through the results screen, where the DM can adjust.
- **Conditions from an attack,** such as a ghoul's paralysis, are offered as one click ("Apply Paralysed"), not applied silently.
- **Hit points** can still be nudged with − and +.

## 3. The battle map and miniatures

**Starting a fight.** The Start combat dialog gets a **Where** step: a map from the library (as thumbnails), **No map, in our heads**, or **Quick map**. On Start the app does the rest, with nothing to press on Screen 2:
- Puts the map on stage.
- Places the party's miniatures along one edge and the monsters' along the other.
- Rolls the monsters' initiative and asks the players for theirs.

The DM can still hide a monster for an ambush.

**Who moves what.** The DM drags anything, any time. Before the first turn, while everyone rolls initiative, players put their own miniature where they think their character is (built 27 October). After that a player drags their own miniature on their turn, only as far as their movement left (plus Dash). The server refuses a longer move, so the limit is real. The "Players move their own tokens" switch stays, to turn that off. Hands and double-click pings stay for pointing. New: on someone else's turn a player can draw a suggested path, and the DM sees it with **Move them there** (one click).

**The DM's two screens** (revised 27 October). Keep two screens, but make each one able to run the table alone.

- **Screen 1 is "the journey"** (design 07 reshaped). Out of a fight, this is where the DM works:
  - Story mode (section 4b): chapters, scenes, the current scene's read-aloud, reminders, planned rolls and choices.
  - The party at a glance: HP, AC, conditions, spell slots left and concentration.
  - Ask for a roll, Rest and Give an item.
  - A **stage strip**: the picture on stage, the music mood and the effects keys.

  In a fight it shows the fight's scene notes and the glance Encounter tab.
- **Screen 2 is "the table"** (design 11): what everyone sees, the library and the full mixer out of a fight, and the Battle layout during one, as built. The acting creature's full turn card lives here.
- **What players see** is set from a scene in one click on Screen 1, since a scene's picture and music come with it. The library and the mixer stay on Screen 2. The effects keys work on both screens.
- **The chat monitor** shows Twitch chat in a browser or OBS; nothing of ours.
- **One monitor:** each screen has what it needs (the story drawer on Screen 2, the stage strip on Screen 1), and the \` key swaps between them.
- **Why not one merged screen?** With two monitors, the pattern that works is to operate on one and keep reference on the other, and a merged screen would shrink the map.

**The Battle layout at 1440 by 900** (design 11's frame, in the same panels and parchment):
- **Header:** "Battle · Round 2 · Goblin A is acting", a sound strip (moods, play and pause, effects keys; **Sound** opens the full panels as a drawer), **Show a picture**, **Screen 1: Story**.
- **Left column, about 320 wide:**
  - **Turn order:** initiative; real name with "players see Unknown creature 2"; HP or the health word; the four pips; condition chips; − and +.
  - **Acting now:** name, AC, HP and speed; each action as a button ("Scimitar · +4 · 1d6+2", then pick a target) with its number key; Multiattack; traits; Reveal name; conditions; Act for them; a **Stat block** toggle for the full SRD text.
  - **At its foot:** Next turn (N), Add a monster, End fight.
- **Centre, about 840 wide:**
  - **The battle map** (about 640 tall), with target picking, hands, pings, suggested paths and hidden tokens drawn dashed, "only you". A slim toolbar holds Squares, Nudge, Hide, Take off the map and Players move: on or off.
  - **Under the map, a strip:** the feed with Undo on the left; on the right a quick bar for damage or healing (targets, amount, type, condition).
- **Right column:** the cameras at 200 by 113, in turn order with the acting tile lit (as built in milestone 7).
- At 1920 by 1080 the map grows to about 1300 by 800.

**What changes in the designs:** 07 gains the stage strip and the glance Encounter tab. 10 is retired as a layout: its turn order and Acting now move to the Battle layout, its story column stays on Screen 1, and its bottom bar stays as Screen 1's combat verbs. 11 gains the Battle layout as its in-fight state.

**No map.** Targeting works from the turn order, movement isn't tracked ("Movement: as the DM describes"), and opportunity attacks are the DM's call.

**Making maps, free:**
1. **Uploads.** Works now; your Envato licence covers streaming.
2. **Quick map.** A plain floor (stone, wood, grass or sand) with a grid, where you paint rectangles as walls, water or rough ground. It's saved as a tiny file, so it costs almost no storage.
3. **A generator** (rooms and corridors, caves). Recommended for later: one that looks good on stream is a week of work on its own.

## 4. Characters

A step-by-step wizard for new characters (the full form stays for edits and for characters brought from elsewhere):

1. **Name, race and subrace,** with ability bonuses, speed and traits filled in.
2. **Class,** with hit die, saves, proficiencies, level 1 features, and skill choices limited to the class's number.
3. **Background,** with its skills and feature.
4. **Ability scores,** four ways:
   - **Standard array:** drag 15, 14, 13, 12, 10 and 8 onto the abilities.
   - **Point buy:** 27 points with the 2014 costs and a live counter.
   - **Roll:** 4d6, drop the lowest, six times, thrown by the server with the 3D dice for everyone to see.
   - **Random but balanced:** the standard array dealt for you.

   Each method offers "Suggest for a Fighter": the class's main ability gets the best score, then Constitution. Racial bonuses are added on top and shown separately.
5. **Starting gear** from the SRD:
   - The class's equipment choices as cards ("Chain mail, or leather armour, a longbow and 20 arrows") plus the background's kit.
   - Armour sets AC automatically, weapons become attack cards, and ammunition is counted.
   - **"Gear for your level", honestly:** the free rules have no gear-by-level tables. Above level 1, the wizard gives level 1 gear plus gold the DM sets, to spend in a shop listing SRD equipment at its real prices. The DM can hand out SRD magic items, such as a Potion of Healing.
6. **Spells** for casters: how many cantrips and spells from the class table, a list filtered by class, one click to add.
7. **Review and save.**

**What the free rules include:** nine races with one subrace each, one subclass per class, and a single background (Acolyte). That's because the repo can only hold the SRD. A player who wants a different background, subclass or race from the Player's Handbook types it in by hand. The custom content editor in Phase 2 makes that easier.

**Adding things later:** a search box on the Sheet and Powers tabs. Type "handaxe", click it, and it's in your hand.

**The hand of cards** is built from the sheet: equipped weapons (thrown ones too), spells (with a slot picker when more than one level fits), features with uses, potions, and the combat actions. Out of a fight it shows attacks, features and spells only.

## 4b. Story mode

**What it holds.** A chapter is a list of **scenes** (steps or places). A scene has:
- a title and place;
- **read aloud** text, on parchment;
- **reminders** for the DM: where the party can go, and what they might miss;
- a **picture** and a **music mood**;
- **people**: NPCs, on stage or hidden;
- **planned rolls**: which check, who rolls, a DC, whether to tell them the number, and whether to tell them the outcome;
- **choices** ("If they take the mill road: Scene 4");
- **items** to hand out;
- an **encounter** ready to start, with its monsters and map.

A **Where we are** marker sits on the current scene. The notebook's boxes (what happens next, key items, quick note) stay as the chapter's checklist.

**One click.** **Go here** on a scene does four things:
- puts its picture and music on stage;
- shows its read-aloud;
- turns its planned rolls into buttons ("Ask: Perception, DC 13, secret");
- turns its choices into links to the next scenes.

A planned roll opens Ask for a roll already filled in, and the encounter opens Start combat already filled in.

**Secret outcomes.**
- **Tell players the outcome:** a new tick in Ask for a roll, next to Tell players the number, on by default. With it off, players see only "You rolled 14", and the DM sees Passed or Failed. The pass or fail never reaches their browser.
- **Roll behind the screen:** for the rare roll players shouldn't see at all, the DM throws it for them with their bonus.

Use both sparingly, for an ambush Perception check or a pivotal Insight check.

**Getting the story in.** A **Paste your notes** box takes plain text (or Markdown) and splits it into chapters and scenes at headings and numbered lines; then you tidy it. Typing scenes in works too. Book text is fine here, because it lives only in the private database, never in the public repository. There's no PDF import before the first stream.

## 5. How it's built (technical)

**Database** (new migrations, pgTAP tests in the style of `combat.test.sql`):
- `combatants`: `speed`, `action_used`, `bonus_used`, `reaction_used`, `feet_moved`, `extra_feet` (Dash), `disengaged`, `dodging`; changed only through functions.
- `combatant_secrets`: `resistances`, `vulnerabilities`, `immunities`, `condition_immunities` (text arrays).
- `characters`: `inventory jsonb` (SRD index, quantity, equipped slot), `resistances text[]`, and `creation jsonb` (how the scores were made).
- `combat_events`:
  - In the realtime publication, with columns `encounter_id`, `round`, `actor_id`, `target_id` and `kind` (attack, damage, heal, condition, action, move, death_save, talk, undo).
  - `shown jsonb` holds what players may see; `before jsonb` holds what Undo puts back; `undone` marks one that was undone.
  - A DM-only `combat_event_secrets` holds the AC and margin, following the `roll_request_secrets` pattern.
- `assets`: a `quickmap` kind with its painted rectangles in `map_data jsonb`; no file uploaded.

**Server functions** (security definer, caller checks as in `end_turn`):
- `start_fight(party, foes, map, placement)`: does in one call what the browser does in several today, which also removes the burst at its root.
- `use_action`; `resolve_attack(attacker, target, roll, options)`, which calls `throw_dice`, reads AC, applies damage and writes the event and its secret.
- `apply_damage` and `apply_heal` (the DM, or a character's owner for potions); `set_condition`; `undo_event`.
- `move_combatant_token`: during a fight, moves go through this instead of the table. Squares × 5 ft, checked against movement left; it also notices opportunity attacks.
- `stand_up`; `death_save`.
- `end_turn`, extended to reset the next creature's record and clear Dodge.
- `throw_dice` gains "drop the lowest" for 4d6.

**Rules layer** (pure functions with Vitest, mirroring the SQL as `settleRoll` mirrors `throw_dice`):
- `src/rules/turn.ts`: what's usable now, the card list, two-weapon fighting, Dash, standing up and opportunity attacks.
- `src/rules/attackResolution.ts`: hit or miss, and damage application.
- `src/rules/abilityScores.ts`: standard array, point-buy costs, 4d6 drop lowest, the class suggestion.
- `src/rules/equipment.ts`: AC from armour, starting-equipment choices.
- `scripts/import-srd.ts`: extended to write SRD equipment (armour, gear, packs, prices), class and background starting equipment, monster resistances and SRD magic items.

**Live layer:**
- `useFight` keeps the settle-then-load fix.
- New `useCombatEvents` (the feed and Undo) and `useTurn`.

**Screens:**
- **Player:** `YourTurnPanel` (replaces `ThisTurn`), `ActionHand` (replaces `Hand`), target picking in `BattleMap`, hit toasts.
- **Screen 2:** `BattleView`, shown by `StageScreen` while a fight is active.
  - `TurnOrder` and `ActingNow`, moved out of `EncounterTab`.
  - `BattleMap` with target picking, `EventFeed` with Undo, `QuickDamageBar`, `SoundStrip`.
  - `StoryDrawer`: the `NotebookPanel`, read-only.
  - Whether it shows the battle or a picture is local to the screen, not saved.
- **Screen 1:** `StageStrip` under the header; the Encounter tab becomes `FightGlance` (order, pips, Next turn, feed); the combat verb bar stays.
- **Start combat:** the Where step.
- **Stage:** the Quick map painter and suggested paths.
- **Characters:** `CharacterWizard`, and an item search on the Sheet tab.

**Added on 27 October (C1b, S1):**
- **Database:**
  - `scenes`, DM only: `campaign_id`, `chapter`, `order`, `title`, `place`, `read_aloud`, `notes`, `image_id`, `music_mood`, and `people`, `planned_rolls`, `choices`, `items` and `encounter` as jsonb. `stage.scene_id` marks where we are.
  - `roll_requests.outcome_shown`. When it's false, `throw_dice` writes the verdict to a DM-only `roll_verdicts` row and leaves `rolls.passed` empty.
  - `resistances`, `vulnerabilities` and `immunities` as text arrays on `characters` and `combatant_secrets`, imported for monsters.
  - `combatants.concentrating` and `condition_turns`.
  - `resolve_attack` and a new `apply_damage` take a damage type. A new `cast_spell(combatant, spell, slot_level)` spends the slot and the action, and `end_turn` counts conditions down.
- **Rules layer:**
  - `src/rules/damage.ts`: damage type adjustments.
  - `src/rules/spells.ts`: what can be cast now, which slot, and concentration.
  - `src/rules/story.ts`: the paste splitter.

  All pure functions with tests.
- **Screens:**
  - `JourneyView` for Screen 1: the scene list, the current scene, planned rolls and choices.
  - `TurnCard` on the Battle screen, and `SpellsGroup` in the hand.
  - The C chip, and the outcome tick in Ask for a roll.

**Free plan:** events are small rows, hands stay throttled, quick maps are tiny, no new storage.

## 6. Order of work

Each step ends in something Matt can open and try, like the milestones so far.

| When | Step | Matt can try | Size |
| --- | --- | --- | --- |
| 26 Oct | **C1. The turn loop** (built), plus the fixes from Matt's first test (built 27 Oct) | | |
| 28 Oct to 1 Nov | **C1b. Damage, spells and rests in the fight.** Damage types with resistance, vulnerability and immunity; spell cards that spend a slot and the action; slot pips for the DM and the player; the concentration chip and save prompt; death saves; "back after a rest" on the sheet | A wizard casts Magic Missile and Shield, a goblin shrugs off cold, and a caster is asked for the concentration save when hit | About 4 days |
| 2 to 8 Nov | **C2. The character builder**, as in section 4 | Players build their one-shot characters | About 5 days |
| 9 to 13 Nov | **S1. Story mode** (section 4b): chapters and scenes, Go here, planned rolls, Tell players the outcome, Roll behind the screen, the paste import, the journey layout on Screen 1 | Paste your one-shot and walk a scene: its picture, its music and a secret Perception check | About 4 days |
| 14 to 18 Nov | **C3 lite.** Opportunity attacks, Talk cards, two-weapon fighting, Hide and Search, conditions counting down, and fixes from your tests | A full fight with a parley and someone going down | 3 days and 2 spare |
| 19 to 20 Nov | A dry run with the group | | |
| 21 to 22 Nov | **Test one-shot** | | |
| 23 to 29 Nov | **8. Stream overlay** | | About 5 days |
| 30 Nov to 4 Dec | **9. Rehearsal fixes** | | |
| 5 to 6 Dec | **First stream** | | |

The overlay comes after the test one-shot, so the OBS steps should go to the streamers the moment milestone 8 lands.

**If time runs short, cut in this order:**
1. The Quick map painter (uploads only).
2. Suggested paths (pings only).
3. The shop (the DM gives items).
4. Ready and Help.
5. Talk cards (Ask for a roll covers them).
6. Legendary actions.
7. The paste import (type the scenes in).

Don't cut C1b, the builder's scores and gear, Go here, or Tell players the outcome.

## 7. Decisions for Matt (recommendations first)

1. **Who moves the miniatures?** Players move their own on their turn, within their movement; the DM moves anything; the "players move" switch turns theirs off for a scene.
2. **Is damage applied automatically?** Yes for attack rolls, with Undo. The DM confirms anything with a saving throw or an area, on the results screen.
3. **When are monster names revealed?** On 25 October you chose "hidden until revealed", and in the test "Unknown creature" confused things. Recommended: a tick in Start combat, "Players know what these are", on by default; untick it for an ambush or a mystery.
4. **How automatic is a monster's turn?** Two clicks: its action, then the target. A one-click "attack the nearest" can come after the test.
5. **A map for every fight?** The dialog always asks, and "No map, in our heads" is a fine answer for a scuffle.
6. **Ability scores for the one-shot?** Standard array with the class suggestion for new players; anyone who wants the thrill rolls 4d6 on the server for all to see.
7. **Can players use Dash, Dodge, Hide and the Talk cards themselves?** Yes; the DM sees each one in the feed and can override.
8. **Do players see their attack total?** Yes ("You rolled 17: hit"), never the monster's AC.
9. **A turn timer?** Off; the lit banner and sound are enough.
10. **Which screen runs the fight?** Screen 2 becomes the Battle screen (map, order, actions, damage, Undo) and Screen 1 stays the story.
11. **Does Screen 2 switch to the battle by itself?** Yes when you press Start combat, and back when the fight ends, with Show a picture to cut to art mid-fight.
12. **Where are the sound controls in a fight?** A strip in the Battle header (moods, play and pause, effects keys), with the full panels in a drawer; the effects keys work on both screens.
13. **One monitor?** The Battle screen with the story drawer in a fight, the Story screen between fights.
14. **Keep two screens?** Yes: Screen 1 the journey, Screen 2 the table and the battle, each able to run alone. One merged screen would shrink the map.
15. **Hidden outcomes?** Add "Tell players the outcome" (on by default) and "Roll behind the screen"; keep them for ambush Perception and pivotal Insight checks.
16. **Do spells spend slots by themselves?** Yes, with Undo; save spells still go through your results screen.
17. **Are resistances applied by themselves?** Yes, with no settings, and the feed says "resisted" or "immune" once it has happened.
18. **How does the story come in?** Paste plain text and tidy the scenes; typing works too; no PDF import before the stream.

## Appendix: how other online tables split the DM's controls

Researched by Fable on 26 October 2026.

- **D&D Beyond's Maps** put the turn order inside the map screen so the DM needn't change tabs, with hidden creatures, AC and HP visible only to the DM. DMs still keep a separate stat block window, because the tracker doesn't show stat blocks, roll attacks or edit monster HP. Many say they have to flick between screens, and some prefer the older Encounter Builder for fights without a map. The lesson: map, order, the acting creature's actions and HP editing must sit together. Sources: [D&D Beyond's launch post](https://www.dndbeyond.com/posts/1841-roll-for-initiative-combat-tracking-comes-to-the), [the Encounter Builder feedback thread](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/215302-encounter-builder-2024), [EN World](https://www.enworld.org/threads/ddb-maps-now-integrates-the-combat-tracker.708432/), [Arcane Eye](https://arcaneeye.com/articles/dnd-beyonds-maps-vtt-gets-a-huge-upgrade-encounter-tracking/).
- **Foundry VTT** keeps everything as sidebar tabs and lets the DM pop the combat tracker, sheets and notes out to a second monitor. DMs commonly run the map on the big monitor and reference on the other. Sources: [Foundry's combat docs](https://foundryvtt.com/article/combat/), [EN World on screen sizes](https://www.enworld.org/threads/vtt-what-size-screen-do-you-use.689995/).
- **Roll20** pops out chat, music and sheets but not the turn tracker, and users ask for the tracker and map on different monitors. A common split gives the map a whole monitor. Sources: [Roll20 forum](https://app.roll20.net/forum/permalink/8682682/), [Roll20 forum](https://app.roll20.net/forum/permalink/11609842).
- **Fantasy Grounds** gives the DM far more in its tracker than players see, and DMs find it cluttered in big fights. Source: [Fantasy Grounds wiki](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996641984), [forum](https://www.fantasygrounds.com/forums/archive/index.php/t-87559.html?login=1).
- **Owlbear Rodeo** is map first, with a small turn tracker on top. Source: [Owlbear docs](https://docs.owlbear.rodeo/extensions/examples/initiative-tracker).
- **Alchemy** is scene first with the map as a separate mode, and users find switching to it awkward. The lesson: don't bury the battle behind the story screen. Source: [r/VTT](https://www.reddit.com/r/VTT/comments/1kirqgz/alchemy_vtt_or_dndbeyond).
- **Dedicated trackers** ([Improved Initiative](https://improvedinitiative.app/), [Shieldmaiden](https://shieldmaiden.app/)) show a list beside a stat block for the DM, and a separate live list for players, streams or a TV. The lesson: the players' copy belongs on their screens and the overlay, not on the DM's second monitor.

Across them all: one monitor for what you operate (in a fight, the map and the tracker together) and one for reference and story.

## Appendix B: what DMs and players struggle with

Researched by Fable on 27 October 2026, in its own words with the sources linked.

- **Slow turns.** The usual fixes are showing the order so everyone knows who's "on deck", warning the next player early, and setting out options by action type rather than hunting through the sheet. New players ask for exactly that cheat sheet: movement, action, bonus action and the options for each. Trackers show whose turn it is, but none sets out a player's usable options for this turn; our filtered hand does. Sources: [D&D Beyond on slow combat](https://www.dndbeyond.com/forums/dungeons-dragons-discussion/dungeon-masters-only/115632-combat-is-to-slow), [Sly Flourish](https://slyflourish.com/tips_to_speed_up_combat.html), [r/DnD cheat sheet](https://www.reddit.com/r/DnD/comments/b24s8a/oc_cheat_sheet_for_new_players), [EN World](https://www.enworld.org/threads/oh-man-do-i-need-some-dm-tips.527187/).
- **Spent actions and reactions.** Players forget their reaction most of all and ask for trackers, but reminders in the wrong tone feel patronising. So track it quietly and show it as pips, without nagging. Sources: [D&D Beyond feedback](https://www.dndbeyond.com/forums/d-d-beyond-feedback/216121-character-builder-improvements/next), [EN World](https://www.enworld.org/posts/9983368/).
- **Spell slots, concentration and durations.** The concentration save after damage is the step tables miss most, and casters forget they're already concentrating. Prompting when damage lands, with the DC worked out, is what works. Durations are hardest on other creatures' turns, and Fantasy Grounds counts them down by itself while D&D Beyond's tracker doesn't. Sources: [EN World](https://www.enworld.org/threads/how-do-you-remember-concentration-duration-checks.679965/), [Foundry's Concentration Notifier](https://foundryvtt.com/packages/concentrationnotifier), [Roll20 forum](https://app.roll20.net/forum/permalink/12123508/), [Fantasy Grounds wiki](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996641040/Tracking+Conditions+and+Effects).
- **Damage types.** They're forgotten because they live only in the stat block. Foundry can apply them automatically, but with so many settings it's daunting. So apply them with no settings, and say so in the feed. Source: [midi-qol](https://www.foundryvtt-hub.com/package/midi-qol/).
- **The DM juggling.** Sly Flourish keeps short lists at hand (places with a few notable features, NPC names, monsters, secrets to drop in) and treats scenes as a loose framework, not a script. No online table keeps story notes beside the fight. Sources: [Sly Flourish, the eight steps at the table](https://slyflourish.com/using_the_8_steps_at_the_table.html), [Sly Flourish, eight steps 2023](https://slyflourish.com/eight_steps_2023.html).
- **Secret rolls.** DMs split on them, but most agree they're for pivotal Insight checks and ambush Perception checks, where a low number makes players act on what their characters don't know. Some tools still show the dice animation; ours judges on the server, so nothing leaks. Sources: [DM David](https://dmdavid.com/tag/tag/insight/), [EN World](https://www.enworld.org/threads/hidden-player-rolls.357477/), [Foundry dice docs](https://foundryvtt.com/article/dice/).
- **Streaming.** Viewers drift away during rule lookups and dead air, and combat is the slowest part. So anything that saves the DM a lookup mid-fight helps the stream too. Source: [Streamscheme](https://www.streamscheme.com/?p=23624).
