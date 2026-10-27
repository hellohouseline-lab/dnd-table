import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { aOrAn } from '../../components/words.ts'
import { HpBar } from '../../components/HpBar.tsx'
import { Icon, type IconName } from '../../components/Icon.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import { localRoll, PRACTICE_SET } from '../../dice/localRoll.ts'
import { RollToasts } from '../../dice/RollToasts.tsx'
import type { DiceStyle } from '../../dice/style.ts'
import { useDiceTray } from '../../dice/useDiceTray.ts'
import { useTableRolls } from '../../dice/useTableRolls.ts'
import type { Member } from '../../live/campaigns.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import { rollForDm, type Roll } from '../../live/rolls.ts'
import { useRollChanges } from '../../live/campaignChannel.ts'
import type { RequestControls } from '../../live/useRollRequest.ts'
import type { Asset } from '../../live/library.ts'
import { NowPlaying } from '../../audio/SoundControls.tsx'
import callStyles from '../../call/Call.module.css'
import { isMuted, useTableCall } from '../../call/callContext.ts'
import { CameraFeed } from '../../call/CameraFeed.tsx'
import type { TableAudio } from '../../audio/useTableAudio.ts'
import type { HandOver, Offer, StashControls } from '../../live/giving.ts'
import type { Shopping } from '../../live/shops.ts'
import { ShopPanel } from './ShopPanel.tsx'
import { ReadAloud } from '../../components/ReadAloud.tsx'
import { coinsFor, coinWords } from '../../rules/money.ts'
import { StoredImage } from '../../components/StoredImage.tsx'
import { hitDieHealing } from '../../rules/rest.ts'
import { abilityModifier } from '../../rules/maths/core.ts'
import { ABILITIES, ABILITY_NAME, ABILITY_SHORT } from '../../rules/abilities.ts'
import type { AttackEntry, Character, FeatureEntry } from '../../rules/character.ts'
import { combineModes, isSingleD20, type RollMode, type RollRequest } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import {
  abilityCheck,
  answerRoll,
  attackRoll,
  freeRoll,
  initiativeRoll,
  savingThrow,
  skillCheck,
  spellAttackRoll,
  canAttackOffhand,
  offhandAttackRoll,
} from '../../rules/rolls.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { findCondition, findWeapon, loadSpells, type SrdSpell } from '../../rules/srd/index.ts'
import { SheetPanel, type SheetTabName } from '../sheet/SheetPanel.tsx'
import type { SheetRolls } from '../sheet/SheetTab.tsx'
import { requestChips, type CameraChip } from '../rolls/requestStatus.ts'
import { RollPrompt, RollResult } from '../rolls/RollPrompt.tsx'
import type { FightControls, Pointer, TokenControls } from '../../live/useFight.ts'
import type { CombatEvent } from '../../live/combat.ts'
import {
  attackMode,
  attacksLeft,
  attacksPerAction,
  bonusMoves,
  inReach,
  movementLeft,
  weaponReach,
} from '../../rules/turn.ts'
import { feetBetween } from '../../rules/combat.ts'
import { mapTokens } from '../../map/mapTokens.ts'
import { cameraTurn, fightRows, type CameraTurn, type FightRow } from '../fight/fightRows.ts'
import { InitiativePrompt, InitiativeRibbon, InspectCard, TurnBanner, YourTurn } from '../fight/PlayerCombat.tsx'
import { ConcentrationPrompt, DeathSaves, StrikePrompt } from '../fight/Reactions.tsx'
import { ConcentrationChip } from '../fight/SpellParts.tsx'
import { AtAGlance } from '../fight/AtAGlance.tsx'
import { SlotPicker } from '../fight/SlotPicker.tsx'
import { useCasting, whyNot } from '../fight/useCasting.ts'
import type { Area } from '../../live/areas.ts'
import { useSrd } from '../../live/useSrd.ts'
import { slotChoices, spellEffect, spellModifier } from '../../rules/spells.ts'
import { strikesFor, type Strike } from '../fight/strikes.ts'
import { deathSavePatch, isDying } from '../../rules/dying.ts'
import { CombatFeed } from '../fight/TurnParts.tsx'
import { UndoChip } from './CardPanel.tsx'
import { concentrationTimer, featureCost, featureRule, isRaging, RAGE, type Effect } from '../../rules/features.ts'
import {
  bonusEntries,
  isReady,
  lightWeapons,
  triggeredBonus,
  unarmedStrike,
  type BonusAttackKind,
  type BonusEntry,
} from '../../rules/bonusActions.ts'
import { BonusReady, type BonusChoice } from '../fight/BonusReady.tsx'
import { usableItems, type Usable } from '../../rules/items.ts'
import type { InventoryItem } from '../../rules/character.ts'

/** An item from the pack and what using it does. */
type ItemEntry = { item: InventoryItem; use: Usable }
import { messageFor } from '../../live/errors.ts'
import { DiceControls } from './DiceControls.tsx'
import { Hand } from './Hand.tsx'
import styles from './TableView.module.css'

type TableViewProps = {
  campaignId: string
  me: Member
  character: Character
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  onUpdate: (characterId: string, patch: TrackerPatch) => void
  saveError?: string | null
  diceStyle: DiceStyle
  onDiceStyleChange: (style: DiceStyle) => void
  /** Throws in the browser instead of on the server (the design preview, which has no database). */
  thrower?: (request: RollRequest) => Promise<Roll>
  /** The DM's open request for a roll, if any, and the answers so far. */
  asking: Pick<RequestControls, 'request' | 'answers' | 'putAnswer'>
  /** The picture the DM has put on stage. */
  stageImage?: Asset | null
  /** Shown on parchment while the DM hasn't put anything on stage. */
  campaignName?: string
  /** The table's sound in this tab (left out in the previews). */
  audio?: TableAudio
  /** Fights and the battle map (left out in the tests). */
  combat?: PlayerCombatProps
  /** Handing things to someone else in the party. */
  handOver?: HandOver
  /** Things just given to you, shown as cards until seen. */
  arrivals?: Arrival[]
  onArrivalSeen?: (id: number) => void
  /** The DM's offers to buy something you carry, and selling or saying no. */
  offers?: Offer[]
  onAnswerOffer?: (offerId: string, sell: boolean) => Promise<string | null>
  /** The party stash, on the Items panel. */
  stash?: StashControls
  /** Shops the DM has opened. */
  shopping?: Shopping
  /** Whether you may add gear for free (the DM's table setting). */
  canAddGear?: boolean
  /** A scene's read-aloud the DM has put on stage ('' for none). */
  readAloud?: string
}

/** Something just given to you: "You got a Longsword +1". */
export type Arrival = { id: number; text: string }

/** The DM offers coins for something you carry: sell it, or say no thanks. */
function OfferCard({ offer, onAnswer }: { offer: Offer; onAnswer: (sell: boolean) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const answer = async (sell: boolean) => {
    setBusy(true)
    const result = await onAnswer(sell)
    setBusy(false)
    setProblem(result)
  }
  return (
    <div className={styles.offer} role="dialog" aria-label="An offer for your things">
      <p className={styles.offerText}>
        The DM offers <strong>{coinWords(coinsFor(offer.copper))}</strong> for your{' '}
        {offer.quantity > 1 ? `${offer.quantity} × ${offer.itemName}` : offer.itemName}.
      </p>
      {problem && <p className={styles.offerProblem}>{problem}</p>}
      <div className={styles.offerButtons}>
        <button type="button" className={styles.offerSell} disabled={busy} onClick={() => void answer(true)}>
          Sell
        </button>
        <button type="button" className={styles.offerNo} disabled={busy} onClick={() => void answer(false)}>
          No thanks
        </button>
      </div>
    </div>
  )
}

/** A gift landing: a card that flies in, then fades after a few seconds unless opened. */
function ArrivalCard({ arrival, onSeen, onOpen }: { arrival: Arrival; onSeen: () => void; onOpen: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onSeen, 7000)
    return () => window.clearTimeout(timer)
  }, [onSeen])
  return (
    <button type="button" className={styles.arrival} onClick={onOpen} title="Open your Items">
      <Icon name="items" size={28} />
      <span>{arrival.text}</span>
    </button>
  )
}

