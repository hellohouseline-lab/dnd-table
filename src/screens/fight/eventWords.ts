// What happened in a fight, in plain words: "Thorin hits Goblin A with Longsword for 8." Names come
// from each screen (real names for the DM, what players know for players), and "you" for yourself.

import type { CombatEvent } from '../../live/combat.ts'
import { CONDITION_WORD } from '../../rules/conditionClocks.ts'
import { ABILITY_NAME, type Ability } from '../../rules/abilities.ts'
import { namesText } from '../../rules/askable.ts'
import { talkSkill } from '../../rules/talk.ts'

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
  hide: ['tries to hide', 'try to hide'],
  help: ['helps an ally', 'help an ally'],
  search: ['searches', 'search'],
  ready: ['readies an action', 'ready an action'],
  object: ['uses an object', 'use an object'],
  bonus_dash: ['dashes (bonus action)', 'dash (bonus action)'],
  bonus_disengage: ['disengages (bonus action)', 'disengage (bonus action)'],
  bonus_hide: ['tries to hide (bonus action)', 'try to hide (bonus action)'],
  bonus_dodge: ['takes the Dodge action (bonus action)', 'take the Dodge action (bonus action)'],
}

export function eventWords(event: CombatEvent, { nameOf, youId = null }: Names): string {
  const you = event.actorId !== null && event.actorId === youId
  const actor = you ? 'You' : nameOf(event.actorId)
  const verb = (they: string, yourself: string) => (you ? yourself : they)

  if (event.kind === 'action' && event.shown.what === 'item') {
    const item = event.shown.item ?? 'an item'
    const other = event.targetId !== null && event.targetId !== event.actorId
    const target = other ? (event.targetId === youId ? 'you' : nameOf(event.targetId)) : null
    if (typeof event.shown.heal === 'number') {
      return other
        ? `${actor} ${verb('gives', 'give')} ${target} a ${item}: ${event.shown.heal} hit points back.`
        : `${actor} ${verb('drinks', 'drink')} a ${item}: ${event.shown.heal} hit points back.`
    }
    if (event.shown.stabilised) return `${actor} ${verb('steadies', 'steady')} ${target ?? 'someone'} with a ${item}.`
    if (event.shown.scattered) return `${actor} ${verb('scatters', 'scatter')} ${item.toLowerCase()}.`
    return `${actor} ${verb('uses', 'use')} ${item}.`
  }

  if (event.kind === 'action' && event.shown.feature) {
    return `${actor} ${verb('uses', 'use')} ${event.shown.feature}.`
  }

  if (event.kind === 'action') {
    const [they, yourself] = ACTIONS[event.shown.what ?? 'action'] ?? ACTIONS.action
    return `${actor} ${verb(they, yourself)}.`
  }

  if (event.kind === 'death_save') {
    const rolled = typeof event.shown.rolled === 'number' ? ` (rolled ${event.shown.rolled})` : ''
    const count = `${event.shown.successes ?? 0} of 3 successes, ${event.shown.failures ?? 0} of 3 failures`
    switch (event.shown.result) {
      case 'awake':
        return `${actor} ${verb('rolls', 'roll')} a 20 on a death save and ${verb('is', 'are')} back up with 1 hit point!`
      case 'stable':
        return `${actor} ${verb('succeeds', 'succeed')} on a third death save${rolled} and ${verb('is', 'are')} stable.`
      case 'dead':
        return `${actor} ${verb('fails', 'fail')} a third death save${rolled}. ${you ? 'Your character dies.' : `${actor} dies.`}`
      case 'success':
        return `${actor} ${verb('succeeds', 'succeed')} on a death save${rolled}: ${count}.`
      default:
        return `${actor} ${verb('fails', 'fail')} a death save${rolled}: ${count}.`
    }
  }

  if (event.kind === 'concentration') {
    const spell = event.shown.spell ?? 'the spell'
    const rolled =
      typeof event.shown.total === 'number' ? ` (rolled ${event.shown.total} against DC ${event.shown.dc})` : ''
    return event.shown.kept
      ? `${actor} ${verb('keeps', 'keep')} concentrating on ${spell}${rolled}.`
      : `${actor} ${verb('loses', 'lose')} concentration, and ${spell} ends${rolled}.`
  }

  if (event.kind === 'condition') return conditionWords(event, actor, verb, you)
  if (event.kind === 'talk') return talkWords(event, { nameOf, youId }, actor, verb, you)

  const targetIsYou = event.targetId !== null && event.targetId === youId
  const target = targetIsYou ? 'you' : nameOf(event.targetId)

  // A spell that isn't an attack roll: a saving throw, damage that just lands, healing, or nothing to roll.
  if (event.kind === 'spell' && !event.shown.attack) {
    const spell = event.shown.spell ?? 'a spell'
    const whose = you ? `Your ${spell}` : `${actor}'s ${spell}`
    const damage = event.shown.damage ?? 0
    const type = event.shown.damageType ? ` ${event.shown.damageType}` : ''
    const adjusted =
      event.shown.adjust === 'resisted'
        ? ' (resisted, so halved)'
        : event.shown.adjust === 'vulnerable'
          ? ' (vulnerable, so doubled)'
          : event.shown.adjust === 'immune'
            ? ' (immune)'
            : ''
    const down = event.shown.down ? ` ${targetIsYou ? 'You go' : `${target} goes`} down.` : ''
    const takes = (they: string) =>
      damage > 0 ? ` and ${they} ${damage}${type}${adjusted}` : event.shown.damage === 0 ? ` and ${they} nothing` : ''
    if (event.targetId === null) return `${actor} ${verb('casts', 'cast')} ${spell}.`
    if (event.shown.save) {
      const rolled = typeof event.shown.saveTotal === 'number' ? ` (rolled ${event.shown.saveTotal})` : ''
      const outcome =
        event.shown.save === 'passed'
          ? `${targetIsYou ? 'You make' : `${target} makes`} the save against ${spell}${rolled}`
          : `${targetIsYou ? 'You fail' : `${target} fails`} the save against ${spell}${rolled}`
      return `${outcome}${takes(targetIsYou ? 'take' : 'takes')}.${down}`
    }
    if (typeof event.shown.heal === 'number') return `${whose} heals ${target} for ${event.shown.heal}.`
    if (event.shown.damage !== null && event.shown.damage !== undefined) {
      return `${whose} hits ${target} for ${damage}${type}${adjusted}.${down}`
    }
    return `${actor} ${verb('casts', 'cast')} ${spell} on ${target}.`
  }
  // An opportunity attack, made with the reaction as the target moves away.
  const weapon =
    (event.shown.label ? ` with ${event.shown.label}` : '') + (event.shown.reaction ? ' as they move away' : '')
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
  const down = event.shown.down
    ? ` ${targetIsYou ? 'You go' : `${target} goes`} down.`
    : event.shown.fortitude
      ? ` ${target} refuses to fall!`
      : ''
  if (event.shown.adjust === 'immune') {
    const immune = targetIsYou ? 'You are' : `${target} is`
    return `${actor} ${verb('hits', 'hit')} ${target}${weapon}${rolled}, but ${immune} immune to${type || ' it'}.${critical}`
  }
  return `${actor} ${verb('hits', 'hit')} ${target}${weapon}${amount}${adjusted}${rolled}.${critical}${down}`
}

