// Play as the monsters (P1c): a monster's stat block as a hand of cards, like a player's. Attacks
// go at one target; abilities with a save (a dragon's breath) catch several, in an area on the map
// or picked by hand; anything else is used and named in the feed.

import type { Ability } from './abilities.ts'
import { isAttack } from './combat.ts'
import { parseDamage, type DiceGroup } from './dice.ts'
import { monsterBonusActions } from './monsterBonus.ts'
import type { AreaShape } from './areas.ts'
import type { SrdMonster, SrdMonsterAction } from './srd/index.ts'

/** What a card spends: its action, bonus action or reaction, or one of its legendary actions (none of its turn). */
export type CardCost = 'action' | 'bonus' | 'reaction' | 'legendary'

/** Where an ability with a save lands: a shape put on the map, or everyone near the monster. */
export type AbilityReach =
  | { kind: 'area'; shape: AreaShape; sizeFt: number; fromSelf: boolean }
  | { kind: 'around'; feet: number; choice: boolean }
  | { kind: 'pick' }

export type SaveAbility = {
  name: string
  save: Ability
  dc: number
  /** On a successful save: half the damage, or none. */
  dcSuccess: 'half' | 'none'
  damage: { dice: DiceGroup[]; modifier: number } | null
  damageType: string
  reach: AbilityReach
}

export type MonsterCard =
  | { key: string; kind: 'attack'; name: string; cost: CardCost; action: SrdMonsterAction; recharge: string | null }
  | {
      key: string
      kind: 'save'
      name: string
      cost: CardCost
      ability: SaveAbility
      recharge: string | null
      desc: string
    }
  | { key: string; kind: 'other'; name: string; cost: CardCost; desc: string; recharge: string | null }

const SHAPES: Record<string, AreaShape> = {
  cone: 'cone',
  line: 'line',
  cube: 'cube',
  sphere: 'sphere',
  radius: 'sphere',
  cylinder: 'cylinder',
}

/** Where it lands, from its description: "a 60-foot line", "within 10 ft. of the dragon", or picked by hand. */
export function abilityReach(desc: string): AbilityReach {
  const text = desc.replace(/\s+/g, ' ')
  const shape = /\b(\d+)-foot[- ](cone|line|cube|sphere|radius|cylinder)\b/i.exec(text)
  if (shape) {
    const kind = SHAPES[shape[2].toLowerCase()]
    // A cone or line comes out of the monster; a sphere it breathes or exhales is centred on it.
    const fromSelf = kind === 'cone' || kind === 'line' || /\b(?:exhales|centered on (?:it|the \w+)self)\b/i.test(text)
    return { kind: 'area', shape: kind, sizeFt: Number(shape[1]), fromSelf }
  }
  const around = /\bwithin (\d+) (?:feet|ft\.?) of (?:it|the [\w ]+?)\b/i.exec(text)
  if (around) return { kind: 'around', feet: Number(around[1]), choice: /\b(?:its|\w+'s) choice\b/i.test(text) }
  return { kind: 'pick' }
}

/** "Recharge 5–6", "Recharges after a Short or Long Rest", from the name, or null. */
export function rechargeOf(name: string): string | null {
  const found = /\((recharge[^)]*|\d+\/day)\)/i.exec(name)
  return found ? found[1].replace(/-/g, '–').replace(/^recharge/i, 'Recharge') : null
}

/** The name without its brackets: "Acid Breath (Recharge 5-6)" is Acid Breath. */
export function plainName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
}

/** An ability with a save, ready for the server; null for anything without a DC. */
export function saveAbility(action: SrdMonsterAction): SaveAbility | null {
  if (!action.dc) return null
  const dice = action.damage.map((d) => d.dice).join('+')
  const parsed = dice ? parseDamage(dice) : null
  return {
    name: plainName(action.name),
    save: action.dc.ability,
    dc: action.dc.value,
    dcSuccess: action.dc.success === 'half' || /\bhalf as much damage\b/i.test(action.desc) ? 'half' : 'none',
    damage: parsed && parsed.dice.length > 0 ? { dice: parsed.dice, modifier: parsed.bonus } : null,
    damageType: action.damage[0]?.type ?? '',
    reach: abilityReach(action.desc),
  }
}

function cardFor(action: SrdMonsterAction, cost: CardCost, key: string): MonsterCard {
  const recharge = rechargeOf(action.name)
  if (isAttack(action)) return { key, kind: 'attack', name: action.name, cost, action, recharge }
  const ability = saveAbility(action)
  if (ability) return { key, kind: 'save', name: ability.name, cost, ability, recharge, desc: action.desc }
  return { key, kind: 'other', name: plainName(action.name), cost, desc: action.desc, recharge }
}

/**
 * The monster's hand: its attacks and abilities (not Multiattack, which is how many attacks its
 * action gives), its bonus-action attacks, its legendary actions and its reactions. A legendary
 * action that says it makes one of its attacks ("The dragon makes a tail attack") is that attack.
 */
export function monsterCards(
  monster: Pick<SrdMonster, 'actions' | 'legendary' | 'reactions' | 'traits'>,
): MonsterCard[] {
  const cards: MonsterCard[] = []
  for (const action of monster.actions) {
    if (/^multiattack$/i.test(action.name)) continue
    cards.push(cardFor(action, 'action', `action:${action.name}`))
  }
  for (const bonus of monsterBonusActions(monster)) {
    const attack = bonus.attack ? monster.actions.find((a) => a.name === bonus.attack) : undefined
    if (attack)
      cards.push({ ...cardFor(attack, 'bonus', `bonus:${bonus.name}`), name: `${bonus.name}: ${attack.name}` })
  }
  for (const legendary of monster.legendary ?? []) {
    const asAttack = monster.actions.find((a) => isAttack(a) && new RegExp(`\\b${a.name}\\b`, 'i').test(legendary.desc))
    const card =
      !isAttack(legendary) && !legendary.dc && asAttack
        ? { ...cardFor(asAttack, 'legendary', `legendary:${legendary.name}`), name: plainName(legendary.name) }
        : cardFor(legendary, 'legendary', `legendary:${legendary.name}`)
    cards.push(card)
  }
  for (const reaction of monster.reactions ?? []) cards.push(cardFor(reaction, 'reaction', `reaction:${reaction.name}`))
  return cards
}

/** "Multiattack: The goblin makes two attacks", for the panel, or null. */
export function multiattackText(monster: Pick<SrdMonster, 'actions'>): string | null {
  return monster.actions.find((a) => /^multiattack$/i.test(a.name))?.desc ?? null
}

/** The legendary actions' cost: "Wing Attack (Costs 2 Actions)" costs 2. */
export function legendaryCost(name: string): number {
  const found = /costs (\d+) actions/i.exec(name)
  return found ? Number(found[1]) : 1
}

export type PastAttack = { actorId: string; monster: string; label: string; targetId: string }

/**
 * Same for the rest: the last attack a monster of the same kind made, to repeat with this one, if
 * it hasn't acted yet this turn and the target is still up. Null otherwise.
 */
export function sameAsBefore(
  last: PastAttack | null,
  acting: { id: string; monster: string | null; acted: boolean },
  targetUp: (id: string) => boolean,
): PastAttack | null {
  if (!last || acting.acted || !acting.monster) return null
  if (last.actorId === acting.id || last.monster !== acting.monster) return null
  return targetUp(last.targetId) ? last : null
}
