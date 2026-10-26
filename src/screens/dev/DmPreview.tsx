// Local development only: the DM screen with made-up people and rolls (#/dev/dm/party, #/dev/dm/log),
// and every kind of result card side by side (#/dev/dm/moments).
import type { User } from '@supabase/supabase-js'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { EMPTY_STASH, type GivingControls, type Offer, type PartyStash } from '../../live/giving.ts'
import type { DmItem } from '../../rules/catalogue.ts'
import { entryId } from '../../rules/character.ts'
import { useSrd } from '../../live/useSrd.ts'
import { mergeItems } from '../../rules/magic.ts'
import { syncAttacks } from '../../rules/manage.ts'
import { addWallets, coinsFor, coinWords, pay, splitCoins } from '../../rules/money.ts'
import { loadEquipment } from '../../rules/srd/index.ts'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import { localRoll } from '../../dice/localRoll.ts'
import { RollToast } from '../../dice/RollToasts.tsx'
import { DEFAULT_DICE_STYLE, type DiceStyle } from '../../dice/style.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { Roll } from '../../live/rolls.ts'
import type { Character } from '../../rules/character.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { DmView } from '../dm/DmView.tsx'
import { judgePreview, previewAnswer, previewRequest, usePreviewAsking } from './previewAsking.ts'
import { usePreviewEvents, usePreviewNotebook } from './previewNotebook.ts'
import { sampleFight, usePreviewFight } from './previewFight.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from './sampleData.ts'
import styles from './DmPreview.module.css'

const online = new Set(['dm', 'p1'])
const signedIn: AuthState = { status: 'signedIn', user: { id: 'dm' } as User }

function sample(id: string, minutesAgo: number, roll: Partial<Roll>): Roll {
  return {
    id,
    campaignId: 'preview',
    rollerId: 'p1',
    characterId: 'fighter',
    label: 'Perception check',
    kind: 'check',
    mode: 'normal',
    dice: [{ sides: 20, value: 12, dropped: false }],
    modifier: 3,
    parts: [
      { label: 'Wisdom', value: 1 },
      { label: 'Proficiency', value: 2 },
    ],
    total: 15,
    natural: 12,
    damage: null,
    secret: false,
    style: { material: 'glass', colour: 'ruby', numbers: 'gold' },
    createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    requestId: null,
    passed: null,
    passedByDice: null,
    forDm: false,
    ...roll,
  }
}

// Made when a preview opens (not when the file loads), so the live build can leave all of this out.
function sampleRolls(): Roll[] {
  return [
    sample('crit', 1, {
      label: 'Longsword',
      kind: 'attack',
      dice: [{ sides: 20, value: 20, dropped: false }],
      modifier: 5,
      parts: [
        { label: 'Strength', value: 3 },
        { label: 'Proficiency', value: 2 },
      ],
      total: 25,
      natural: 20,
      damage: {
        dice: [
          { sides: 8, value: 6, dropped: false },
          { sides: 8, value: 3, dropped: false },
        ],
        modifier: 3,
        total: 12,
        type: 'slashing',
        critical: true,
      },
    }),
    sample('fumble', 3, {
      rollerId: 'p2',
      characterId: 'wizard',
      label: 'Stealth check',
      dice: [{ sides: 20, value: 1, dropped: false }],
      modifier: 2,
      parts: [{ label: 'Dexterity', value: 2 }],
      total: 3,
      natural: 1,
      style: { material: 'stone', colour: 'slate', numbers: 'white' },
    }),
    sample('advantage', 6, {
      label: 'Constitution save',
      kind: 'save',
      mode: 'advantage',
      dice: [
        { sides: 20, value: 7, dropped: true },
        { sides: 20, value: 16, dropped: false },
      ],
      modifier: 4,
      parts: [
        { label: 'Constitution', value: 2 },
        { label: 'Proficiency', value: 2 },
      ],
      total: 20,
      natural: 16,
    }),
    sample('secret', 9, {
      rollerId: 'dm',
      characterId: null,
      label: '1d20',
      kind: 'free',
      dice: [{ sides: 20, value: 9, dropped: false }],
      modifier: 0,
      parts: [],
      total: 9,
      natural: 9,
      secret: true,
      style: DEFAULT_DICE_STYLE,
    }),
    sample('fireball', 12, {
      rollerId: 'p2',
      characterId: 'wizard',
      label: '8d6',
      kind: 'free',
      dice: [6, 2, 5, 4, 1, 6, 3, 5].map((value) => ({ sides: 6 as const, value, dropped: false })),
      modifier: 0,
      parts: [],
      total: 32,
      natural: null,
    }),
  ]
}

