# C3 lite plan: conditions that wear off, and talk cards

Written 27 October 2026, after S1. **Waiting for Matt's approval** of decisions 72 to 83. It builds the "conditions counting down" and "Talk cards" parts of C3 lite in `COMBAT_PLAN.md` (sections 1 and 6). The spec also asks for this ("conditions show with durations that expire on their own"). Opportunity attacks and two-weapon fighting were built early, in C1b.

## In plain words

**Conditions that wear off.** When you put a condition on someone, you can say how long it lasts:
- until you take it off;
- until the end of their next turn;
- a number of rounds;
- until they make a save at the end of each turn;
- until the caster's concentration ends.

The table counts it down, rolls the saves (secretly for monsters), and takes it off when it ends. It tells everyone, for example "Goblin A is no longer frightened". Common spells and monster attacks fill all of this in for you with one click: Hold Person, a wolf's bite, a ghoul's claws. On their turn, players get a button to **Stand up** when they're prone, and to **Break free** when they're grabbed.

**Talk cards.** In a fight, a player can spend their action to **Persuade**, **Intimidate** or **Deceive**. They pick who they're talking to and type what they say. The table rolls the skill, and you get a card with what they said, the total and three buttons: **It works**, **Partly**, **It doesn't**. "It works" offers what happens next: the monsters **surrender**, **run away**, or you call a **parley**. A parley pauses the fight to talk, with a banner on everyone's screen, and **Back to the fight** carries on from the same turn.

## What's already there

- Conditions are a plain list on each character and monster. You add and remove them on the Encounter tab, and roll results can apply one to everyone who failed. Nothing counts them down.
- Rage and concentration spells already count down by rounds (timed effects). The plan uses the same idea for conditions.
- Concentration saves after damage, death saves, and the Unconscious condition at 0 hit points are already automatic.
- The server already knows every monster's six saving throws (stored secretly when the fight starts), so it can roll their saves without the numbers reaching players.
- Hide, Search, Help and Ready spend the action and say so in the feed, but roll nothing. That's unchanged here (see "What stays out").

## 1. Conditions that wear off (C3a)

**How long?** Wherever you add a condition (the Encounter tab, Battle screen, roll results), a small "How long?" choice appears under it:
- **Until I take it off** (the default, as now);
- **Until the end of their next turn**;
- **Rounds:** 1 to 10, with **1 minute** as a shortcut for 10;
- **Until they save:** the ability and DC, rolled at the end of each of their turns;
- **While [the caster] concentrates:** shown only when someone is concentrating.

You can combine a time with a save, as Hold Person does: up to a minute, a save each turn, and it ends with the caster's concentration.

**What everyone sees.** Chips say how long is left: "Paralysed · 3 rounds", "Frightened · saves each turn". A secret DC stays secret: players see "saves each turn", never the number (decision 74).

**Counting down.** Rounds come off as each creature's turn comes round, just as Rage works today. "Until the end of their next turn" ends as that turn ends. When something ends, it comes off with a line in the feed for everyone.

**Saves each turn:**
- **Monsters:** at the end of the monster's turn, the server rolls its save in secret. You see the roll; players see only "Goblin A shakes it off" or "is still paralysed".
- **Players:** at the end of their turn, a card asks "Roll a Wisdom save to shake off Paralysed". It's one click, and the table checks the total against the DC on the server.

**Concentration.** When a caster loses concentration (a failed save, a timer, dropping it, or being knocked out), every condition tied to that spell ends at once.

**When the fight ends,** a minute passes, as it does for Rage: anything with a minute or less left comes off. "Until I take it off" conditions stay. Outside a fight nothing counts down. Conditions stay until you take them off, and a long rest asks whether to clear what's left (decision 77).

**Buttons on the player's turn:**
- **Stand up** (when prone): takes Prone off and uses half their speed.
- **Break free** (when grappled or restrained): spends their action and rolls Athletics or Acrobatics, whichever is better, against the escape DC. That's the DC the monster's attack or the spell gave, or one you set when you added it.

**One click from spells and monster attacks.** A short list of the free rules' common causes, kept in the rules layer with tests, fills in the condition, how long, the save and the concentration link:
- **Spells:**
  - Hold Person (paralysed);
  - Command: grovel (prone);
  - Entangle (restrained);
  - Hideous Laughter (prone and incapacitated);
  - Charm Person (charmed);
  - Fear (frightened);
  - Blindness/Deafness (blinded or deafened);
  - Color Spray (blinded until the end of your next turn);
  - Web (restrained);
  - Sleep (unconscious, until damaged or woken).
- **Monster attacks:**
  - Wolf and mastiff bites (prone);
  - giant frog and constrictor snake (grappled);
  - ghoul claws (paralysed);
  - giant spider web (restrained);
  - a few more of the low-level SRD monsters.

After a failed save or a hit, the card offers **Apply Paralysed** with everything set, as one click. It is never applied silently (as `COMBAT_PLAN.md` decided).

**Monster traits that fire by themselves (decision 79).** **Undead Fortitude**: when a zombie drops to 0 hit points from damage that isn't radiant or a critical hit, the server rolls its Constitution save (DC 5 + the damage). On a pass it stays up with 1 hit point, and the feed says "Zombie A refuses to fall". The one-shot uses zombies twice, so this is worth doing now.

## 2. Talk cards (C3b)

