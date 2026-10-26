import { useCallback, useEffect, useState } from 'react'
import type { Combatant, SpellCast, Token } from '../../live/combat.ts'
import type { AreaTone } from '../../live/areas.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { Roll } from '../../live/rolls.ts'
import type { Character, SpellEntry } from '../../rules/character.ts'
import { creaturesIn, type AreaShape, type AreaTemplate } from '../../rules/areas.ts'
import { feetBetween } from '../../rules/combat.ts'
import { spellAttackRoll } from '../../rules/rolls.ts'
import {
  castingCost,
  lastingArea,
  slotChoices,
  spellEffect,
  spellKind,
  spellModifier,
  spellRange,
} from '../../rules/spells.ts'
import { byName, type SrdSpell } from '../../rules/srd/index.ts'
import { attackMode, inReach } from '../../rules/turn.ts'
import type { FightRow } from './fightRows.ts'
import { targetState } from './strikes.ts'

/** A spell waiting for its target, or for its area to be put on the map. */
export type Casting = {
  label: string
  spell: SrdSpell
  casterId: string
  /** The slot it will use (0 for a cantrip), and the others it could. */
  slot: number
  slots: number[]
  setSlot: (slot: number) => void
  /** How far it reaches, in feet, for the band round the caster (null: no limit shown). */
  rangeFt: number | null
  /** Pick a creature, or put a shape on the map. */
  mode: 'target' | 'area'
  /** The shape to put down: from the caster for a cone, line or "Self" spell, anywhere for Fireball. */
  area: { shape: AreaShape; sizeFt: number; tone: AreaTone; fromCaster: boolean } | null
  onPick: (target: FightRow) => void
  onPlace: (template: AreaTemplate) => void
  /**
   * With a confirm step (the player's screen): who it's for or where it went, waiting for Cast.
   * Null until then, and always null without the step, where picking casts at once.
   */
  chosen: { names: string[]; template: AreaTemplate | null } | null
  /** Casts what's been chosen. */
  fire: () => void
  /** Pick again. */
  again: () => void
} | null

/** The SRD entry for a spell on a sheet: by its index, or its name as typed. */
export function srdSpellFor(entry: SpellEntry, spells: SrdSpell[] | null): SrdSpell | undefined {
  if (!spells) return undefined
  return (entry.index ? spells.find((s) => s.index === entry.index) : undefined) ?? byName(spells, entry.name)
}

/** Can this spell be cast now, in a fight? Null if so, otherwise why not, in plain words. */
export function whyNot(
  spell: SrdSpell,
  character: Character,
  combatant: Combatant | null,
  myTurn: boolean,
): string | null {
  const cost = castingCost(spell.castingTime)
  if (cost === 'longer') return `${spell.name} takes ${spell.castingTime} to cast: outside a fight`
  if (character.currentHp === 0) return 'Nobody casts spells at 0 hit points'
  if (slotChoices(character.spellcasting, spell.level).length === 0) return `No slots left for ${spell.name}`
  if (!combatant) return null
  const turn = combatant.turn
  if (cost !== 'reaction' && !myTurn) return 'Wait for your turn'
  if (cost === 'action' && (turn.actionUsed || turn.attacksMade > 0)) return 'You have used your action this turn'
  if (cost === 'bonus' && turn.bonusUsed) return 'You have used your bonus action this turn'
  if (cost === 'reaction' && turn.reactionUsed) return 'You have used your reaction'
  return null
}

function tokenOf(tokens: Token[], combatant: Combatant): Token | undefined {
  return tokens.find((t) =>
    combatant.characterId ? t.characterId === combatant.characterId : t.combatantId === combatant.id,
  )
}

const ORDINAL = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** "3rd-level slot", or "cantrip". */
export function slotWords(slot: number): string {
  return slot === 0 ? 'cantrip' : `${ORDINAL[slot]}-level slot`
}

/** The spell's level for its card: "Cantrip", "1st". */
export function levelWords(level: number): string {
  return ORDINAL[level] ?? `${level}th`
}

/**
 * Casting a spell in a fight, for a player on their own screen and for the DM acting for one:
 * pick the spell, then its target or where its area goes. The lowest free slot is used unless
 * another is picked. The server spends the slot and the action and settles what the spell does;
 * any dice it throws come back to be shown. Escape puts the spell away.
 */
