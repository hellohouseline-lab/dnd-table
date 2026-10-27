// Local development only (the routes exist only under `npm run dev`): screens with made-up people,
// so their look can be checked without signing in. Buttons that save won't work here.
import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '../../app/authContext.ts'
import { localRoll } from '../../dice/localRoll.ts'
import { parseDiceStyle, type DiceStyle } from '../../dice/style.ts'
import type { Token } from '../../live/combat.ts'
import { newBuild, type Character } from '../../rules/character.ts'
import { feetBetween } from '../../rules/combat.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { movementLeft } from '../../rules/turn.ts'
import { CampaignView } from '../campaign/CampaignScreen.tsx'
import { CharacterForm } from '../character/CharacterForm.tsx'
import { Page } from '../../components/Page.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { TableView, type Arrival } from '../table/TableView.tsx'
import { EMPTY_STASH, type HandOver, type Offer, type PartyStash, type StashControls } from '../../live/giving.ts'
import { mergeItems } from '../../rules/magic.ts'
import { addWallets, coinsFor, coinWords, pay, splitCoins, subtractCoins, walletCopper } from '../../rules/money.ts'
import { judgePreview, previewAnswer, previewRequest, usePreviewAsking } from './previewAsking.ts'
import { sampleFight, usePreviewFight } from './previewFight.ts'
import { previewMap, previewMapTokens, usePreviewTokens } from './previewTokens.ts'
import { blockedMove } from '../../map/mapTokens.ts'
import { usePreviewAreas } from './previewAreas.ts'
import { sampleCampaign, sampleCharacters, sampleMembers } from './sampleData.ts'
import { useSrd } from '../../live/useSrd.ts'
import { loadBackgrounds, loadClasses, loadEquipment, loadMagicItems, loadRaces } from '../../rules/srd/index.ts'
import type { Haggle, Shopping } from '../../live/shops.ts'
import { boughtItem, linePrice, sellPrice, startingStock, type Shop } from '../../rules/shops.ts'

const online = new Set(['dm', 'p1'])
const noop = () => {}

function SignedInAs({ userId, children }: { userId: string; children: ReactNode }) {
  const signedIn: AuthState = { status: 'signedIn', user: { id: userId } as User }
  return <AuthContext.Provider value={signedIn}>{children}</AuthContext.Provider>
}

/** #/dev/join/dm, #/dev/join/player and #/dev/join/new (a player with no character yet). */
export function JoinScreenPreview({ as }: { as: string }) {
  const me = sampleMembers.find((member) => member.user_id === (as === 'dm' ? 'dm' : 'p1')) ?? sampleMembers[1]
  return (
    <SignedInAs userId={me.user_id}>
      <CampaignView
        table={sampleCampaign}
        members={sampleMembers}
        me={me}
        characters={as === 'new' ? [] : sampleCharacters}
        online={online}
        siteUrl="http://localhost:5180/dnd-table/"
        onCampaignChanged={noop}
        onMembersChanged={noop}
      />
    </SignedInAs>
  )
}

/**
 * #/dev/table: the table screen. Trackers change on screen but aren't saved. #/dev/table/asked opens
 * with the DM asking for a Constitution save (DC 15, secret), which Elowen has already rolled.
 * #/dev/table/reaction: on Goblin A's turn it has just stepped away from Thorin, who may strike.
 * #/dev/table/dying: Thorin's turn at 0 hit points, with one death save failed.
 * #/dev/table/caster: Elowen's turn (played by Alex), with her spells in the hand.
 * #/dev/table/dual: Thorin's turn with a shortsword and a dagger, for two-weapon fighting.
 * #/dev/table/rules: Thorin is prone and poisoned, for the Rules panel.
 */