/** A condition put on, taken off, worn off, saved against, stood up from or broken free of (C3a). */
function conditionWords(
  event: CombatEvent,
  actor: string,
  verb: (they: string, yourself: string) => string,
  you: boolean,
): string {
  const shown = event.shown
  const word = (CONDITION_WORD[shown.condition ?? ''] ?? shown.condition ?? 'a condition').toLowerCase()
  const save = (ability?: string | null) => (ability ? `${ABILITY_NAME[ability as Ability] ?? ability} save` : 'save')
  const rolled = typeof shown.total === 'number' ? ` (rolled ${shown.total})` : ''
  const is = verb('is', 'are')

  if (shown.stood) return `${actor} ${verb('stands', 'stand')} up (${shown.feet ?? 0} feet of movement).`
  if (shown.brokeFree !== undefined) {
    return shown.brokeFree
      ? `${actor} ${verb('breaks', 'break')} free${rolled}.`
      : `${actor} ${verb('struggles', 'struggle')} but can't break free${rolled}.`
  }
  if (shown.saved !== undefined) {
    return shown.saved
      ? `${actor} ${verb('shakes', 'shake')} off being ${word}${rolled}.`
      : `${actor} ${is} still ${word}${rolled}.`
  }
  if (shown.still) return `${actor} ${is} still ${word}.`
  if (shown.ended === 'saved') return `${actor} ${verb('shakes', 'shake')} off being ${word}.`
  if (shown.ended === 'concentration')
    return `${actor} ${is} no longer ${word}: ${shown.spell ?? 'the spell'} has ended.`
  if (shown.ended === 'time') return `${actor} ${is} no longer ${word}.`
  if (shown.on === false) return `${actor} ${is} no longer ${word}.`
  if (shown.resisted)
    return `${actor} ${verb('makes', 'make')} the ${save(shown.saveAbility)} and ${is} not ${word}${rolled}.`

  const failed = shown.resisted === false ? `${verb('fails', 'fail')} the ${save(shown.saveAbility)}${rolled} and ` : ''
  const how = [
    shown.endOfNextTurn ? `until the end of ${you ? 'your' : 'their'} next turn` : '',
    shown.rounds ? `for ${shown.rounds === 1 ? '1 round' : `${shown.rounds} rounds`}` : '',
    shown.saveEachTurn ? `with a ${save(shown.saveEachTurn)} each turn` : '',
    shown.spell ? `while ${shown.spell} lasts` : '',
  ]
    .filter(Boolean)
    .join(', ')
  return `${actor} ${failed}${is} now ${word}${how ? ` ${how}` : ''}.`
}