export function useCasting(
  cast: FightControls['cast'],
  rollWith: (work: () => Promise<Roll | null>) => Promise<Roll | null>,
  tokens: Token[],
  rows: FightRow[],
  /** Wait for Cast after the target is picked or the area placed, rather than casting at once. */
  confirm = false,
) {
  const [pending, setPending] = useState<{
    row: FightRow
    spell: SrdSpell
    slot: number
    chosen: { targets: FightRow[]; template: AreaTemplate | null } | null
  } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!pending) return
    const cancel = (event: KeyboardEvent) => event.key === 'Escape' && setPending(null)
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [pending])

  const go = useCallback(
    (row: FightRow, spell: SrdSpell, slot: number, targets: FightRow[], template: AreaTemplate | null) => {
      const character = row.character
      if (!character) return
      const cost = castingCost(spell.castingTime)
      if (cost === 'longer') return
      const kind = spellKind(spell)
      const ability = character.spellcasting.ability
      const effect = spellEffect(spell, slot, character.level, spellModifier(character))
      const casterToken = tokenOf(tokens, row.combatant)
      const first = targets[0]
      let roll: Parameters<FightControls['cast']>[4] = effect ? { dice: effect.dice, modifier: effect.modifier } : null
      if (kind === 'attack') {
        if (!first || !ability) return
        const targetToken = tokenOf(tokens, first.combatant)
        const feet = casterToken && targetToken ? feetBetween(casterToken, targetToken) : null
        const request = spellAttackRoll(
          character,
          spell,
          ability,
          effect ? { dice: effect.dice, modifier: effect.modifier, type: effect.type ?? '' } : null,
        )
        roll = { ...request, mode: attackMode(request.mode, targetState(first), feet) }
      }
      const spellCast: SpellCast = {
        index: spell.index,
        name: spell.name,
        level: spell.level,
        cost,
        concentration: spell.concentration,
        kind,
        save: spell.save,
        dcSuccess: spell.dcSuccess,
        damageType: spell.damage?.type ?? null,
      }
      const area = template && lastingArea(spell) ? { ...template, tone: toneOf(spell) } : null
      setPending(null)
      void rollWith(() =>
        cast(
          row.combatant,
          spellCast,
          slot,
          targets.map((t) => t.combatant.id),
          roll,
          area,
        ),
      )
    },
    [cast, rollWith, tokens],
  )

  /** Starts casting: straight away for a spell with no target or area (Bless, Shield), otherwise aiming. */
  const begin = useCallback(
    (row: FightRow, spell: SrdSpell, slot?: number) => {
      setProblem(null)
      const character = row.character
      if (!character) return
      const slots = slotChoices(character.spellcasting, spell.level)
      if (slots.length === 0) {
        setProblem(`No slots left for ${spell.name}.`)
        return
      }
      const chosen = slot !== undefined && slots.includes(slot) ? slot : slots[0]
      const kind = spellKind(spell)
      if (!spell.area && kind === 'other') {
        if (confirm) setPending({ row, spell, slot: chosen, chosen: { targets: [], template: null } })
        else go(row, spell, chosen, [], null)
        return
      }
      setPending({ row, spell, slot: chosen, chosen: null })
    },
    [go, confirm],
  )

  let casting: Casting = null
  if (pending) {
    const { row, spell, slot } = pending
    // Picked: cast now, or wait for Cast.
    const settle = (targets: FightRow[], template: AreaTemplate | null) =>
      confirm
        ? setPending((now) => (now ? { ...now, chosen: { targets, template } } : now))
        : go(row, spell, slot, targets, template)
    const character = row.character
    const self = /^self/i.test(spell.range)
    const range = spellRange(spell.range)
    const fromCaster = self || spell.area?.type === 'cone' || spell.area?.type === 'line'
    casting = {
      label: spell.name,
      spell,
      casterId: row.combatant.id,
      slot,
      slots: character ? slotChoices(character.spellcasting, spell.level) : [slot],
      setSlot: (next) => setPending((now) => (now ? { ...now, slot: next } : now)),
      rangeFt: self ? null : range,
      mode: spell.area ? 'area' : 'target',
      area: spell.area
        ? {
            shape: spell.area.type,
            sizeFt: spell.area.size,
            tone: toneOf(spell),
            fromCaster,
          }
        : null,
      onPick: (target) => {
        const casterToken = tokenOf(tokens, row.combatant)
        const targetToken = tokenOf(tokens, target.combatant)
        const feet = casterToken && targetToken ? feetBetween(casterToken, targetToken) : null
        if (range !== null && feet !== null) {
          const reach = inReach({ melee: Math.max(range, 5), normal: null, long: null }, feet)
          if (!reach.allowed) {
            setProblem(`${target.name} is ${feet} ft away; ${spell.name} reaches ${range} ft.`)
            return
          }
        }
        settle([target], null)
      },
      onPlace: (template) => {
        // Everyone standing in it, but not the caster of a cone, line or "Self" spell. A spell that
        // only changes the place (Darkness, Fog Cloud) has nobody to settle.
        if (spellKind(spell) === 'other') {
          settle([], template)
          return
        }
        const inside = creaturesIn(template, tokens)
        const caught = rows.filter((r) => {
          const token = tokenOf(tokens, r.combatant)
          if (!token || !inside.includes(token)) return false
          return !(r.combatant.id === row.combatant.id && fromCaster)
        })
        settle(caught, template)
      },
      chosen: pending.chosen
        ? { names: pending.chosen.targets.map((t) => t.name), template: pending.chosen.template }
        : null,
      fire: () => pending.chosen && go(row, spell, slot, pending.chosen.targets, pending.chosen.template),
      again: () => setPending((now) => (now ? { ...now, chosen: null } : now)),
    }
  }

  return { casting, begin, cancel: () => setPending(null), problem, clearProblem: () => setProblem(null) }
}

/** How a spell's area looks on the map: harm for damage, help for healing, block for the rest (Darkness, Fog Cloud). */
export function toneOf(spell: SrdSpell): AreaTone {
  if (spell.damage) return 'harm'
  if (spell.heal) return 'help'
  return 'block'
}

/** For the map: a casting's shape, with where it starts. */
export type Placing = NonNullable<Casting>['area']