export function TablePreview({
  asked = false,
  fighting = false,
  variant = null,
}: {
  asked?: boolean
  fighting?: boolean
  variant?: 'reaction' | 'dying' | 'caster' | 'dual' | 'gift' | 'story' | 'rules' | null
}) {
  const caster = variant === 'caster'
  const [characters, setCharacters] = useState<Character[]>(() =>
    variant === 'rules'
      ? sampleCharacters.map((c, i) => (i === 0 ? { ...c, conditions: ['prone', 'poisoned'] } : c))
      : variant === 'dying'
        ? sampleCharacters.map((c, i) =>
            i === 0 ? { ...c, currentHp: 0, deathSaveFailures: 1, conditions: [...c.conditions, 'unconscious'] } : c,
          )
        : variant === 'dual'
          ? sampleCharacters.map((c, i) =>
              i === 0
                ? {
                    ...c,
                    attacks: [
                      { ...c.attacks[0], id: 'a1', name: 'Shortsword', weapon: 'shortsword' },
                      { ...c.attacks[0], id: 'a2', name: 'Dagger', weapon: 'dagger' },
                    ],
                  }
                : c,
            )
          : variant === 'gift'
            ? sampleCharacters.map((c, i) =>
                i === 0
                  ? {
                      ...c,
                      inventory: [
                        ...c.inventory,
                        {
                          id: 'cloak',
                          item: 'cloak-of-protection',
                          name: 'Cloak of Protection',
                          quantity: 1,
                          weight: 0,
                          worn: false,
                          uses: null,
                          magic: 'cloak-of-protection',
                          attune: true,
                          attuned: false,
                        },
                      ],
                    }
                  : c,
              )
            : sampleCharacters,
  )
  const [diceStyle, setDiceStyle] = useState<DiceStyle>(() => parseDiceStyle(sampleMembers[1].dice_style))
  const [start] = useState(() => {
    if (!asked) return { request: null, answers: [] }
    const request = previewRequest(sampleCharacters.map((c) => c.id))
    return { request, answers: [previewAnswer(sampleCharacters[1], request, 15)] }
  })
  const asking = usePreviewAsking(sampleCharacters, { start: start.request, startAnswers: start.answers })
  // #/dev/table/fight: Thorin's turn against two goblins on a made-up battle map.
  const [fightStart] = useState(() => {
    if (!fighting) return null
    const sample = sampleFight(sampleCharacters)
    if (variant === 'reaction') return { ...sample, encounter: { ...sample.encounter, currentId: 'goblin-1' } }
    if (variant === 'caster') {
      const elowen = `fighter-${sampleCharacters[1].id}`
      return {
        ...sample,
        encounter: { ...sample.encounter, currentId: elowen },
        combatants: sample.combatants.map((c) => (c.id === elowen ? { ...c, initiative: 16 } : c)),
      }
    }
    return sample
  })
  const [map] = useState(() => (fighting ? previewMap() : null))
  const areas = usePreviewAreas(map?.id ?? null)
  const update = (id: string, patch: Partial<Character>) => {
    setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    // Lost it, or a failed save: the spell's area goes too.
    if (patch.concentration === null) areas.endConcentration(id)
  }
  const fight = usePreviewFight(fightStart, {
    characters,
    onCharacter: update,
    onArea: areas.fromSpell,
    prompts:
      variant === 'reaction' && fightStart
        ? [
            {
              id: 'prompt-preview',
              encounterId: fightStart.encounter.id,
              combatantId: `fighter-${sampleCharacters[0].id}`,
              provokerId: 'goblin-1',
              status: 'open',
              createdAt: fightStart.encounter.startedAt,
            },
          ]
        : [],
  })
  const [mapStart] = useState(() =>
    map
      ? previewMapTokens(map.id, fightStart).map((t) =>
          // The goblin has just stepped out of Thorin's reach.
          variant === 'reaction' && t.combatantId === 'goblin-1' ? { ...t, x: t.x + 2 } : t,
        )
      : [],
  )
  // Moves follow the server's rule: on your turn, as far as your movement left. Leaving a goblin's
  // side gives it a chance to strike (which the DM sees).
  // Where everyone stands, for working out who a move leaves behind.
  const placed = useRef<Token[]>([])
  const tokens = usePreviewTokens(map?.id ?? null, mapStart, (token, x, y) => {
    const now = fight.fight
    const who = now?.combatants.find((c) => c.characterId === token.characterId)
    // Before the first turn, everyone places their miniature freely.
    if (!now || !who || now.encounter.currentId === null) return true
    if (now.encounter.currentId !== who.id) return false
    const character = characters.find((c) => c.id === who.characterId)
    const feet = feetBetween(token, { x, y })
    if (feet > movementLeft(who.turn, character?.speed ?? who.speed)) return false
    const monsters = now.combatants.filter((c) => c.kind === 'monster' && c.health !== 'down')
    const enemy = (t: Token) => monsters.find((c) => c.id === (t as Token).combatantId)?.shownName ?? null
    if (blockedMove(placed.current, token, { x, y }, (t) => enemy(t as Token))) return false
    fight.walk(who.id, feet)
    fight.provoke(who.id, token, { x, y }, placed.current)
    return true
  })
  // The preview throws dice in the browser; there's no database to ask.
  useEffect(() => {
    placed.current = tokens.tokens
  }, [tokens.tokens])
  const thrower = useCallback(
    async (request: RollRequest) =>
      judgePreview(localRoll(request, { campaignId: 'preview', rollerId: 'p1', style: diceStyle }), request, 15),
    [diceStyle],
  )
  // #/dev/table/gift opens with something just given to Thorin.
  const [arrivals, setArrivals] = useState<Arrival[]>(() =>
    variant === 'gift' ? [{ id: 1, text: 'You got Longsword +1 and 5 gp' }] : [],
  )
  // ...and an offer from the DM for one of his handaxes.
  const [offers, setOffers] = useState<Offer[]>(() =>
    variant === 'gift'
      ? [
          {
            id: 'offer-1',
            characterId: sampleCharacters[0].id,
            itemId: 'i4',
            itemName: 'Handaxe',
            quantity: 1,
            copper: 300,
            status: 'open',
            createdAt: new Date().toISOString(),
          },
        ]
      : [],
  )
  const answerOffer = async (offerId: string, sell: boolean) => {
    const offer = offers.find((o) => o.id === offerId)
    if (!offer) return 'That offer has gone'
    if (sell) {
      setCharacters((list) =>
        list.map((c) =>
          c.id === offer.characterId
            ? {
                ...c,
                inventory: c.inventory.flatMap((i) =>
                  i.id !== offer.itemId
                    ? [i]
                    : i.quantity > offer.quantity
                      ? [{ ...i, quantity: i.quantity - offer.quantity }]
                      : [],
                ),
                wallet: addWallets(c.wallet, coinsFor(offer.copper)),
              }
            : c,
        ),
      )
    }
    setOffers((now) => now.filter((o) => o.id !== offerId))
    return null
  }
  // ...and a box the DM put on the table.
  const [stash, setStash] = useState<PartyStash>(() =>
    variant === 'gift'
      ? {
          items: [
            { id: 's1', item: 'dagger', name: 'Dagger', quantity: 2, weight: 1, worn: false, uses: null },
            {
              id: 's2',
              item: null,
              name: 'Unsent letter',
              quantity: 1,
              weight: 0,
              worn: false,
              uses: null,
              note: 'To someone called Merra. It ends mid-sentence.',
            },
          ],
          wallet: { ...EMPTY_STASH.wallet, gp: 12, sp: 5 },
        }
      : EMPTY_STASH,
  )
  const stashControls: StashControls = {
    stash,
    take: async (itemId, quantity) => {
      const item = stash.items.find((i) => i.id === itemId)
      if (!item) return 'Someone has taken that already'
      setStash((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }))
      setCharacters((list) =>
        list.map((c, i) =>
          i === (caster ? 1 : 0) ? { ...c, inventory: mergeItems(c.inventory, [{ ...item, quantity }]) } : c,
        ),
      )
      return null
    },
    split: async () => {
      const { each, left } = splitCoins(walletCopper(stash.wallet), characters.length)
      if (each === 0) return 'Too few coins to share'
      setCharacters((list) => list.map((c) => ({ ...c, wallet: addWallets(c.wallet, coinsFor(each)) })))
      setStash((s) => ({ ...s, wallet: coinsFor(left) }))
      return null
    },
  }
  // ...and Brenna's general store, open, at the book price.
  const equipment = useSrd(loadEquipment)
  const magicItems = useSrd(loadMagicItems)
  const baseShop = useMemo<Shop | null>(
    () =>
      variant === 'gift' && equipment && magicItems
        ? {
            id: 'brenna',
            name: 'Brenna’s Goods',
            keeper: 'Brenna',
            kind: 'general',
            markup: 100,
            buys: true,
            open: true,
            stock: startingStock('general', equipment, magicItems),
          }
        : null,
    [variant, equipment, magicItems],
  )
  const [changedShop, setShop] = useState<Shop | null>(null)
  const shop = changedShop ?? baseShop
  const me = characters[caster ? 1 : 0]
  // Haggling in the preview: Brenna answers after a moment, halfway between.
  const [haggles, setHaggles] = useState<Haggle[]>([])
  const shopping: Shopping = {
    shops: shop ? [shop] : [],
    haggles,
    haggle: async (_shopId, stockId, bundles, offer) => {
      const line = shop?.stock.find((l) => l.id === stockId)
      if (!shop || !line) return 'That’s not on the shelves any more'
      const asking = linePrice(line, shop.markup) * bundles
      const id = `h-${stockId}`
      setHaggles((now) => [
        {
          id,
          shopId: shop.id,
          characterId: me.id,
          stockId,
          itemName: line.name,
          bundles,
          asking,
          offer,
          counter: null,
          status: 'open',
          createdAt: '2026-11-21T19:00:00Z',
        },
        ...now.filter((h) => h.id !== id),
      ])
      window.setTimeout(
        () =>
          setHaggles((now) =>
            now.map((h) =>
              h.id === id ? { ...h, status: 'countered', counter: Math.round((offer + asking) / 2) } : h,
            ),
          ),
        1200,
      )
      return null
    },
    takeCounter: async (haggleId, take) => {
      const h = haggles.find((x) => x.id === haggleId)
      const line = shop?.stock.find((l) => l.id === h?.stockId)
      if (!h || !line || h.counter === null) return 'That offer has gone'
      if (take) {
        const after = pay(me.wallet, h.counter)
        if (!after) return 'You haven’t enough coins'
        setCharacters((list) =>
          list.map((c) =>
            c.id === me.id
              ? { ...c, wallet: after, inventory: mergeItems(c.inventory, [boughtItem(line, h.bundles)]) }
              : c,
          ),
        )
      }
      setHaggles((now) => now.map((x) => (x.id === haggleId ? { ...x, status: take ? 'agreed' : 'withdrawn' } : x)))
      return null
    },
    buy: async (_shopId, stockId, bundles) => {
      const line = shop?.stock.find((l) => l.id === stockId)
      if (!shop || !line) return 'That’s not on the shelves any more'
      const total = linePrice(line, shop.markup) * bundles
      const after = pay(me.wallet, total)
      if (!after) return `That costs ${coinWords(coinsFor(total))}, and you have ${coinWords(me.wallet)}`
      setCharacters((list) =>
        list.map((c) =>
          c.id === me.id ? { ...c, wallet: after, inventory: mergeItems(c.inventory, [boughtItem(line, bundles)]) } : c,
        ),
      )
      setShop({
        ...shop,
        stock: shop.stock.map((l) =>
          l.id === stockId && l.quantity !== null ? { ...l, quantity: l.quantity - bundles } : l,
        ),
      })
      return null
    },
    sell: async (_shopId, itemId, quantity) => {
      const item = me.inventory.find((i) => i.id === itemId)
      const each = item && shop && equipment ? sellPrice(item, shop, equipment) : null
      if (!item || each === null) return 'This shop doesn’t buy that'
      setCharacters((list) =>
        list.map((c) =>
          c.id === me.id
            ? {
                ...c,
                wallet: addWallets(c.wallet, coinsFor(each * quantity)),
                inventory: c.inventory.flatMap((i) =>
                  i.id !== itemId ? [i] : i.quantity > quantity ? [{ ...i, quantity: i.quantity - quantity }] : [],
                ),
              }
            : c,
        ),
      )
      return null
    },
  }
  // Handing things over, as the server does it (outside a fight).
  const handOver: HandOver = async (to, what) => {
    const from = characters[caster ? 1 : 0]
    const item = from.inventory.find((i) => i.id === what.itemId)
    if (item?.worn) return 'Take it off first'
    if (fighting) return 'Hand things over when the fight is over'
    const moved = item ? [{ ...item, quantity: Math.min(what.quantity || 1, item.quantity) }] : []
    setCharacters((list) =>
      list.map((c) => {
        if (c.id === from.id) {
          return {
            ...c,
            inventory: c.inventory.flatMap((i) =>
              i.id !== item?.id
                ? [i]
                : i.quantity > moved[0].quantity
                  ? [{ ...i, quantity: i.quantity - moved[0].quantity }]
                  : [],
            ),
            wallet: subtractCoins(c.wallet, what.coins),
          }
        }
        if (c.id === to)
          return { ...c, inventory: mergeItems(c.inventory, moved), wallet: addWallets(c.wallet, what.coins) }
        return c
      }),
    )
    return null
  }
  return (
    <SignedInAs userId={caster ? 'p2' : 'p1'}>
      <TableView
        campaignName="The Ember Road"
        campaignId="preview"
        me={sampleMembers[caster ? 2 : 1]}
        character={characters[caster ? 1 : 0]}
        members={sampleMembers}
        characters={characters}
        online={online}
        onUpdate={update}
        diceStyle={diceStyle}
        onDiceStyleChange={setDiceStyle}
        thrower={thrower}
        asking={asking}
        handOver={handOver}
        arrivals={arrivals}
        onArrivalSeen={(id) => setArrivals((now) => now.filter((a) => a.id !== id))}
        offers={offers}
        onAnswerOffer={answerOffer}
        stash={stashControls}
        npc={variant === 'story' ? { name: 'Brenna', role: 'Innkeeper', portrait: null } : null}
        readAloud={
          variant === 'story'
            ? 'Rain drums on the shutters. Inside the Rusty Flagon, smoke curls from a hearth big enough to roast an ox, and every head turns as you shake the water from your cloaks.'
            : ''
        }
        shopping={shopping}
        combat={
          fighting
            ? {
                fight: fight.fight,
                rollInitiative: fight.rollInitiative,
                endTurn: fight.next,
                events: fight.events,
                attack: fight.attack,
                offhandAttack: fight.offhandAttack,
                applyItem: fight.applyItem,
                act: fight.act,
                prompts: fight.prompts,
                strike: fight.strike,
                letGo: fight.letGo,
                deathSave: fight.deathSave,
                conditionSave: fight.conditionSave,
                standUp: fight.standUp,
                breakFree: fight.breakFree,
                cast: fight.cast,
                concentrationSave: fight.concentrationSave,
                applyFeature: fight.applyFeature,
                takeBack: fight.takeBack,
                areas: areas.areas,
                map,
                tokens,
                playersMove: true,
                pointers: { hands: [], pings: [], sendHand: () => {}, sendPing: () => {} },
              }
            : undefined
        }
      />
    </SignedInAs>
  )
}

/** #/dev/character: the character form, filled with the sample fighter. Saving does nothing. */
export function CharacterFormPreview() {
  const srd = { classes: useSrd(loadClasses), races: useSrd(loadRaces), backgrounds: useSrd(loadBackgrounds) }
  const { id: _id, ...build } = sampleCharacters[0]
  return (
    <SignedInAs userId="p1">
      <Page>
        <PageHeader eyebrow="Edit character" title={build.name} subtitle="Preview with made-up data" />
        <CharacterForm
          initial={{ ...newBuild(), ...build }}
          srd={srd}
          saveLabel="Save changes"
          cancelHref="#/dev/table"
          onSave={async () => {}}
        />
      </Page>
    </SignedInAs>
  )
}
