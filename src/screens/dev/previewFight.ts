// Local development only: a stand-in for a fight in the design previews, with no database. Dice are
// thrown in the browser.

import { useCallback, useState } from 'react'
import type { Combatant, CombatantSecret } from '../../live/combat.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { Character } from '../../rules/character.ts'
import { healthState, letteredNames, nextTurn, unknownNames } from '../../rules/combat.ts'
import { secureDraw } from '../../rules/dice.ts'
import { abilityModifier } from '../../rules/maths/core.ts'

type Fight = NonNullable<FightControls['fight']>

let made = 0
const stamp = () => new Date(Date.now() + made++).toISOString()

function characterCombatant(character: Character, encounterId: string, initiative: number | null): Combatant {
  return {
    id: `fighter-${character.id}`,
    encounterId,
    campaignId: 'preview',
    kind: 'character',
    characterId: character.id,
    shownName: character.name,
    revealed: true,
    initiative,
    tiebreak: character.scores.dexterity,
    health: 'healthy',
    conditions: [],
    createdAt: stamp(),
  }
}

/** A fight already going: the party against two goblins, round 1, with one player still to roll. */
export function sampleFight(characters: Character[]): Fight {
  const encounterId = 'preview-fight'
  const combatants: Combatant[] = characters.map((c, i) => characterCombatant(c, encounterId, i === 0 ? 18 : null))
  const secrets: CombatantSecret[] = []
  ;['Goblin A', 'Goblin B'].forEach((name, i) => {
    const id = `goblin-${i + 1}`
    combatants.push({
      id,
      encounterId,
      campaignId: 'preview',
      kind: 'monster',
      characterId: null,
      shownName: i === 0 ? name : `Unknown creature ${i + 1}`,
      revealed: i === 0,
      initiative: i === 0 ? 15 : 9,
      tiebreak: 14,
      health: i === 1 ? 'bloodied' : 'healthy',
      conditions: [],
      createdAt: stamp(),
    })
    secrets.push({ combatantId: id, name, monster: 'goblin', hp: i === 1 ? 3 : 7, maxHp: 7, ac: 15 })
  })
  return {
    encounter: {
      id: encounterId,
      campaignId: 'preview',
      status: 'active',
      round: 1,
      currentId: combatants[0].id,
      startedAt: stamp(),
    },
    combatants,
    secrets,
  }
}

export function usePreviewFight(start: Fight | null = null): FightControls {
  const [fight, setFight] = useState<Fight | null>(start)
  const patch = useCallback((change: (f: Fight) => Fight) => setFight((now) => (now ? change(now) : now)), [])
  const update = (combatant: Combatant, changes: Partial<Combatant>) =>
    patch((f) => ({ ...f, combatants: f.combatants.map((c) => (c.id === combatant.id ? { ...c, ...changes } : c)) }))

  return {
    fight,
    status: 'ready',
    error: null,
    start: async (characters) => {
      const encounterId = `preview-fight-${made}`
      const started: Fight = {
        encounter: {
          id: encounterId,
          campaignId: 'preview',
          status: 'active',
          round: 1,
          currentId: null,
          startedAt: stamp(),
        },
        combatants: characters.map((c) => characterCombatant(c, encounterId, null)),
        secrets: [],
      }
      setFight(started)
      return started
    },
    addMonsters: async (monster, count) => {
      let added: Combatant[] = []
      setFight((now) => {
        if (!now) return now
        const shown = unknownNames(
          now.combatants.map((c) => c.shownName),
          count,
        )
        const names = letteredNames(
          monster.name,
          now.secrets.map((s) => s.name),
          count,
        )
        added = shown.map((shownName) => ({
          id: `monster-${made++}`,
          encounterId: now.encounter.id,
          campaignId: 'preview',
          kind: 'monster',
          characterId: null,
          shownName,
          revealed: false,
          initiative: secureDraw(20) + abilityModifier(monster.scores.dexterity),
          tiebreak: monster.scores.dexterity,
          health: 'healthy',
          conditions: [],
          createdAt: stamp(),
        }))
        return {
          ...now,
          combatants: [...now.combatants, ...added],
          secrets: [
            ...now.secrets,
            ...added.map((c, i) => ({
              combatantId: c.id,
              name: names[i],
              monster: monster.index,
              hp: monster.hp,
              maxHp: monster.hp,
              ac: monster.ac,
            })),
          ],
        }
      })
      return { combatants: added, rolls: [] }
    },
    rollInitiative: async (combatant, request) => {
      update(combatant, { initiative: secureDraw(20) + request.modifier })
      return null
    },
    next: () =>
      patch((f) => {
        const entries = f.combatants.map((c) => ({ ...c, out: c.kind === 'monster' && c.health === 'down' }))
        const turn = nextTurn(entries, f.encounter.currentId, f.encounter.round)
        return { ...f, encounter: { ...f.encounter, currentId: turn.currentId, round: turn.round } }
      }),
    setMonsterHp: (secret, hp) =>
      patch((f) => {
        const clamped = Math.max(0, Math.min(secret.maxHp, hp))
        return {
          ...f,
          secrets: f.secrets.map((s) => (s.combatantId === secret.combatantId ? { ...s, hp: clamped } : s)),
          combatants: f.combatants.map((c) =>
            c.id === secret.combatantId ? { ...c, health: healthState(clamped, secret.maxHp) } : c,
          ),
        }
      }),
    reveal: (combatant) =>
      patch((f) => {
        const secret = f.secrets.find((s) => s.combatantId === combatant.id)
        return {
          ...f,
          combatants: f.combatants.map((c) =>
            c.id === combatant.id && secret ? { ...c, shownName: secret.name, revealed: true } : c,
          ),
        }
      }),
    setConditions: (combatant, conditions) => update(combatant, { conditions }),
    remove: (combatant) => patch((f) => ({ ...f, combatants: f.combatants.filter((c) => c.id !== combatant.id) })),
    end: () => setFight(null),
  }
}
