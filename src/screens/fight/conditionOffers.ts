// One click from spells and monster attacks (C3a, decision 78): after a failed save against Hold
// Person, or a wolf's bite that hits, the DM's feed offers the condition with how long, the save
// each turn, the concentration link and the escape DC filled in. Never applied by itself.

import type { CombatEvent, Combatant, CombatantSecret } from '../../live/combat.ts'
import {
  causeClock,
  monsterAttackCause,
  spellCauseByName,
  type ClockChoice,
  type ConditionCause,
} from '../../rules/conditionClocks.ts'
import type { Ability } from '../../rules/abilities.ts'
import type { SrdMonster } from '../../rules/srd/index.ts'
import type { FightControls } from '../../live/useFight.ts'

export type ConditionOffer = {
  label: string
  target: Combatant
  /** Each condition with its clock (a giant frog's bite: grappled with its escape DC, and restrained). */
  conditions: { condition: string; choice: ClockChoice }[]
  /** A save the target makes first (a wolf's bite: Strength DC 11), rolled by the server. */
  resist: { ability: Ability; dc: number } | null
}

type FightLike = { combatants: Combatant[]; secrets: CombatantSecret[] }

/** What the feed line could put on, if anything, and only if the target hasn't got it all already. */
export function conditionOffer(
  event: CombatEvent,
  fight: FightLike,
  monsters: SrdMonster[] | null,
  conditionsOf: (combatant: Combatant) => string[],
): ConditionOffer | null {
  if (event.undone || !event.targetId) return null
  const target = fight.combatants.find((c) => c.id === event.targetId)
  const actor = fight.combatants.find((c) => c.id === event.actorId)
  if (!target || !actor) return null

  let cause: ConditionCause | null = null
  let dc: number | null = null
  let caster: { characterId: string; spell: string } | null = null
  if (event.kind === 'spell' && event.shown.save === 'failed' && event.shown.spell) {
    cause = spellCauseByName(event.shown.spell)
    dc = event.shown.dc ?? null
    caster = actor.characterId ? { characterId: actor.characterId, spell: event.shown.spell } : null
  } else if (event.kind === 'attack' && event.shown.hit && actor.kind === 'monster' && event.shown.label) {
    const index = fight.secrets.find((s) => s.combatantId === actor.id)?.monster
    const monster = monsters?.find((m) => m.index === index)
    cause = monster ? monsterAttackCause(monster, event.shown.label) : null
  }
  if (!cause) return null
  const has = conditionsOf(target)
  if (cause.conditions.every((c) => has.includes(c))) return null
  return {
    label: cause.resist ? `${cause.label} (save first)` : cause.label,
    target,
    conditions: cause.conditions
      .filter((c) => !has.includes(c))
      .map((condition) => ({ condition, choice: causeClock(cause, condition, { dc, caster }) })),
    resist: cause.resist,
  }
}

/** The feed's offer for each line, for the DM's screens: one click puts the conditions on. */
export function offersFor(
  fight: FightLike,
  monsters: SrdMonster[] | null,
  rows: { combatant: Combatant; conditions: string[] }[],
  setCondition: FightControls['setCondition'],
): (event: CombatEvent) => { label: string; onApply: () => void } | null {
  const conditionsOf = (c: Combatant) => rows.find((r) => r.combatant.id === c.id)?.conditions ?? c.conditions
  return (event) => {
    const offer = conditionOffer(event, fight, monsters, conditionsOf)
    if (!offer) return null
    return {
      label: offer.label,
      onApply: () => {
        for (const { condition, choice } of offer.conditions) {
          void setCondition(offer.target, condition, true, choice, offer.resist).catch(() => undefined)
        }
      },
    }
  }
}