/** Talk (C3b): a player's words, the DM's answer, a monster giving up or running, a parley. */
function talkWords(
  event: CombatEvent,
  { nameOf, youId }: Names,
  actor: string,
  verb: (they: string, yourself: string) => string,
  you: boolean,
): string {
  const { shown } = event
  const who = (ids: string[] | undefined) =>
    namesText((ids ?? []).map((id) => (id === youId ? 'you' : nameOf(id)))) || 'no one'
  if (typeof shown.parley === 'boolean') {
    return shown.parley ? 'Parley: the fight stops so everyone can talk.' : 'Back to the fight.'
  }
  if (shown.stance) {
    const them = nameOf(event.actorId)
    switch (shown.stance) {
      case 'surrendered':
        return `${them} surrenders.`
      case 'running':
        return `${them} turns to run.`
      case 'fled':
        return `${them} runs away and is out of the fight.`
      default:
        return `${them} fights on.`
    }
  }
  if (shown.answer) {
    const whose = you ? 'Your words' : `${actor}'s words`
    if (shown.answer === 'partly') return `${whose} partly work.`
    if (shown.answer === 'fails') return `${whose} don't work.`
    const them = who(shown.targets)
    switch (shown.outcome) {
      case 'surrender':
        return `${whose} work: ${them} ${shown.targets?.length === 1 ? 'surrenders' : 'surrender'}.`
      case 'run':
        return `${whose} work: ${them} ${shown.targets?.length === 1 ? 'turns' : 'turn'} to run.`
      case 'parley':
        return `${whose} work: the fight stops so everyone can talk.`
      default:
        return `${whose} work.`
    }
  }
  const skill = talkSkill(shown.talk)
  const words = shown.words ? `: ‘${shown.words}’` : ''
  const rolled = typeof shown.total === 'number' ? ` (${skill?.word ?? 'check'} ${shown.total})` : ''
  return `${actor} ${verb('tries', 'try')} to ${(skill?.verb ?? 'talk to').toLowerCase()} ${who(shown.targets)}${words}${rolled}.`
}