**For players, on their turn:** a **Talk** row with **Persuade**, **Intimidate** and **Deceive**.
1. Pick who you're talking to: one creature, or everyone on their side.
2. Type what you say in a line (it's optional).
3. Press **Talk**. It spends your action and rolls the skill on the server, with your bonus and any advantage.

**For the DM, a card:** "Elowen tries to talk the goblins down. Persuasion 14. 'Drop your weapons and you can walk away.'", with **It works**, **Partly** and **It doesn't**. It sits with the other cards top right.
- **It works** opens three quick choices for the creatures she talked to:
  - **They surrender:** out of the turn order, greyed on the map, with "surrendered" on their chip;
  - **They run:** they leave the fight at the start of their next turn;
  - **Parley:** stop and talk.
  - Or **Just the words**, if you'd rather describe it.
- **Partly** and **It doesn't** put a line in the feed. You say the rest.
- **A hint for you:** creatures that can't be talked round say so on the card, for example "Zombies don't listen (Intelligence 3)". That covers mindless undead and beasts with Intelligence 3 or less. You can still choose any button.

**Parley (decision 81).** A **Parley** button on the Battle screen, and **It works** on a talk card, both pause the fight:
- the turn order freezes;
- everyone's screen shows a "Parley: talking, not fighting" banner;
- the stream overlay will show it too, once it exists;
- Ask for a roll works as usual (Insight, more Persuasion).

**Back to the fight** carries on from the same turn. **End the fight** finishes it if the talking settled things.

**Morale nudge (decision 82).** When a monster drops to a quarter of its hit points or less, or its leader falls, a quiet line in your feed suggests "Goblin A might run or beg". It's only a hint, and only you see it.

## Hidden means hidden

- Monster saves, their bonuses and secret DCs stay on the server. Players only see whether a condition held.
- Talk cards show players their own total. The DM's outcome reaches players only as the feed line you choose.
- A surrendered or fleeing monster's hit points stay secret as before.
- Enforced in row-level security and server functions, as for rolls today.

## How it's built

- **Data:**
  - `combatants.condition_clocks` (a list per creature in the fight: the condition, rounds left, whether it ends at the start or end of a turn, the save's ability and DC, the caster and spell it's tied to);
  - `combatants.stance` (fighting, surrendered or fled);
  - `encounters.parley` (on or off).
- **Server:**
  - `set_condition` (add or remove a condition with its clock; DM only; it can be undone);
  - the countdown and end-of-turn saves inside the existing turn functions;
  - `condition_save` (a player's save to shake one off);
  - `break_free` and `stand_up`;
  - `talk` (spends the action, rolls the skill, posts the card);
  - `answer_talk`, `set_stance`, `set_parley`;
  - Undead Fortitude inside `apply_damage`.
- **Rules (pure functions with unit tests):**
  - durations and when they tick;
  - the spell and monster-attack list;
  - escape DCs;
  - who can be talked to;
  - the morale threshold.
- **Free plan:** small rows, no new storage. Banners and cards travel on the realtime changes already in use.
- **Tests:**
  - pgTAP for each server function, including that players can't read a monster's save or a secret DC, and can't set conditions;
  - unit tests for the rules;
  - preview browser tests for a Hold Person that ends with concentration, a player standing up, and a talk card that ends in a parley.

## Milestones (each ends with something to try)

| | What | You can try |
|---|---|---|
| **C3a** | How long, countdowns, saves each turn, concentration links, Stand up and Break free, one-click conditions from spells and attacks, Undead Fortitude | Cast Hold Person on a goblin: it saves each turn, and it ends when the caster is hit and loses concentration |
| **C3b** | Talk cards, It works / Partly / It doesn't, surrender and run, Parley, the morale nudge | Talk two goblins into surrendering mid-fight, then parley with their boss |

Previews will be `#/dev/battle` (the DM) and `#/dev/table/fight` (a player), with new variants for a paralysed goblin and a talk card. Each milestone gets a line in `PROGRESS.md`.

## Decisions for Matt (recommendations first)

72. **How long?** appears whenever you add a condition, with **Until I take it off** as the default so nothing changes unless you choose. *Recommended.* Or ask every time.
73. **Saves each turn are rolled for you:** monsters by the server in secret, players with a one-click card at the end of their turn. *Recommended.* Or you roll them by hand.
74. **Players see time left but not secret DCs** ("saves each turn"). *Recommended.* Or show DCs too, when the DM hasn't marked them secret.
75. **Concentration links:** conditions from a concentration spell end when the caster's concentration does. *Recommended.*
76. **Stand up and Break free** buttons for players on their turn. *Recommended.*
77. **Outside a fight nothing counts down;** a long rest asks whether to clear what's left. *Recommended.* Or a long rest clears everything by itself.
78. **One click from spells and monster attacks,** from a short tested list of the common free-rules causes, always offered, never applied silently. *Recommended.* Or keep adding conditions by hand.
79. **Undead Fortitude happens by itself** (rolled by the server, shown in your feed). *Recommended.* Or a prompt for you to roll.
80. **Talk cards for players:** Persuade, Intimidate, Deceive, spending the action, with **It works / Partly / It doesn't** for you. *Recommended.*
81. **Parley pauses the fight** for everyone, with a banner, and carries on from the same turn. *Recommended.* Or parley is only a line in the feed.
82. **The morale nudge** in your feed when a monster is badly hurt or its leader falls. *Recommended.* Or leave it out.
83. **The order:** C3a then C3b, both before the one-shot on 21 to 22 November, since there's time. *Recommended.* Or C3b first.

## What stays out (for now)

- Condition icons. Chips are words and time left for now; icons from game-icons.net can come with the stream overlay, which needs them most.
- Hide that makes you unseen, Help that grants advantage, and Ready that fires on a trigger. They still spend the action and say so; you rule on them.
- Locks and traps (decision 50 left them here). **Ask for a roll** with a DC covers them well enough for the one-shot.
- Exhaustion levels counting down by themselves. The Rest dialog already takes a level off.
- Grapples dragging a creature along, and mounted or underwater combat.

## Waiting on Matt

- **Approve the plan**, or change any of decisions 72 to 83.
