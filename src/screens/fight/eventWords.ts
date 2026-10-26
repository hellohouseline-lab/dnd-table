// What happened in a fight, in plain words: "Thorin hits Goblin A with Longsword for 8." Names come
// from each screen (real names for the DM, what players know for players), and "you" for yourself.

import type { CombatEvent } from '../../live/combat.ts'

type Names = {
  /** The name to show for a combatant on this screen. */
  nameOf: (combatantId: string | null) => string
  /** Your own combatant, so the feed says "You hit" rather than your character's name. */
  youId?: string | null
}

const ACTIONS: Record<string, [string, string]> = {
  dash: ['dashes', 'dash'],
  disengage: ['disengages', 'disengage'],
  dodge: ['takes the Dodge action', 'take the Dodge action'],
  action: ['uses their action', 'use your action'],
  bonus: ['uses their bonus action', 'use your bonus action'],
  reaction: ['uses their reaction', 'use your reaction'],
}

export function eventWords(event: CombatEvent, { nameOf, youId = null }: Names): string {
  const you = event.actorId !== null && event.actorId === youId
  const actor = you ? 'You' : nameOf(event.actorId)
  const verb = (they: string, yourself: string) => (you ? yourself : they)

  if (event.kind === 'action') {
    const [they, yourself] = ACTIONS[event.shown.what ?? 'action'] ?? ACTIONS.action
    return `${actor} ${verb(they, yourself)}.`
  }

  const targetIsYou = event.targetId !== null && event.targetId === youId
  const target = targetIsYou ? 'you' : nameOf(event.targetId)
  const weapon = event.shown.label ? ` with ${event.shown.label}` : ''
  const rolled = typeof event.shown.total === 'number' ? ` (rolled ${event.shown.total})` : ''
  if (!event.shown.hit) return `${actor} ${verb('misses', 'miss')} ${target}${weapon}${rolled}.`

  const damage = event.shown.damage ?? 0
  const type = event.shown.damageType ? ` ${event.shown.damageType}` : ''
  const amount = damage > 0 ? ` for ${damage}${type}` : ''
  const adjusted =
    event.shown.adjust === 'resisted'
      ? ' (resisted, so halved)'
      : event.shown.adjust === 'vulnerable'
        ? ' (vulnerable, so doubled)'
        : ''
  const critical = event.shown.critical ? ' A critical hit!' : ''
  const down = event.shown.down ? ` ${targetIsYou ? 'You go' : `${target} goes`} down.` : ''
  if (event.shown.adjust === 'immune') {
    const immune = targetIsYou ? 'You are' : `${target} is`
    return `${actor} ${verb('hits', 'hit')} ${target}${weapon}${rolled}, but ${immune} immune to${type || ' it'}.${critical}`
  }
  return `${actor} ${verb('hits', 'hit')} ${target}${weapon}${amount}${adjusted}${rolled}.${critical}${down}`
}