const BattleMap = lazy(() => import('../../map/BattleMap.tsx'))

const NO_CAST = () => Promise.reject(new Error('There’s no fight going on.'))

/** A feature just used: what to put back, and its event in the fight (for its part of the turn). */
type LastUse = { text: string; revert: TrackerPatch; event: CombatEvent | null }

/** A fight and the battle map, as a player sees them. */
export type PlayerCombatProps = {
  fight: FightControls['fight']
  rollInitiative: FightControls['rollInitiative']
  endTurn: () => void
  /** What has happened in the fight. */
  events: CombatEvent[]
  attack: FightControls['attack']
  offhandAttack: FightControls['offhandAttack']
  applyItem: FightControls['applyItem']
  act: FightControls['act']
  /** Spells: casting one, and the save to keep concentrating after taking damage. */
  cast: FightControls['cast']
  concentrationSave: FightControls['concentrationSave']
  /** Features used in a fight (Rage), and taking your own newest action back. */
  applyFeature: FightControls['applyFeature']
  takeBack: FightControls['takeBack']
  /** Areas on the battle map (Darkness, a dragon's breath). */
  areas: Area[]
  /** Chances to strike someone moving out of your reach (opportunity attacks). */
  prompts: FightControls['prompts']
  strike: FightControls['strike']
  letGo: FightControls['letGo']
  deathSave: FightControls['deathSave']
  /** The battle map on stage, or null when the stage shows a picture. */
  map: Asset | null
  tokens: TokenControls
  playersMove: boolean
  pointers: {
    hands: Pointer[]
    pings: (Pointer & { id: number })[]
    sendHand: (x: number, y: number) => void
    sendPing: (x: number, y: number) => void
  }
}

const PANEL_BUTTONS: { label: string; icon: IconName; tab?: SheetTabName; title: string }[] = [
  { label: 'Sheet', icon: 'sheet', tab: 'sheet', title: 'Character sheet' },
  { label: 'Items', icon: 'items', tab: 'inventory', title: 'What you carry and your coins' },
  { label: 'Powers', icon: 'powers', tab: 'powers', title: 'Features and spells' },
  { label: 'Journal', icon: 'journal', title: 'Journal arrives in Phase 2' },
  { label: 'Lore', icon: 'lore', title: 'Handouts arrive in Phase 2' },
]

/**
 * Screen 02, "At the table": the scene fills the screen and your character floats over it. Dice
 * thrown by anyone at the table land in the middle, followed by their result.
 */
