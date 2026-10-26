# Combat and characters rework: the plan

Written 26 October 2026, after Matt's first combat test. The UX was planned with Fable and checked against the code and the SRD data. Nothing here is built yet; it waits for Matt's approval. Sections 1 to 4 are plain words; section 5 is technical; sections 6 and 7 are the order of work and the decisions.

## In plain words

Matt's test found one real bug and a lot of hand work the app should be doing.

**Already fixed and live (26 October).** When the DM started a fight, a player's screen could throw away fighters that arrived while it was still loading, so the player had no place in the turn order, no Roll initiative prompt and no working End turn. New monsters' real names also didn't reach the DM's other screen. Both are fixed; each screen now loads the whole fight once a burst of changes settles. Not yet checked with a real player signed in.

**The rest is hand work.** Today the DM picks a map on Screen 2, switches to it, presses Add the party and Place the monsters, and switches screens to see the map; players tick their own action boxes; nothing targets anything; damage is typed in; and characters are typed in rather than built.

**The rework turns a fight into a guided loop.** The DM presses Start combat and the app asks which map (or none), puts everyone's miniature on it, rolls the monsters' initiative and asks the players for theirs. On your turn your screen says "Your turn", shows cards for everything you can do right now, greys out what you've used, and counts down your movement as you drag your miniature. Attacking is two clicks: the card, then the target. The server rolls, checks the hit against the target's armour class (a monster's stays secret), takes the damage off, and tells everyone who was hit and for how much. The DM gets an Undo for anything. A monster's turn is the same two clicks for the DM. Characters are built in a step-by-step wizard with standard array, point buy, rolled or "random but balanced" scores, starting gear from the rules, and spells from a list.

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

**The DM sees** (Encounter tab, design 10):
- The turn order, with four small pips on the acting row: action, bonus, reaction and movement left.
- The Acting now card, and the same feed with real names and numbers.
- **Undo** for the last thing that happened.
- The battle map (section 3).

On a player's turn the card says "Elowen acts from her screen", with **Act for her** for someone who has stepped away.

**A monster's turn in two clicks.** The Acting now card lists its SRD actions. Click one (or press its number), then click a target. The server rolls to hit against the character's AC, takes the damage off and posts it.
- **Multiattack:** shows as "Attack ×2", so both rolls go in one click.
- **Actions with a saving throw:** open Ask for a roll already filled in with the ability and DC, and the results screen's "damage those who failed, half to those who passed" applies it.
- **Traits** such as Nimble Escape show as a reminder line.

**Keyboard:** N next turn, 1 to 9 pick an action or a target, U undo, R reveal the name. M is already mute.

## 2. Targeting and what's automatic

**One server function settles an attack.** It throws the dice the fair way it does today, reads the target's AC, and decides hit or miss: a natural 20 always hits, a natural 1 always misses, otherwise the total against the AC. Then it applies the damage:
- **Temporary hit points first.**
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

**Who moves what.** The DM drags anything, any time. A player drags their own miniature on their turn, only as far as their movement left (plus Dash). The server refuses a longer move, so the limit is real. The "Players move their own tokens" switch stays, to turn that off. Hands and double-click pings stay for pointing. New: on someone else's turn a player can draw a suggested path, and the DM sees it with **Move them there** (one click).

**The map wherever the DM is.** Design 10 drew Screen 1 without a map, which is why it seemed to vanish when switching screens. The Encounter tab gets a map panel under the turn order (about 540 by 300, zoomable, with all the tokens and targeting), so the DM can run a whole fight from Screen 1. Screen 2 keeps the big map for lining up the grid and hiding tokens.

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
- **Encounter tab:** turn pips, an action then a target, the feed with Undo, the map panel, Act for them, shortcuts.
- **Start combat:** the Where step.
- **Stage:** the Quick map painter and suggested paths.
- **Characters:** `CharacterWizard`, and an item search on the Sheet tab.

**Free plan:** events are small rows, hands stay throttled, quick maps are tiny, no new storage.

## 6. Order of work

Each step ends in something Matt can open and try, like the milestones so far.

| When | Step | Matt can try | Size |
| --- | --- | --- | --- |
| 27 Oct to 2 Nov | **C1. The turn loop.** Turn record and functions, cards that spend actions, movement limit, map chosen and miniatures placed on Start combat, map panel on Screen 1, attacks that hit and take damage off (weapons and monster attacks) with Undo | A two-goblin fight run from Screen 1 only: click a goblin to attack it, get hit back, End turn works | About 5 days |
| 3 to 8 Nov | **C2. The character builder.** Wizard, the four ways to make scores, starting gear with AC from armour, spells list, item search, hand built from the sheet, SRD equipment import | Players build their one-shot characters a fortnight early | About 5 days |
| 9 to 15 Nov | **C3. The full rules.** Standard actions, Talk cards, opportunity attacks, two-weapon fighting, concentration, death saves, resistances, the feed and toasts, Quick map, shortcuts | A full fight with a caster, a character going down and a parley | About 5 days |
| 16 to 20 Nov | Spare days, then a dry run with the group | | |
| 21 to 22 Nov | **Test one-shot** | | |
| 23 to 29 Nov | **8. Stream overlay**, as planned; the feed and turn record feed its toasts and turn panel | | About 5 days |
| 30 Nov to 4 Dec | **9. Rehearsal fixes** | | |
| 5 to 6 Dec | **First stream** | | |

This moves the overlay after the test one-shot. Every streamer then has about a week to set up OBS rather than most of November, so the OBS steps should go out the moment milestone 8 lands.

**If time runs short, cut in this order:**
1. The map generator (not in Phase 1 anyway).
2. The Quick map painter (uploads only).
3. Suggested paths (pings only).
4. Ready and Help (log lines only).
5. The shop (the DM gives items).
6. Spells beyond attack and save spells: a plain "Cast" card spends the slot and logs it.
7. Character resistances.
8. Legendary actions.

Don't cut C1, the wizard's scores and gear, or Undo.

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