export function DmPreview({ tab }: { tab: string }) {
  const [characters, setCharacters] = useState<Character[]>(sampleCharacters)
  const [rolls, setRolls] = useState<Roll[]>(sampleRolls)
  const [diceStyle, setDiceStyle] = useState<DiceStyle>(DEFAULT_DICE_STYLE)
  // #/dev/dm/asked opens with a Constitution save out, which Thorin has rolled and Elowen hasn't.
  const [start] = useState(() => {
    if (tab !== 'asked') return { request: null, answers: [] }
    const request = previewRequest(sampleCharacters.map((c) => c.id))
    return { request, answers: [previewAnswer(sampleCharacters[0], request, 15)] }
  })
  const notebook = usePreviewNotebook()
  // #/dev/dm/fight opens with a fight going on.
  const [fightStart] = useState(() => (tab === 'fight' ? sampleFight(sampleCharacters) : null))
  const update = (id: string, patch: TrackerPatch) =>
    setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const fight = usePreviewFight(fightStart, { characters, onCharacter: update })
  const events = usePreviewEvents()
  const giving = usePreviewGiving(characters, setCharacters)
  const asking = usePreviewAsking(characters, {
    start: start.request,
    startAnswers: start.answers,
    answerFor: sampleCharacters.map((c) => c.id),
  })

  if (tab === 'moments') return <Moments />

  const thrower = async (request: RollRequest) => {
    const roll = judgePreview(
      localRoll(request, { campaignId: 'preview', rollerId: 'dm', style: diceStyle }),
      request,
      asking.dc ?? 15,
    )
    setRolls((list) => [roll, ...list])
    return roll
  }

  return (
    <AuthContext.Provider value={signedIn}>
      <DmView
        campaign={sampleCampaign}
        me={sampleMembers[0]}
        members={sampleMembers}
        characters={characters}
        online={online}
        onUpdate={update}
        onLevelUp={(ids) =>
          setCharacters((list) =>
            list.map((c) =>
              ids.includes(c.id) ? { ...c, levelUpTo: Math.max(c.levelUpTo ?? c.level, c.level) + 1 } : c,
            ),
          )
        }
        log={{ status: 'ready', rolls }}
        diceStyle={diceStyle}
        onDiceStyleChange={setDiceStyle}
        thrower={thrower}
        asking={asking}
        notebook={notebook}
        events={events}
        sceneName="Arrive at the tavern"
        fight={fight}
        startTab={tab === 'log' ? 'log' : tab === 'fight' ? 'encounter' : tab === 'items' ? 'items' : 'party'}
        giving={giving}
      />
    </AuthContext.Provider>
  )
}

/** Giving in the preview: the same sums as the server, on the made-up party. */
function usePreviewGiving(
  characters: Character[],
  setCharacters: Dispatch<SetStateAction<Character[]>>,
): GivingControls {
  const equipment = useSrd(loadEquipment)
  const [stash, setStash] = useState<PartyStash>(EMPTY_STASH)
  const [yours, setYours] = useState<DmItem[]>([
    {
      id: 'raven-seal',
      name: 'The Raven Seal',
      description: 'A black wax seal stamped with a raven. The mayor would give anything to have it back.',
      type: 'other',
      rarity: null,
      key: true,
    },
  ])
  const [offers, setOffers] = useState<Offer[]>([])
  const change = (id: string, edit: (c: Character) => Character) =>
    setCharacters((list) => list.map((c) => (c.id === id ? edit(c) : c)))
  return {
    stash,
    yours,
    saveItem: async (item) => {
      setYours((now) =>
        now.some((y) => y.id === item.id)
          ? now.map((y) => (y.id === item.id ? item : y))
          : [...now, { ...item, id: entryId() }],
      )
      return null
    },
    deleteItem: async (id) => {
      setYours((now) => now.filter((y) => y.id !== id))
      return null
    },
    offers,
    // In the preview the player sells after a moment.
    offer: async (characterId, itemId, quantity, copper) => {
      const who = characters.find((c) => c.id === characterId)
      const item = who?.inventory.find((i) => i.id === itemId)
      if (!who || !item) return 'They don’t have that'
      const id = entryId()
      const made: Offer = {
        id,
        characterId,
        itemId,
        itemName: item.name,
        quantity,
        copper,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      setOffers((now) => [made, ...now])
      window.setTimeout(() => {
        setOffers((now) => now.map((o) => (o.id === id && o.status === 'open' ? { ...o, status: 'sold' } : o)))
        change(characterId, (c) => ({
          ...c,
          inventory: c.inventory.flatMap((i) =>
            i.id !== itemId ? [i] : i.quantity > quantity ? [{ ...i, quantity: i.quantity - quantity }] : [],
          ),
          wallet: addWallets(c.wallet, coinsFor(copper)),
        }))
      }, 1500)
      return null
    },
    withdraw: async (offerId) => {
      setOffers((now) => now.map((o) => (o.id === offerId ? { ...o, status: 'withdrawn' } : o)))
      return null
    },
    give: async (id, items, _weapons, copper) => {
      change(id, (c) => {
        const inventory = mergeItems(c.inventory, items)
        return {
          ...c,
          inventory,
          attacks: equipment ? syncAttacks(c.attacks, inventory, equipment, c.otherProficiencies) : c.attacks,
          wallet: addWallets(c.wallet, coinsFor(copper)),
        }
      })
      return null
    },
    take: async (id, copper) => {
      const who = characters.find((c) => c.id === id)
      const after = who ? pay(who.wallet, copper) : null
      if (!who || !after) return `${who?.name ?? 'They'} only has ${coinWords(who?.wallet ?? EMPTY_STASH.wallet)}`
      change(id, (c) => ({ ...c, wallet: after }))
      return null
    },
    split: async (ids, copper) => {
      const { each, left } = splitCoins(copper, ids.length)
      ids.forEach((id) => change(id, (c) => ({ ...c, wallet: addWallets(c.wallet, coinsFor(each)) })))
      if (left > 0) setStash((s) => ({ ...s, wallet: addWallets(s.wallet, coinsFor(left)) }))
      return null
    },
  }
}

/** Every kind of result card, to check the natural 20 burst and the natural 1 crack. */
function Moments() {
  const names: Record<string, string> = { fighter: 'Thorin Ironfist', wizard: 'Elowen' }
  return (
    <main className={styles.moments}>
      {sampleRolls().map((roll) => (
        <RollToast key={roll.id} roll={roll} who={roll.characterId ? names[roll.characterId] : 'Matt (DM)'} />
      ))}
    </main>
  )
}