export function TableView({
  campaignId,
  me,
  character,
  members,
  characters,
  online,
  onUpdate,
  saveError,
  diceStyle,
  onDiceStyleChange,
  thrower,
  asking,
  stageImage = null,
  campaignName,
  audio,
  combat,
  handOver,
  arrivals = [],
  onArrivalSeen,
  offers = [],
  onAnswerOffer,
  stash,
  shopping,
  canAddGear = true,
  readAloud = '',
}: TableViewProps) {
  const [shopOpen, setShopOpen] = useState(false)
  const [inspected, setInspected] = useState<string | null>(null)
  // The attack you're about to make, while you pick its target.
  const [aiming, setAiming] = useState<AttackEntry | null>(null)
  // What kind of bonus attack the aimed attack is, if it's one (chosen from the Bonus action ready card).
  const [aimingBonus, setAimingBonus] = useState<BonusAttackKind | null>(null)
  // The weapon last used with the Attack action, so the off-hand attack offers the other one.
  const [mainAttack, setMainAttack] = useState<string | null>(null)
  // An item waiting for its target (a potion to give, a kit, a flask to throw), or a potion asking drink or give.
  const [aimingItem, setAimingItem] = useState<ItemEntry | null>(null)
  const [itemChoice, setItemChoice] = useState<ItemEntry | null>(null)
  // Flurry of Blows is two strikes: which one is next.
  const [flurryStrike, setFlurryStrike] = useState<1 | 2>(1)
  // The round the Bonus action ready card was put away in, so it stays away for the rest of the turn.
  const [bonusDismissed, setBonusDismissed] = useState<string | null>(null)
  // The last feature used, for a while, so it can be undone.
  const [lastUse, setLastUse] = useState<LastUse | null>(null)
  const [fightProblem, setFightProblem] = useState<string | null>(null)
  const [sheetTab, setSheetTab] = useState<SheetTabName | null>(null)
  const [mode, setMode] = useState<RollMode>('normal')
  const [secret, setSecret] = useState(false)
  // Your answer to the DM's request shows as the big result card once its dice land, until you close it.
  const [landed, setLanded] = useState<string | null>(null)
  const [closedResult, setClosedResult] = useState<string | null>(null)
  const characterId = character.id
  const onLanded = useCallback(
    (thrown: Roll) => {
      if (thrown.requestId && thrown.characterId === characterId) setLanded(thrown.id)
    },
    [characterId],
  )
  const { attach: attachTray, throwDice } = useDiceTray()
  const table = useTableRolls({ campaignId, userId: me.user_id, throwDice, thrower, onLanded })
  const { request } = asking
  const askedMe = request?.characterIds.includes(character.id) ?? false
  const myAnswer = asking.answers.find((answer) => answer.characterId === character.id)
  const showResult = myAnswer && landed === myAnswer.id && closedResult !== myAnswer.id
  const chips = requestChips({ request, answers: asking.answers, members, characters, viewerId: me.user_id })

  // The fight, as the party knows it.
  const fight = combat?.fight ?? null
  const rows = fight ? fightRows(fight, characters, 'player') : []
  const mine = fight?.combatants.find((c) => c.characterId === character.id) ?? null
  const myTurn = Boolean(fight && mine && fight.encounter.currentId === mine.id)
  const acting = rows.find((r) => r.status === 'acting')
  const badges: Record<string, string> = {}
  for (const row of rows) {
    if (row.character && row.combatant.initiative !== null)
      badges[row.character.ownerId] = String(row.combatant.initiative)
  }

  // Your turn, as the server keeps it: movement left, and attacks left from your action.
  const tokens = combat?.tokens.tokens ?? []
  const myToken = tokens.find((t) => t.characterId === character.id)
  const feetLeft = mine ? movementLeft(mine.turn, character.speed) : character.speed
  const perAction = attacksPerAction(character.className, character.level)
  const mapView = combat
    ? mapTokens(
        tokens,
        { characters, combatants: fight?.combatants ?? [], secrets: [], currentId: fight?.encounter.currentId ?? null },
        {
          userId: me.user_id,
          isDm: false,
          playersMove: combat.playersMove,
          // Before the first turn everyone places their miniature; after that, on your own turn
          // (not while unconscious at 0 hit points).
          moveNow: !mine || (myTurn && character.currentHp > 0) || fight?.encounter.currentId === null,
        },
      )
    : []
  const nameOf = (id: string | null) => rows.find((r) => r.combatant.id === id)?.name ?? 'Someone'

  // A chance to strike someone moving away, and death saves at 0 hit points.
  const myChance = (mine && combat?.prompts.find((p) => p.combatantId === mine.id)) || null
  const myRow = rows.find((r) => r.combatant.id === mine?.id)
  const provokerRow = rows.find((r) => r.combatant.id === myChance?.provokerId)
  const myStrikes = myRow ? strikesFor(myRow, null) : []
  function strikeBack(strike: Strike) {
    if (!myChance || !provokerRow || !combat) return
    const request = strike.build(provokerRow)
    void table.rollWith(() => combat.strike(myChance, request))
  }
  const dyingNow = Boolean(fight && mine && character.currentHp === 0)

  // Attacking: click the card, then the target (on the map or in the turn order); the server does
  // the rest. Outside a fight the card just rolls.
  function attackWith(attack: AttackEntry) {
    setFightProblem(null)
    casting.cancel()
    if (!fight || !mine) return roll(attackRoll(character, attack, choices))
    if (!myTurn) return setFightProblem('Wait for your turn to attack.')
    const left = attacksLeft(mine.turn, perAction)
    if (left === 0 && !offhandReady(attack)) return setFightProblem('You have used your action this turn.')
    setAiming(attack)
  }

  // A second attack with a light weapon in the other hand, for the bonus action (two-weapon fighting).
  function offhandReady(attack: AttackEntry): boolean {
    return Boolean(mine && myTurn && canAttackOffhand(character, mine.turn, attack))
  }

  // How far a target is, whether the attack reaches, and what changes the roll.
  function attackPlan(attack: AttackEntry, row: FightRow, offhand: boolean) {
    const targetToken = tokens.find((t) =>
      row.combatant.characterId ? t.characterId === row.combatant.characterId : t.combatantId === row.combatant.id,
    )
    const feet = myToken && targetToken ? feetBetween(myToken, targetToken) : null
    const range = feet === null ? null : inReach(weaponReach(findWeapon(attack.weapon)), feet)
    const target = {
      conditions: row.character?.conditions ?? row.combatant.conditions,
      dodging: row.combatant.turn.dodging,
    }
    const targetMode = attackMode(mode, target, feet)
    const rollChoices = {
      ...choices,
      mode: range?.disadvantage ? combineModes([targetMode, 'disadvantage']) : targetMode,
      secret: false,
    }
    const request = offhand
      ? offhandAttackRoll(character, attack, rollChoices)
      : attackRoll(character, attack, rollChoices)
    return { feet, range, request }
  }

  function pickTarget(row: FightRow) {
    if (!aiming || !mine || !combat) return
    const kind: BonusAttackKind | null = aimingBonus ?? (attacksLeft(mine.turn, perAction) === 0 ? 'offhand' : null)
    const { range, request } = attackPlan(aiming, row, kind === 'offhand')
    if (range && !range.allowed) {
      setFightProblem(`${range.why}. Move closer, or pick another attack.`)
      setAiming(null)
      setAimingBonus(null)
      return
    }
    const attack = aiming
    if (!kind) setMainAttack(attack.id)
    setAiming(null)
    setAimingBonus(null)
    setMode('normal')
    void table
      .rollWith(() =>
        kind ? combat.offhandAttack(mine, row.combatant, request, kind) : combat.attack(mine, row.combatant, request),
      )
      .then((thrown) => {
        // Flurry of Blows is two strikes: aim the second straight away.
        if (thrown && kind === 'flurry' && flurryStrike === 1) {
          setFlurryStrike(2)
          setAiming(attack)
          setAimingBonus('flurry')
        }
      })
  }

  // Taking a bonus action the turn has just made ready: aim the attack, and spend a ki point if it costs one.
  function takeBonus(choice: BonusChoice) {
    setFightProblem(null)
    casting.cancel()
    if (choice.entry.cost === '1 ki point' && !spendKi()) return
    if (choice.entry.attack === 'flurry') setFlurryStrike(1)
    setAiming(choice.attack)
    setAimingBonus(choice.entry.attack ?? null)
  }

  // A monk's ki points, kept as a feature named Ki (or Ki Points) on the sheet.
  function spendKi(): boolean {
    const ki = character.features.find((f) => /^ki\b/i.test(f.name.trim()) && f.usesMax !== null)
    if (!ki) return true
    if (ki.usesLeft <= 0) {
      setFightProblem('No ki points left until you rest.')
      return false
    }
    update({ features: character.features.map((f) => (f.id === ki.id ? { ...f, usesLeft: f.usesLeft - 1 } : f)) })
    return true
  }

  // Using something from the pack. In a fight it takes the action (decision 36); outside one, a potion
  // or antitoxin just works, and the rest is for the DM to describe.
  function playItem(entry: ItemEntry) {
    setFightProblem(null)
    setAiming(null)
    casting.cancel()
    const { use } = entry
    if (!fight || !mine) {
      if (use.kind === 'heal') return void drinkOutside(entry)
      if (use.kind === 'effect' && use.effect) {
        update({
          effects: [...character.effects.filter((e) => e.key !== use.effect?.key), use.effect],
          inventory: oneLess(entry),
        })
        return
      }
      return setFightProblem(`Tell the DM how you use the ${entry.item.name.toLowerCase()}.`)
    }
    if (!myTurn) return setFightProblem('Wait for your turn to use it.')
    if (mine.turn.actionUsed || mine.turn.attacksMade > 0)
      return setFightProblem('You have used your action this turn.')
    if (use.kind === 'heal') return setItemChoice(entry)
    if (use.kind === 'stabilise' || use.kind === 'throw') return setAimingItem(entry)
    runItem(entry, null)
  }

  function oneLess(entry: ItemEntry) {
    return character.inventory.flatMap((i) => {
      if (i.id !== entry.item.id) return [i]
      if (i.uses !== null) return i.uses > 1 ? [{ ...i, uses: i.uses - 1 }] : []
      return i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : []
    })
  }

  async function drinkOutside(entry: ItemEntry) {
    const { use, item } = entry
    const thrown = await table.roll({
      ...freeRoll(use.dice ?? [], { characterId: character.id, modifier: use.bonus ?? 0 }),
      label: item.name,
    })
    if (!thrown) return
    update({ currentHp: Math.min(character.maxHp, character.currentHp + thrown.total), inventory: oneLess(entry) })
  }

  function runItem(entry: ItemEntry, target: FightRow | null) {
    if (!mine || !combat) return
    let request: RollRequest | null = null
    if (entry.use.kind === 'throw' && target) {
      // An improvised throw: Dexterity, no proficiency, and the flask's own damage.
      const base = attackRoll(
        character,
        {
          id: entry.item.id,
          name: entry.item.name,
          weapon: null,
          proficient: false,
          magicBonus: 0,
          ability: 'dexterity',
          damageDice: '',
          damageType: entry.use.damageType ?? '',
        },
        { ...choices, secret: false },
      )
      request = {
        ...base,
        label: entry.item.name,
        damage: { dice: entry.use.dice ?? [], modifier: 0, type: entry.use.damageType ?? '' },
      }
    }
    setAimingItem(null)
    setItemChoice(null)
    void table
      .rollWith(() => combat.applyItem(mine, entry.item.id, target?.combatant ?? null, request))
      .catch((caught: unknown) => setFightProblem(messageFor(caught)))
  }

  // Picking who an item is for: a friend next to you (a potion, a kit), or a foe within 20 feet (a flask).
  function pickItemTarget(row: FightRow) {
    if (!aimingItem || !mine) return
    const { use } = aimingItem
    const targetToken = tokens.find((t) =>
      row.combatant.characterId ? t.characterId === row.combatant.characterId : t.combatantId === row.combatant.id,
    )
    const feet = myToken && targetToken ? feetBetween(myToken, targetToken) : null
    if (use.kind === 'throw') {
      if (row.combatant.id === mine.id) return setFightProblem('Throw it at someone else.')
      if (feet !== null && feet > (use.rangeFt ?? 20)) {
        return setFightProblem(`${row.name} is ${feet} ft away: you can throw it ${use.rangeFt ?? 20} ft.`)
      }
    } else {
      if (!row.character) return setFightProblem('That’s for someone in the party.')
      if (feet !== null && feet > 5) return setFightProblem(`Get next to ${row.name} first (${feet} ft away).`)
      if (use.kind === 'stabilise' && row.character.currentHp > 0) {
        return setFightProblem(`${row.name} isn’t down: a healer’s kit steadies someone at 0 hit points.`)
      }
    }
    runItem(aimingItem, row)
  }

  // Undo stays on offer for half a minute.
  useEffect(() => {
    if (!lastUse) return
    const timer = setTimeout(() => setLastUse(null), 30_000)
    return () => clearTimeout(timer)
  }, [lastUse])

  // Escape puts the attack away again.
  useEffect(() => {
    if (!aiming) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setAiming(null)
      setAimingBonus(null)
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [aiming])
  const inspectedToken = tokens.find((t) => t.id === inspected)
  const inspectedRow = inspectedToken
    ? (rows.find((r) =>
        inspectedToken.characterId
          ? r.combatant.characterId === inspectedToken.characterId
          : r.combatant.id === inspectedToken.combatantId,
      ) ?? null)
    : null

  async function rollMyInitiative() {
    if (!combat || !mine) return
    setMode('normal')
    await combat.rollInitiative(mine, initiativeRoll(character, { mode }))
  }
  const sheet = deriveSheet(character)
  const update = (patch: TrackerPatch) => onUpdate(character.id, patch)
  const conditions = character.conditions.map((c) => findCondition(c)?.name ?? c)
  const choices = { mode, secret }

  // Spells from the hand: in a fight, a target or where it goes next (the server settles it);
  // outside one, the slot is spent and the dice rolled here.
  const spellList = useSrd(loadSpells)
  // A concentration spell's timer starts with it (the server counts it down in a fight).
  const concentrating = character.concentration
  const effects = character.effects
  useEffect(() => {
    if (!concentrating || effects.some((e) => e.key === 'concentration' && e.spell === concentrating)) return
    const spell = spellList?.find((s) => s.name === concentrating)
    const timer = spell ? concentrationTimer(spell.name, spell.duration) : null
    if (timer) onUpdate(character.id, { effects: [...effects.filter((e) => e.key !== 'concentration'), timer] })
  }, [concentrating, effects, spellList, character.id, onUpdate])

  // Saying when a timed effect runs out (Rage after its 10 rounds).
  const [ranOut, setRanOut] = useState<string | null>(null)

  // A roll for the DM: a plain d20 (with advantage or disadvantage); the DM says what it was.
  const [dmSaid, setDmSaid] = useState<string | null>(null)
  const forTheDm = useRef(new Set<string>())
  function rollForTheDm(how: RollMode) {
    setMode('normal')
    if (thrower) {
      // The previews throw in the browser, with no DM to say what it was.
      void table.roll({
        ...freeRoll([{ sides: 20, count: 1 }], { characterId: character.id, mode: how }),
        label: 'A roll for the DM',
        kind: 'check',
      })
      return
    }
    void table
      .rollWith(() => rollForDm(campaignId, character.id, how))
      .then((thrown) => {
        if (thrown) forTheDm.current.add(thrown.id)
      })
  }
  const onRollChanged = useCallback((changed: Roll) => {
    if (!forTheDm.current.has(changed.id) || changed.forDm) return
    forTheDm.current.delete(changed.id)
    if (changed.label === 'A roll for the DM') return
    const verdict = changed.passed === null ? '' : changed.passed ? ' You passed.' : ' You failed.'
    setDmSaid(`The DM counted your roll as ${changed.label}: ${changed.total}.${verdict}`)
  }, [])
  useRollChanges(campaignId, me.user_id, onRollChanged)
  useEffect(() => {
    if (!dmSaid) return
    const timer = setTimeout(() => setDmSaid(null), 12_000)
    return () => clearTimeout(timer)
  }, [dmSaid])
  const before = useRef<Effect[]>(effects)
  useEffect(() => {
    const gone = before.current.filter(
      (e) => e.roundsLeft !== undefined && e.roundsLeft <= 1 && !effects.some((now) => now.key === e.key),
    )
    before.current = effects
    if (gone.length > 0) setRanOut(`Time's up: ${gone.map((e) => e.name).join(' and ')} ended.`)
  }, [effects])
  useEffect(() => {
    if (!ranOut) return
    const timer = setTimeout(() => setRanOut(null), 8000)
    return () => clearTimeout(timer)
  }, [ranOut])

  const casting = useCasting(combat?.cast ?? NO_CAST, table.rollWith, tokens, rows)
  const aimingSpell = casting.casting
  function castSpell(spell: SrdSpell) {
    setFightProblem(null)
    casting.clearProblem()
    setAiming(null)
    if (!fight || !mine || !myRow) return castOutside(spell)
    const why = whyNot(spell, character, mine, myTurn)
    if (why) return setFightProblem(`${why}.`)
    casting.begin(myRow, spell)
  }

  // Outside a fight: spend the slot, start concentrating, and roll what it does.
  function castOutside(spell: SrdSpell) {
    const slot = slotChoices(character.spellcasting, spell.level)[0]
    if (slot === undefined) return setFightProblem(`No slots left for ${spell.name}.`)
    const patch: TrackerPatch = {}
    if (slot > 0) {
      patch.spellcasting = {
        ...character.spellcasting,
        slotsUsed: character.spellcasting.slotsUsed.map((used, i) => (i === slot - 1 ? used + 1 : used)),
      }
    }
    if (spell.concentration) patch.concentration = spell.name
    if (Object.keys(patch).length > 0) update(patch)
    const effect = spellEffect(spell, slot, character.level, spellModifier(character))
    const ability = character.spellcasting.ability
    if (spell.attackType && ability) {
      roll(spellAttackRoll(character, spell, ability, effect && { ...effect, type: effect.type ?? '' }, choices))
    } else if (effect && effect.dice.length > 0) {
      roll({
        ...freeRoll(effect.dice, { ...choices, characterId: character.id, modifier: effect.modifier }),
        label: `${spell.name} ${spell.heal ? 'healing' : 'damage'}`,
      })
    }
  }
  const saveConcentration = () => void table.rollWith(() => combat?.concentrationSave(character.id) ?? NO_CAST())

  function roll(request: RollRequest) {
    // Advantage and disadvantage are for the next d20 roll only.
    if (isSingleD20(request.dice)) setMode('normal')
    void table.roll(request)
  }

  const rolls: SheetRolls = {
    ability: (ability) => roll(abilityCheck(character, ability, choices)),
    save: (ability) => roll(savingThrow(character, ability, choices)),
    skill: (index) => roll(skillCheck(character, index, choices)),
    initiative: () => roll(initiativeRoll(character, choices)),
    attack: attackWith,
    hitDie: () => void spendHitDie(),
    deathSave: () => void rollDeathSave(),
    disabled: table.rolling,
  }

  // In a fight the server rolls it and keeps count; outside one, the pips are ticked here.
  async function rollDeathSave() {
    if (fight && mine && combat) {
      void table.rollWith(() => combat.deathSave(mine))
      return
    }
    const thrown = await table.roll({
      ...freeRoll([{ sides: 20, count: 1 }], { characterId: character.id }),
      kind: 'save',
      label: 'Death saving throw',
    })
    if (thrown) update(deathSavePatch(character, thrown.natural ?? thrown.total))
  }

  async function spendHitDie() {
    const con = abilityModifier(character.scores.constitution)
    const thrown = await table.roll({
      ...freeRoll([{ sides: character.hitDie as 6 | 8 | 10 | 12, count: 1 }], {
        characterId: character.id,
        modifier: con,
      }),
      label: 'Hit die',
      parts: [{ label: 'Constitution', value: con }],
    })
    if (!thrown) return
    const healing = hitDieHealing(thrown.total - con, con)
    update({
      currentHp: Math.min(character.maxHp, character.currentHp + healing),
      hitDiceUsed: character.hitDiceUsed + 1,
    })
  }

  async function answer() {
    if (!request) return
    setMode('normal')
    const thrown = await table.roll(answerRoll(character, request, { mode }))
    if (thrown) asking.putAnswer(thrown)
  }

  // Using a feature: its part of the turn (in a fight), a use, and what it does to the sheet,
  // with Undo for a while. The fight part goes first, so a refusal changes nothing.
  async function playFeature(feature: FeatureEntry) {
    setFightProblem(null)
    const rule = featureRule(feature.name)
    const cost = featureCost(feature.name, feature.description)
    // Clicking Rage while raging ends it.
    if (rule === 'rage' && isRaging(character)) return endRage()
    if (feature.usesMax !== null && feature.usesLeft <= 0) {
      return setFightProblem(`No uses of ${feature.name} left until you rest.`)
    }
    let event: CombatEvent | null = null
    if (fight && mine && combat && cost !== 'free') {
      try {
        event = await combat.applyFeature(mine, feature.name, cost)
      } catch (caught) {
        setFightProblem(messageFor(caught))
        return
      }
    }
    const before: TrackerPatch = { features: character.features }
    const patch: TrackerPatch = {
      features: character.features.map((f) =>
        f.id === feature.id && f.usesMax !== null ? { ...f, usesLeft: Math.max(0, f.usesLeft - 1) } : f,
      ),
    }
    if (rule === 'rage') {
      before.effects = character.effects
      patch.effects = [...character.effects.filter((e) => e.key !== RAGE.key), RAGE]
    }
    if (rule === 'secondWind') {
      const thrown = await table.roll({
        ...freeRoll([{ sides: 10, count: 1 }], { characterId: character.id, modifier: character.level }),
        label: 'Second Wind',
      })
      if (thrown) {
        before.currentHp = character.currentHp
        patch.currentHp = Math.min(character.maxHp, character.currentHp + thrown.total)
      }
    }
    update(patch)
    setLastUse({ text: `You used ${feature.name}.`, revert: before, event })
  }

  function undoLastUse() {
    if (!lastUse) return
    update(lastUse.revert)
    if (lastUse.event && combat)
      combat.takeBack(lastUse.event).catch((caught: unknown) => setFightProblem(messageFor(caught)))
    setLastUse(null)
  }

  function endRage() {
    update({ effects: character.effects.filter((e) => e.key !== RAGE.key) })
  }

  // Bonus actions something on this turn has just made ready (you attacked; you're raging), offered
  // once a turn with a card the player can put away.
  const bonusKey = fight && mine ? `${fight.encounter.id}-${fight.encounter.round}` : ''
  const readyEntries: BonusEntry[] =
    fight && mine && !dyingNow && bonusDismissed !== bonusKey
      ? triggeredBonus(character, { myTurn, bonusUsed: mine.turn.bonusUsed, attacksMade: mine.turn.attacksMade })
      : []
  const readyNow: BonusChoice[] = readyEntries.flatMap((entry): BonusChoice[] => {
    if (entry.attack === 'offhand') {
      const light = lightWeapons(character)
      const others = light.filter((a) => a.id !== mainAttack)
      return (others.length > 0 ? others : light).map((attack) => ({
        entry,
        attack,
        label: `Off-hand attack: ${attack.name}`,
      }))
    }
    if (entry.attack === 'martialArts' || entry.attack === 'flurry') {
      return [{ entry, attack: unarmedStrike(character), label: entry.name }]
    }
    if (entry.attack === 'frenzy') {
      return character.attacks
        .filter((a) => findWeapon(a.weapon)?.range !== 'Ranged')
        .map((attack) => ({ entry, attack, label: `Frenzy attack: ${attack.name}` }))
    }
    return []
  })

  // The bonus attacks this character has at all, as cards in the Bonus actions set.
  const meleeAttack = character.attacks.find((a) => findWeapon(a.weapon)?.range !== 'Ranged') ?? null
  const bonusAttackCards = bonusEntries(character)
    .filter((entry) => entry.attack && entry.attack !== 'offhand')
    .flatMap((entry) => {
      const attack = entry.attack === 'frenzy' ? meleeAttack : unarmedStrike(character)
      if (!attack) return []
      const ready =
        fight && mine
          ? isReady(entry, character, {
              myTurn,
              bonusUsed: mine.turn.bonusUsed,
              attacksMade: mine.turn.attacksMade,
            })
          : false
      const why = ready
        ? null
        : !fight
          ? 'in a fight, on your turn'
          : entry.trigger === 'afterAttack'
            ? 'attack with your action first'
            : 'while raging, from the turn after it starts'
      return [{ entry, attack, label: entry.name, why }]
    })

  return (
    <main className={styles.screen}>
      <div className={styles.floor} aria-hidden="true" />
      {combat?.map ? (
        <div className={styles.stageImage}>
          <Suspense fallback={null}>
            <BattleMap
              map={combat.map}
              tokens={mapView}
              selectedId={inspected}
              onSelect={(id) => {
                const token = tokens.find((t) => t.id === id)
                const row = token
                  ? rows.find((r) =>
                      token.characterId
                        ? r.combatant.characterId === token.characterId
                        : r.combatant.id === token.combatantId,
                    )
                  : undefined
                if (aimingSpell?.mode === 'target' && !aimingSpell.chosen && row) aimingSpell.onPick(row)
                else if (aimingItem && row) pickItemTarget(row)
                else if (aiming && row && row.combatant.id !== mine?.id) pickTarget(row)
                else setInspected(id)
              }}
              onMove={(id, x, y) => {
                const token = tokens.find((t) => t.id === id)
                if (token) combat.tokens.move(token, x, y)
              }}
              reach={myTurn && myToken && !dyingNow ? { tokenId: myToken.id, feet: feetLeft } : null}
              aim={
                aiming && myToken
                  ? (() => {
                      const reach = weaponReach(findWeapon(aiming.weapon))
                      return {
                        tokenId: myToken.id,
                        near: Math.max(reach.melee ?? 0, reach.normal ?? 0),
                        long: reach.long,
                      }
                    })()
                  : aimingSpell?.mode === 'target' && !aimingSpell.chosen && aimingSpell.rangeFt !== null && myToken
                    ? { tokenId: myToken.id, near: aimingSpell.rangeFt, long: null }
                    : null
              }
              targeting={aiming !== null || (aimingSpell?.mode === 'target' && !aimingSpell.chosen)}
              areas={
                // An area placed but not yet cast shows where it went.
                aimingSpell?.chosen?.template && aimingSpell.area
                  ? [
                      ...combat.areas,
                      {
                        ...aimingSpell.chosen.template,
                        id: 'placed',
                        label: aimingSpell.label,
                        tone: aimingSpell.area.tone,
                        hidden: false,
                      },
                    ]
                  : combat.areas
              }
              placing={
                aimingSpell?.mode === 'area' && aimingSpell.area && !aimingSpell.chosen
                  ? {
                      shape: aimingSpell.area.shape,
                      sizeFt: aimingSpell.area.sizeFt,
                      tone: aimingSpell.area.tone,
                      label: aimingSpell.label,
                      from: aimingSpell.area.fromCaster && myToken ? { x: myToken.x, y: myToken.y } : null,
                      onPlace: aimingSpell.onPlace,
                    }
                  : null
              }
              hands={combat.pointers.hands}
              pings={combat.pointers.pings}
              onHand={combat.pointers.sendHand}
              onPing={combat.pointers.sendPing}
            />
          </Suspense>
        </div>
      ) : stageImage ? (
        <div className={styles.stageImage}>
          <StoredImage path={stageImage.path} alt={`The scene: ${stageImage.name}`} />
        </div>
      ) : (
        <div className={styles.scene}>
          <div className={styles.parchment}>
            <div className={styles.parchmentEyebrow}>Welcome to</div>
            <h1 className={styles.parchmentTitle}>{campaignName || 'The Adventure'}</h1>
            <div className={styles.flourish} aria-hidden="true">
              <span />
              ✦
              <span />
            </div>
            <p className={styles.parchmentNote}>
              The DM will set the scene soon. Pictures, maps and your dice appear here.
            </p>
          </div>
        </div>
      )}
      {readAloud && !fight && <ReadAloud text={readAloud} className={styles.readAloud} />}
      <div className={styles.topChips}>
        {fight && (
          <TurnBanner round={fight.encounter.round} mine={myTurn} acting={acting && !myTurn ? acting.name : null} />
        )}
        {fight && (
          <InitiativeRibbon
            rows={rows}
            picking={
              aimingSpell?.mode === 'target' && !aimingSpell.chosen
                ? { canPick: () => true, onPick: aimingSpell.onPick }
                : aimingItem
                  ? { canPick: () => true, onPick: (row) => pickItemTarget(row) }
                  : aiming
                    ? { canPick: (row) => row.combatant.id !== mine?.id, onPick: (row) => pickTarget(row) }
                    : null
            }
          />
        )}
        {aimingItem && (
          <div className={styles.aiming} role="status">
            {aimingItem.use.kind === 'throw'
              ? `Throw the ${aimingItem.item.name.toLowerCase()}: click who at, within ${aimingItem.use.rangeFt ?? 20} ft.`
              : aimingItem.use.kind === 'stabilise'
                ? 'Use the healer’s kit: click the friend who is down, next to you.'
                : `Give the ${aimingItem.item.name.toLowerCase()}: click the friend next to you.`}
            <button type="button" className={styles.aimingCancel} onClick={() => setAimingItem(null)}>
              Cancel
            </button>
          </div>
        )}
        {aiming && (
          <div className={styles.aiming} role="status">
            {aimingBonus === 'flurry'
              ? `Flurry of Blows, ${flurryStrike === 2 ? 'second' : 'first'} strike (your bonus action)`
              : aimingBonus === 'martialArts'
                ? 'Unarmed strike (your bonus action)'
                : aimingBonus === 'frenzy'
                  ? `Frenzy attack with ${aiming.name || 'your weapon'} (your bonus action)`
                  : mine && (aimingBonus === 'offhand' || attacksLeft(mine.turn, perAction) === 0)
                    ? `Off-hand attack with ${aiming.name || 'your weapon'} (your bonus action)`
                    : `Pick a target for ${aiming.name || 'your attack'}`}
            : click a miniature or a name above.
            <button
              type="button"
              className={styles.aimingCancel}
              onClick={() => {
                setAiming(null)
                setAimingBonus(null)
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {aimingSpell && (
          <div className={styles.aiming} role="status">
            {aimingSpell.mode === 'target'
              ? `Cast ${aimingSpell.label}: click who it's for, on the map or above.`
              : `Cast ${aimingSpell.label}: ${aimingSpell.area?.fromCaster ? 'point it with the mouse and click' : 'click where it goes'}.`}
            <SlotPicker casting={aimingSpell} />
            <button type="button" className={styles.aimingCancel} onClick={casting.cancel}>
              Cancel
            </button>
          </div>
        )}
        {fight && combat && combat.events.length > 0 && (
          <CombatFeed className={styles.feed} events={combat.events} nameOf={nameOf} youId={mine?.id} limit={3} />
        )}
        {audio && <NowPlaying audio={audio} />}
        {shopping && shopping.shops.length > 0 && !shopOpen && (
          <button type="button" className={styles.shopButton} onClick={() => setShopOpen(true)}>
            <Icon name="items" size={22} />
            {shopping.shops.length === 1
              ? `${shopping.shops[0].name} is open`
              : `${shopping.shops.length} shops are open`}
          </button>
        )}
        {offers.length > 0 && onAnswerOffer && (
          <div className={styles.offers} aria-label="Offers for your things">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onAnswer={(sell) => onAnswerOffer(offer.id, sell)} />
            ))}
          </div>
        )}
        {arrivals.length > 0 && (
          <div className={styles.arrivals} role="status" aria-label="Just given to you">
            {arrivals.map((a) => (
              <ArrivalCard
                key={a.id}
                arrival={a}
                onSeen={() => onArrivalSeen?.(a.id)}
                onOpen={() => {
                  setSheetTab('inventory')
                  onArrivalSeen?.(a.id)
                }}
              />
            ))}
          </div>
        )}
      </div>
      {inspectedRow && (
        <div className={styles.inspect}>
          <InspectCard row={inspectedRow} onClose={() => setInspected(null)} />
        </div>
      )}

      {itemChoice && (
        <div className={styles.bonusReady}>
          <section className={styles.itemChoice} aria-label={itemChoice.item.name}>
            <div className={styles.itemChoiceTitle}>{itemChoice.item.name}</div>
            <p className={styles.itemChoiceText}>{itemChoice.use.what}</p>
            <div className={styles.itemChoiceButtons}>
              <button type="button" className={styles.itemChoiceMain} onClick={() => runItem(itemChoice, null)}>
                Drink it
              </button>
              <button
                type="button"
                className={styles.itemChoiceOther}
                onClick={() => {
                  setAimingItem(itemChoice)
                  setItemChoice(null)
                }}
              >
                Give it to someone
              </button>
              <button type="button" className={styles.itemChoiceOther} onClick={() => setItemChoice(null)}>
                Not now
              </button>
            </div>
          </section>
        </div>
      )}

      {readyNow.length > 0 && !aiming && (
        <div className={styles.bonusReady}>
          <BonusReady choices={readyNow} onTake={takeBonus} onNotNow={() => setBonusDismissed(bonusKey)} />
        </div>
      )}

      {(lastUse || ranOut || dmSaid) && (
        <div className={styles.cardPanel}>
          {lastUse && <UndoChip text={lastUse.text} onUndo={undoLastUse} onClose={() => setLastUse(null)} />}
          {ranOut && <UndoChip text={ranOut} onClose={() => setRanOut(null)} />}
          {dmSaid && <UndoChip text={dmSaid} onClose={() => setDmSaid(null)} />}
        </div>
      )}

      <Hand
        className={styles.hand}
        character={character}
        // Outside a fight, players roll a d20 for the DM, who says what it was.
        onRollForDm={fight ? null : rollForTheDm}
        onAttack={attackWith}
        onUseFeature={(feature) => void playFeature(feature)}
        turn={
          fight && mine ? { myTurn, bonusUsed: mine.turn.bonusUsed, offhand: (attack) => offhandReady(attack) } : null
        }
        bonusMoves={bonusMoves(character.className, character.level)}
        bonusAttacks={bonusAttackCards}
        items={usableItems(character.inventory).map((entry) => ({
          ...entry,
          why:
            fight && mine
              ? !myTurn
                ? 'wait for your turn'
                : mine.turn.actionUsed || mine.turn.attacksMade > 0
                  ? 'action used this turn'
                  : null
              : null,
        }))}
        onUseItem={playItem}
        onBonusAttack={takeBonus}
        onBonusMove={(move) => {
          if (!mine || !combat) return
          // A monk's Patient Defense and Step of the Wind cost a ki point.
          if (/monk/i.test(character.className) && !spendKi()) return
          combat.act(mine, `bonus_${move}`)
          if (move === 'hide') roll(skillCheck(character, 'stealth', choices))
        }}
        spells={
          character.spellcasting.spells.length > 0
            ? { list: spellList, whyNot: (spell) => whyNot(spell, character, mine, myTurn), onCast: castSpell }
            : null
        }
        disabled={table.rolling}
      />

      <DiceControls
        className={styles.dice}
        style={diceStyle}
        onStyleChange={onDiceStyleChange}
        mode={mode}
        onModeChange={setMode}
        secret={secret}
        onSecretChange={setSecret}
        onRoll={(dice) => roll(freeRoll(dice, { ...choices, characterId: character.id }))}
        onPractise={() =>
          table.showLocal(localRoll(PRACTICE_SET, { campaignId, rollerId: me.user_id, style: diceStyle }))
        }
        rolling={table.rolling}
      />

      <div className={styles.left}>
        <section className={styles.plate} aria-label="Your character">
          <div className={styles.who}>
            <Portrait path={character.portraitPath} size={60} name={character.name} />
            <div>
              <div className={styles.name}>{character.name}</div>
              <div className={styles.sub}>
                Level {character.level} · {me.display_name} (you)
              </div>
            </div>
          </div>
          {character.levelUpTo !== null && character.levelUpTo > character.level && (
            <a className={styles.levelUp} href={href(`/c/${campaignId}/level-up`)}>
              Level up! Go to level {character.level + 1}
            </a>
          )}
          <div>
            <div className={styles.hpLine}>
              <span className={styles.label}>Hit points</span>
              <span className={styles.hp}>
                {character.currentHp} <span className={styles.hpMax}>/ {character.maxHp}</span>
                {character.tempHp > 0 && <span className={styles.hpTemp}> +{character.tempHp}</span>}
              </span>
            </div>
            <div className={styles.hpBar}>
              <HpBar current={character.currentHp} max={character.maxHp} temp={character.tempHp} />
            </div>
          </div>
          <div className={styles.stats}>
            <StatBox label="AC" value={character.armourClass} title="Armour class" />
            <StatBox label="Speed" value={character.speed} title="Speed in feet" />
            <StatBox
              label="Init."
              value={formatBonus(sheet.initiative)}
              title="Roll initiative"
              onClick={rolls.initiative}
              disabled={table.rolling}
            />
            <StatBox label="Percep." value={sheet.passivePerception} title="Passive Perception" />
          </div>
        </section>

        {/* Outside a fight there's no turn to wait for: roll when the DM says. */}
        {!fight && character.currentHp === 0 && (
          <DeathSaves
            saves={{
              successes: character.deathSaveSuccesses,
              failures: character.deathSaveFailures,
              stable: character.stable,
              dead: character.dead,
            }}
            onRoll={() => void rollDeathSave()}
            rolling={table.rolling}
          />
        )}
        {fight && mine && combat && dyingNow && (
          <DeathSaves
            saves={{
              successes: character.deathSaveSuccesses,
              failures: character.deathSaveFailures,
              stable: character.stable,
              dead: character.dead,
            }}
            onRoll={
              myTurn && isDying(character) && !mine.turn.actionUsed
                ? () => void table.rollWith(() => combat.deathSave(mine))
                : undefined
            }
            rolling={table.rolling}
          />
        )}

        <ConcentrationChip
          character={character}
          onLostIt={() => update({ concentration: null })}
          onSave={saveConcentration}
          rolling={table.rolling}
        />

        {fight && mine && combat && (
          <YourTurn
            turn={mine.turn}
            speed={character.speed}
            perAction={perAction}
            myTurn={myTurn}
            started={fight.encounter.currentId !== null}
            canAct={!dyingNow}
            bonusMoves={bonusMoves(character.className, character.level)}
            strength={character.scores.strength}
            onAct={(what) => {
              if (what.startsWith('bonus_') && /monk/i.test(character.className) && !spendKi()) return
              combat.act(mine, what)
              // Hiding and searching come with a roll.
              if (what === 'hide' || what === 'bonus_hide') roll(skillCheck(character, 'stealth', choices))
              if (what === 'search') roll(skillCheck(character, 'perception', choices))
            }}
            onEndTurn={combat.endTurn}
          />
        )}
        {fight && mine && (
          <AtAGlance
            character={character}
            spells={spellList}
            onOpen={(open) => (open.kind === 'feature' ? void playFeature(open.feature) : castSpell(open.spell))}
            onEndEffect={(key) =>
              update({
                effects: character.effects.filter((e) => e.key !== key),
                // Ending a concentration timer ends the concentration.
                ...(key === 'concentration' ? { concentration: null } : {}),
              })
            }
          />
        )}

        <section className={cx(styles.abilities, fight && styles.hiddenInFight)} aria-label="Abilities and conditions">
          <div className={styles.abilityRow}>
            {ABILITIES.map((ability) => (
              <button
                key={ability}
                type="button"
                className={styles.ability}
                title={`Roll ${aOrAn(ABILITY_NAME[ability])} check`}
                disabled={table.rolling}
                onClick={() => rolls.ability(ability)}
              >
                <span className={styles.abilityShort}>{ABILITY_SHORT[ability]}</span>
                <span className={styles.medallion}>{formatBonus(sheet.modifiers[ability])}</span>
                <span className={styles.score}>{character.scores[ability]}</span>
              </button>
            ))}
          </div>
          <div className={styles.status}>
            <span>
              <span className={styles.muted}>Conditions:</span> {conditions.length ? conditions.join(', ') : 'none'}
            </span>
            <button
              type="button"
              className={cx(styles.inspiration, character.inspiration && styles.inspired)}
              aria-pressed={character.inspiration}
              title={character.inspiration ? 'Click when you spend it' : 'The DM awards Inspiration'}
              onClick={() => update({ inspiration: !character.inspiration })}
            >
              <Icon name="star" size={16} filled={character.inspiration} />
              <span className={styles.muted}>Inspiration:</span> {character.inspiration ? 'yes' : 'not yet'}
            </button>
          </div>
        </section>

        <nav className={styles.panelButtons} aria-label="Panels">
          {PANEL_BUTTONS.map(({ label, icon, tab, title }) => (
            <button
              key={label}
              type="button"
              className={cx(styles.panelButton, tab && tab === sheetTab && styles.panelOpen)}
              title={title}
              disabled={!tab}
              onClick={() => tab && setSheetTab(sheetTab === tab ? null : tab)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <a className={styles.leave} href={href(`/c/${campaignId}`)}>
          Leave the table
        </a>
        {saveError && <Notice tone="error">{saveError}</Notice>}
        {table.error && <Notice tone="error">{table.error}</Notice>}
        {(fightProblem ?? casting.problem) && <Notice tone="error">{fightProblem ?? casting.problem}</Notice>}
      </div>

      <CameraColumn
        members={members}
        characters={characters}
        online={online}
        myId={me.user_id}
        chips={chips}
        badges={badges}
        turn={fight ? cameraTurn(rows, members.find((m) => m.role === 'dm')?.user_id ?? '') : null}
      />

      {sheetTab && (
        <>
          <div className={styles.shade} aria-hidden="true" onClick={() => setSheetTab(null)} />
          <SheetPanel
            className={styles.sheet}
            character={character}
            canEdit
            editHref={href(`/c/${campaignId}/character/${character.id}/edit`)}
            tab={sheetTab}
            onTab={setSheetTab}
            onClose={() => setSheetTab(null)}
            closeLabel="Back to the table"
            onUpdate={update}
            rolls={rolls}
            handing={handOver ? { party: characters, handOver } : undefined}
            stash={stash}
            canAddGear={canAddGear}
          />
        </>
      )}

      {shopping && shopOpen && (
        <ShopPanel character={character} shopping={shopping} onClose={() => setShopOpen(false)} />
      )}

      {fight && mine && mine.initiative === null && !(request && askedMe && !myAnswer) && (
        <div className={styles.asked}>
          <InitiativePrompt
            character={character}
            mode={mode}
            onRoll={() => void rollMyInitiative()}
            rolling={table.rolling}
          />
        </div>
      )}
      {character.concentration &&
        character.concentrationDc !== null &&
        !myChance &&
        !(request && askedMe && !myAnswer) && (
          <div className={styles.asked}>
            <ConcentrationPrompt
              spell={character.concentration}
              dc={character.concentrationDc}
              onRoll={saveConcentration}
              onLetGo={() => update({ concentration: null })}
              rolling={table.rolling}
            />
          </div>
        )}
      {myChance && combat && !(request && askedMe && !myAnswer) && (
        <div className={styles.asked}>
          <StrikePrompt
            provoker={provokerRow?.name ?? 'Someone'}
            strikes={myStrikes}
            onStrike={strikeBack}
            onLetGo={() => combat.letGo(myChance)}
            rolling={table.rolling}
          />
        </div>
      )}
      {request && askedMe && !myAnswer && (
        <div className={styles.asked}>
          <RollPrompt
            request={request}
            character={character}
            mode={mode}
            onModeChange={setMode}
            onRoll={() => void answer()}
            rolling={table.rolling}
          />
        </div>
      )}
      {request && myAnswer && showResult && (
        <div className={styles.asked}>
          <RollResult
            roll={myAnswer}
            shownDc={request.shownDc}
            outcomeHidden={!request.outcomeShown}
            onClose={() => setClosedResult(myAnswer.id)}
          />
        </div>
      )}

      <div ref={attachTray} className={styles.tray} aria-hidden="true" />
      <RollToasts
        className={styles.toasts}
        rolls={table.shown.filter((shown) => !(shown.requestId && shown.characterId === character.id))}
        members={members}
        characters={characters}
        onDismiss={table.dismiss}
        showVerdicts={!askedMe || Boolean(myAnswer)}
      />
    </main>
  )
}

type CameraColumnProps = {
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  myId: string
  /** A status chip per user id, such as "Your roll" or "Passed" while the DM's roll request is open. */
  chips?: Record<string, CameraChip>
  /** A small badge per user id in the tile's corner, such as their initiative in a fight. */
  badges?: Record<string, string>
  /** In a fight: tiles in turn order, a glow on whoever is acting, and who's next. */
  turn?: CameraTurn | null
  className?: string
}

/**
 * The camera column from the designs: everyone's live camera and voice (through VDO.Ninja), with
 * their name plate and HP, roll chips while the DM's request is open, and the turn order in a fight.
 */
export function CameraColumn({
  members,
  characters,
  online,
  myId,
  chips = {},
  badges = {},
  turn = null,
  className,
}: CameraColumnProps) {
  const call = useTableCall()
  const dms = members.filter((m) => m.role === 'dm')
  const players = members.filter((m) => m.role === 'player')
  const place = (m: Member) => (turn ? turn.order.indexOf(m.user_id) : -1)
  const ordered = turn
    ? [...players, ...dms].sort((a, b) => (place(a) < 0 ? 99 : place(a)) - (place(b) < 0 ? 99 : place(b)))
    : [...dms, ...players]
  return (
    <div className={cx(styles.cameras, className)} aria-label="The table">
      {ordered.map((member) => {
        const character = characters.find((c) => c.ownerId === member.user_id)
        const here = online.has(member.user_id)
        const you = member.user_id === myId
        const name = member.role === 'dm' ? member.display_name : (character?.name ?? member.display_name)
        const badge = badges[member.user_id] ?? (turn && member.role === 'dm' ? 'DM' : null)
        let who = member.role === 'dm' ? `Dungeon Master${turn ? ' · monsters' : ''}` : member.display_name
        if (turn?.acting === member.user_id) who += ' · acting now'
        else if (turn?.next === member.user_id) who += ' · next'
        else if (you) who += ' · you'
        return (
          <div
            key={member.user_id}
            className={cx(styles.tile, you && styles.you, turn?.acting === member.user_id && styles.acting)}
          >
            <CameraFeed
              userId={member.user_id}
              cameraId={member.camera_id}
              name={name}
              portraitPath={member.role === 'player' ? (character?.portraitPath ?? null) : null}
              online={here}
              you={you}
            />
            {badge && <span className={styles.badge}>{badge}</span>}
            {chips[member.user_id] && (
              <span className={cx(styles.chip, styles[`chip_${chips[member.user_id].tone}`])}>
                {chips[member.user_id].label}
              </span>
            )}
            {character?.concentration && member.role === 'player' && (
              <span
                className={cx(styles.concTag, character.concentrationDc !== null && styles.concOwed)}
                title="Concentrating on a spell"
              >
                <span className={styles.concSeal}>C</span>
                {character.concentration}
                {character.concentrationDc !== null && ` · save DC ${character.concentrationDc}`}
              </span>
            )}
            <div className={styles.namePlate}>
              <div className={styles.plateText}>
                <div className={styles.plateName}>
                  {name}
                  {isMuted(call, member.user_id, you) && (
                    <span className={callStyles.muted} title="Muted" aria-label="Muted">
                      <Icon name="micOff" size={12} />
                    </span>
                  )}
                </div>
                <div className={styles.plateWho}>{who}</div>
              </div>
              {character && member.role === 'player' && (
                <div className={styles.plateHp}>
                  <span>
                    {character.currentHp}/{character.maxHp}
                  </span>
                  <HpBar current={character.currentHp} max={character.maxHp} temp={character.tempHp} height={4} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
