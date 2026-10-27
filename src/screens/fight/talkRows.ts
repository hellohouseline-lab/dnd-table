// Talk on the DM's screens (C3b): the talk cards waiting for an answer, who on a card can't be
// talked round, and the quiet morale nudge.

import type { CombatEvent } from '../../live/combat.ts'
import type { SrdMonster } from '../../rules/srd/index.ts'
import { deafHint, moraleHints, type MoraleHint } from '../../rules/talk.ts'
import type { FightRow } from './fightRows.ts'

/** Talk cards still waiting for the DM: a player's words with no answer yet (an undone answer doesn't count). */
export function waitingTalks(events: CombatEvent[]): CombatEvent[] {
  return events.filter(
    (e) =>
      e.kind === 'talk' && e.shown.talk && !e.undone && !events.some((a) => !a.undone && a.shown.answerTo === e.id),
  )
}

function monsterOf(row: FightRow | undefined, monsters: SrdMonster[] | null): SrdMonster | undefined {
  return row?.secret?.monster ? monsters?.find((m) => m.index === row.secret?.monster) : undefined
}

/** For a card: the creatures it's for that can't be talked round ("Zombie A doesn't listen"). */
export function deafOnCard(event: CombatEvent, rows: FightRow[], monsters: SrdMonster[] | null): string[] {
  return (event.shown.targets ?? []).flatMap((id) => {
    const row = rows.find((r) => r.combatant.id === id)
    const monster = monsterOf(row, monsters)
    const hint = monster && row ? deafHint({ ...monster, name: row.name }) : null
    return hint ? [hint] : []
  })
}

/** The DM's morale nudge for the monsters in this fight. */
export function moraleFor(rows: FightRow[], monsters: SrdMonster[] | null): MoraleHint[] {
  return moraleHints(
    rows
      .filter((r) => r.combatant.kind === 'monster')
      .map((r) => {
        const monster = monsterOf(r, monsters)
        return {
          id: r.combatant.id,
          name: r.name,
          health: r.combatant.health,
          stance: r.combatant.stance,
          cr: monster?.cr ?? null,
          listens: !monster || deafHint(monster) === null,
        }
      }),
  )
}
