import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { Icon, type IconName } from '../../components/Icon.tsx'
import { Notice } from '../../components/Notice.tsx'
import { useRulesKey } from '../rules/useRulesKey.ts'
import { Backdrop } from '../../components/Backdrop.tsx'
import { NowPlaying } from '../../audio/SoundControls.tsx'
import type { TableAudio } from '../../audio/useTableAudio.ts'
import { localRoll, PRACTICE_SET } from '../../dice/localRoll.ts'
import { RollLog } from '../../dice/RollLog.tsx'
import { RollToasts } from '../../dice/RollToasts.tsx'
import type { DiceStyle } from '../../dice/style.ts'
import { useDiceTray } from '../../dice/useDiceTray.ts'
import { useTableRolls } from '../../dice/useTableRolls.ts'
import type { Campaign, Member } from '../../live/campaigns.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { NotebookControls } from '../../live/useNotebook.ts'
import type { LogControls } from '../../live/useStage.ts'
import type { Roll } from '../../live/rolls.ts'
import type { RollLogState } from '../../live/useRollLog.ts'
import type { RequestControls } from '../../live/useRollRequest.ts'
import type { Character } from '../../rules/character.ts'
import { isSingleD20, type DiceGroup, type RollMode, type RollRequest } from '../../rules/dice.ts'
import { gainTempHp, heal, takeDamage } from '../../rules/maths/hitPoints.ts'
import { deathSavePatch } from '../../rules/dying.ts'
import type { RestPatch } from '../../rules/rest.ts'
import { namesText } from '../../rules/askable.ts'
import { findCondition } from '../../rules/srd/index.ts'
import {
  abilityCheck,
  answerRoll,
  attackRoll,
  freeRoll,
  initiativeRoll,
  savingThrow,
  skillCheck,
} from '../../rules/rolls.ts'
import { AskRollDialog } from '../rolls/AskRollDialog.tsx'
import { RequestResults } from '../rolls/RequestResults.tsx'
import { allAnswered, requestChips } from '../rolls/requestStatus.ts'
import { SheetPanel, type SheetTabName } from '../sheet/SheetPanel.tsx'
import type { SheetRolls } from '../sheet/SheetTab.tsx'
import { CameraColumn } from '../table/TableView.tsx'
import { DiceControls } from '../table/DiceControls.tsx'
import type { Combatant } from '../../live/combat.ts'
import type { FightControls } from '../../live/useFight.ts'
import { useSrd } from '../../live/useSrd.ts'
import { monsterInitiative } from '../../rules/combat.ts'
import { placeFighters } from '../../live/combat.ts'
import { messageFor } from '../../live/errors.ts'
import type { Asset, PresetPortrait } from '../../live/library.ts'
import { loadEquipment, loadMagicItems, loadMonsters, loadSpells } from '../../rules/srd/index.ts'
import { EncounterTab } from '../fight/EncounterTab.tsx'
import { AddMonsterDialog, StartFightDialog, type FightSetting } from '../fight/FightDialogs.tsx'
import { useAiming } from '../fight/useAiming.ts'
import { cameraTurn, fightRows, type FightRow } from '../fight/fightRows.ts'
import type { MonsterPick } from '../fight/MonsterPicker.tsx'
import { NotebookPanel } from './NotebookPanel.tsx'
import { PartyCards, type HitPointChange } from './PartyCards.tsx'
import { RestDialog } from './RestDialog.tsx'
import { GiveDialog } from './GiveDialog.tsx'
import { BoxDialog } from './give/BoxDialog.tsx'
import type { AskInput } from '../../live/rollRequests.ts'
import type { Container, Richness } from '../../rules/boxes.ts'
import type { Fight } from '../../rules/scenes.ts'
import { StoryTab } from './story/StoryTab.tsx'
import { NpcsTab } from './npcs/NpcsTab.tsx'
import { PasteDialog } from './story/PasteDialog.tsx'
import type { CampaignPlan } from '../../rules/campaignFile.ts'
import type { ImportContext } from '../../live/importCampaign.ts'
import type { NpcControls } from '../../live/npcs.ts'
import type { Scene, StoryControls } from '../../live/story.ts'
import type { Stage, StagePatch } from '../../live/stage.ts'
import { serverNow } from '../../live/clock.ts'
import { ShopDialog } from './give/ShopDialog.tsx'
import { HaggleCards } from './give/HaggleCards.tsx'
import type { ShopControls } from '../../live/shops.ts'
import type { Shop } from '../../rules/shops.ts'
import { entryId } from '../../rules/character.ts'
import { ItemsTab } from './ItemsTab.tsx'
import type { GivingControls } from '../../live/giving.ts'
import { useSessionClock } from './useSessionClock.ts'
import { useRollsForDm } from '../../live/useRollsForDm.ts'
import { RollsForDm } from '../rolls/RollsForDm.tsx'
import { SessionNotes } from './SessionNotes.tsx'
import type { LogEvent } from '../../live/notebook.ts'
import styles from './DmView.module.css'

type DmTab = 'story' | 'party' | 'encounter' | 'npcs' | 'items' | 'log'

const RulesPanel = lazy(() => import('../rules/RulesPanel.tsx'))

const TABS: { label: string; tab?: DmTab; title?: string }[] = [
  { label: 'Story', tab: 'story' },
  { label: 'Party', tab: 'party' },
  { label: 'Encounter', tab: 'encounter' },
  { label: 'NPCs', tab: 'npcs' },
  { label: 'Items and loot', tab: 'items' },
  { label: 'Log', tab: 'log' },
]

type Verb = 'ask' | 'rest' | 'note' | 'fight' | 'next' | 'monster' | 'end' | 'give' | 'npc'

type VerbButton = { label: string; icon: IconName; title: string; verb?: Verb; primary?: boolean }

const VERBS: VerbButton[] = [
  { label: 'Ask for a roll', icon: 'd20', title: 'Ask everyone, some or one to roll', verb: 'ask' },
  { label: 'Start combat', icon: 'sword', title: 'Start a fight: who, which monsters, then initiative', verb: 'fight' },
  { label: 'Show an NPC', icon: 'journal', title: 'Your people: show one on stage', verb: 'npc' },
  { label: 'Give an item', icon: 'items', title: 'Give an item or coins to someone', verb: 'give' },
  { label: 'Rest', icon: 'moon', title: 'A short or long rest for the party', verb: 'rest' },
  { label: 'Add a note', icon: 'log', title: 'Write a quick note into the log', verb: 'note' },
]

// The bottom bar during a fight (design 10).
const COMBAT_VERBS: VerbButton[] = [
  { label: 'Next turn', icon: 'play', title: 'The next in the turn order goes', verb: 'next', primary: true },
  { label: 'Ask for a roll', icon: 'd20', title: 'Ask everyone, some or one to roll', verb: 'ask' },
  { label: 'Add a monster', icon: 'sword', title: 'Add monsters from the SRD to this fight', verb: 'monster' },
  { label: 'Too hard? Rebalance', icon: 'star', title: 'Arrives in Phase 2' },
  {
    label: 'End fight',
    icon: 'moon',
    title: 'End the fight: the monsters leave the turn order and the map',
    verb: 'end',
  },
]

const HP_WORDS: Record<HitPointChange, string> = { damage: 'took', heal: 'healed', temp: 'gained' }

type DmViewProps = {
  campaign: Campaign
  me: Member
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  onUpdate: (characterId: string, patch: TrackerPatch) => void
  /** Lets characters go up a level (left out in the previews). */
  onLevelUp?: (characterIds: string[]) => void
  /** Every quick note and scene change, for searching past sessions (left out in the previews). */
  loadSessionNotes?: () => Promise<LogEvent[]>
  saveError?: string | null
  log: RollLogState
  diceStyle: DiceStyle
  onDiceStyleChange: (style: DiceStyle) => void
  /** Throws in the browser instead of on the server (the design preview, which has no database). */
  thrower?: (request: RollRequest) => Promise<Roll>
  /** The open request for a roll, its answers and what the DM can do about it. */
  asking: RequestControls
  notebook: NotebookControls
  /** The log's notes, damage and rests. */
  events: LogControls
  /** The one-line "Scene now" from the stage. */
  sceneName: string
  /** The table's sound in this tab (left out in the previews). */
  audio?: TableAudio
  /** The fight going on, if any, and what the DM can do about it. */
  fight: FightControls
  /** Battle maps in the library, and the one on stage now (if any), for Start combat. */
  maps?: Asset[]
  mapOnStage?: string | null
  startTab?: DmTab
  /** Giving items and coins, and the party stash. */
  giving: GivingControls
  /** Shops, their sales and the free-adding setting. */
  shops: ShopControls
  /** The story (chapters and scenes), the stage it puts things on, and the library to pick from. */
  story: StoryControls
  stage: Stage
  onStage: (patch: StagePatch) => void
  library: Asset[]
  /** Puts a ready-made portrait in the library under People (for an NPC). */
  onAddPortrait?: (preset: PresetPortrait) => Promise<Asset>
  /** The DM's people. */
  npcs: NpcControls
  /** Paste your notes: writes a read campaign into this one, resolving with what was added. */
  importCampaign: (plan: CampaignPlan, ctx: ImportContext) => Promise<string>
}

/**
 * Screen 07, the DM's Command screen: the notebook, the party at a glance with damage and healing,
 * asking for rolls (screens 08 and 09), rests, notes, the log and the DM's own dice, with everyone's
 * throws landing in the middle. Combat arrives in milestone 6.
 */
export function DmView({
  loadSessionNotes,
  campaign,
  me,
  members,
  characters,
  online,
  onUpdate,
  onLevelUp,
  saveError,
  log,
  diceStyle,
  onDiceStyleChange,
  thrower,
  asking,
  notebook,
  events,
  sceneName,
  audio,
  fight,
  maps = [],
  mapOnStage = null,
  startTab = 'story',
  giving,
  shops,
  story,
  stage,
  onStage,
  library,
  onAddPortrait,
  npcs,
  importCampaign,
}: DmViewProps) {
  const [pasting, setPasting] = useState(false)
  // The person to open on the NPCs tab (from a scene).
  const [npcFocus, setNpcFocus] = useState<string | null>(null)
  const [fightDialog, setFightDialog] = useState<'start' | 'monster' | null>(null)
  const [selectedCombatant, setSelectedCombatant] = useState<string | null>(null)
  const monsters = useSrd(loadMonsters)
  const spells = useSrd(loadSpells)
  const fighting = fight.fight
  const [resting, setResting] = useState(false)
  // The Give card, optionally for one character.
  const [giveTo, setGiveTo] = useState<{ only: string | null; ticked?: string[] } | null>(null)
  const [boxOpen, setBoxOpen] = useState<{ container: Container; richness: Richness } | null>(null)
  // A scene's planned fight, to fill in Start combat.
  const [fightPreset, setFightPreset] = useState<Fight | null>(null)
  // The shop editor: a shop to change, or null for a new one.
  const [shopEdit, setShopEdit] = useState<{ shop: Shop | null } | null>(null)
  const equipment = useSrd(loadEquipment)
  const magicItems = useSrd(loadMagicItems)
  const noteInput = useRef<HTMLInputElement>(null)
  const sessionTime = useSessionClock(campaign.id)
  // The Ask for a roll card, optionally for one character; and a request the DM has tucked away.
  const [askFor, setAskFor] = useState<{
    only: string | null
    key?: string
    preset?: { dc: number; dcShown: boolean; outcomeShown: boolean; who: string[] }
  } | null>(null)
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const [tab, setTab] = useState<DmTab>(startTab)
  // The Log tab shows every roll and note, or the notes alone, by session, to search.
  const [logView, setLogView] = useState<'all' | 'notes'>('all')
  // The Rules panel (S1e), the same one players have; ? opens and closes it.
  const [rulesOpen, setRulesOpen] = useState(false)
  useRulesKey(useCallback(() => setRulesOpen((o) => !o), []))
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const [sheetTab, setSheetTab] = useState<SheetTabName>('sheet')
  const [mode, setMode] = useState<RollMode>('normal')
  const [secret, setSecret] = useState(false)
  const { attach: attachTray, throwDice } = useDiceTray()
  const table = useTableRolls({ campaignId: campaign.id, userId: me.user_id, throwDice, thrower })
  // Rolls players made for the DM, outside a fight: the DM says what each was.
  const forDm = useRollsForDm(campaign.id, me.user_id, !thrower)
  const { aiming, aimMonster, aimCharacter } = useAiming(fight.attack, table.rollWith, [], monsters)
  const [placeProblem, setPlaceProblem] = useState<string | null>(null)

  // U takes back the last thing that happened in a fight, unless you're typing.
  const undo = fight.undo
  useEffect(() => {
    if (!fighting) return
    const press = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key.toLowerCase() !== 'u' || event.metaKey || event.ctrlKey || event.altKey) return
      if (target?.closest('input, textarea, select')) return
      undo()
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [fighting, undo])
  const open = characters.find((c) => c.id === sheetFor)
  const choices = { mode, secret }
  const { request } = asking
  const showResults = request && hiddenFor !== request.id && !askFor && !resting && !fightDialog
  const hereTonight = characters.filter((c) =>
    members.some((m) => m.user_id === c.ownerId && m.role === 'player' && m.here_tonight),
  )
  const chips = requestChips({ request, answers: asking.answers, members, characters, viewerId: me.user_id })

  /** Roll behind the screen: the DM throws a check for each of them, secretly, with their bonus. */
  async function rollBehindScreen(input: AskInput) {
    const { askable } = input
    for (const character of characters.filter((c) => input.characterIds.includes(c.id))) {
      const roll = answerRoll(character, {
        id: '',
        kind: askable.kind,
        ability: askable.ability,
        skill: askable.skill,
        label: `${askable.label} behind the screen (DC ${input.dc})`,
      })
      await table.roll({ ...roll, requestId: null, secret: true })
    }
  }

  async function rollFor(character: Character) {
    if (!request) return
    const thrown = await table.roll(answerRoll(character, request))
    if (thrown) asking.putAnswer(thrown)
  }

  async function rollDamage(dice: DiceGroup[]) {
    const thrown = await table.roll(freeRoll(dice, { secret: true }))
    return thrown ? (thrown.damage?.total ?? thrown.total) : null
  }

  /** The note showing someone adds to their card: where the party met them. */
  const currentScene = story.story.scenes.find((s) => s.id === notebook.notebook.currentSceneId)
  const meetNote = currentScene ? `Met the party at ${currentScene.title || 'a scene'}.` : 'Met the party.'

  /** Show an NPC: their portrait, name and role on stage for everyone, and a line in the log. */
  function showNpc(person: { id?: string; name: string; role: string; portraitId: string | null }) {
    onStage({ npcName: person.name, npcRole: person.role, npcImageId: person.portraitId })
    events.add('stage', `${person.name}${person.role ? `, ${person.role.toLowerCase()},` : ''} is here.`, true)
    // Shown from a scene, their card notes the meeting here (the NPCs tab notes it itself).
    const npc = person.id ? npcs.npcs.find((n) => n.id === person.id) : undefined
    if (npc && npc.history[0]?.text !== meetNote) {
      void npcs.save({
        ...npc,
        history: [
          { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), text: meetNote },
          ...npc.history,
        ],
      })
    }
  }

  /** Go here: the scene's picture, music, ambience and name on stage, Where we are, and the log. */
  function goHere(scene: Scene) {
    const patch: StagePatch = { sceneName: (scene.title || 'A scene').slice(0, 80), readAloud: '' }
    if (scene.imageId) {
      patch.imageId = scene.imageId
      if (!fighting) patch.mode = 'scene'
    }
    if (scene.musicId && (scene.musicId !== stage.musicId || !stage.musicPlaying)) {
      Object.assign(patch, {
        musicId: scene.musicId,
        musicPlaying: true,
        musicStartedAt: serverNow(),
        musicPosition: 0,
      })
    }
    if (Object.keys(scene.ambience).length > 0) patch.ambience = scene.ambience
    onStage(patch)
    notebook.change({ ...notebook.notebook, currentSceneId: scene.id })
    events.add(
      'stage',
      `The party is at ${scene.title || 'a new scene'}${scene.place ? ` (${scene.place})` : ''}.`,
      true,
    )
  }

  /** A key item was given: the notebook's Key items say who has it now. */
  function keyItemGiven(name: string, holder: string) {
    const keyItems = notebook.notebook.keyItems
    const known = keyItems.find((k) => k.name.trim().toLowerCase() === name.trim().toLowerCase())
    notebook.change({
      ...notebook.notebook,
      keyItems: known
        ? keyItems.map((k) => (k.id === known.id ? { ...k, holder } : k))
        : [...keyItems, { id: entryId(), name, holder }],
    })
  }

  function hitPoints(character: Character, change: HitPointChange, amount: number) {
    const before = { current: character.currentHp, max: character.maxHp, temp: character.tempHp }
    const after =
      change === 'damage'
        ? takeDamage(before, amount)
        : change === 'heal'
          ? heal(before, amount)
          : gainTempHp(before, amount)
    onUpdate(character.id, { currentHp: after.current, tempHp: after.temp })
    const what =
      change === 'temp'
        ? `${amount} temporary hit points`
        : `${amount} ${change === 'damage' ? 'damage' : 'hit points'}`
    events.add(
      change === 'damage' ? 'damage' : 'heal',
      `${character.name} ${HP_WORDS[change]} ${what} (${before.current} → ${after.current}${after.temp ? ` +${after.temp} temp` : ''}).`,
    )
  }

  function damage(ids: string[], amount: number) {
    characters.filter((c) => ids.includes(c.id)).forEach((character) => hitPoints(character, 'damage', amount))
  }

  function addCondition(ids: string[], condition: string) {
    const affected = characters.filter((c) => ids.includes(c.id) && !c.conditions.includes(condition))
    for (const character of affected) {
      onUpdate(character.id, { conditions: [...character.conditions, condition] })
    }
    if (affected.length > 0) {
      const name = (findCondition(condition)?.name ?? condition).toLowerCase()
      events.add(
        'condition',
        `${namesText(affected.map((c) => c.name))} ${affected.length === 1 ? 'is' : 'are'} now ${name}.`,
      )
    }
  }

  function rest(character: Character, patch: RestPatch & Partial<Pick<Character, 'conditions'>>) {
    onUpdate(character.id, patch)
  }

  function runVerb(verb: Verb) {
    if (verb === 'ask') setAskFor({ only: null })
    if (verb === 'rest') setResting(true)
    if (verb === 'give') setGiveTo({ only: null })
    if (verb === 'npc') setTab('npcs')
    if (verb === 'note') noteInput.current?.focus()
    if (verb === 'fight') setFightDialog('start')
    if (verb === 'monster') setFightDialog('monster')
    if (verb === 'next') fight.next()
    if (
      verb === 'end' &&
      fighting &&
      window.confirm('End the fight? Every miniature leaves the map, and the map stays up as a picture.')
    ) {
      events.add('note', `The fight ended in round ${fighting.encounter.round}.`)
      fight.end()
    }
  }

  // Everyone in the fight gets a miniature on the map (the party down one side, monsters across).
  async function place(mapId: string | null, characterIds: string[], combatantIds: string[]) {
    if (!mapId) return
    setPlaceProblem(null)
    try {
      await placeFighters(campaign.id, mapId, { characterIds, combatantIds })
    } catch (caught) {
      setPlaceProblem(messageFor(caught))
    }
  }

  async function startFight(party: Character[], foes: MonsterPick[], setting: FightSetting) {
    const started = await fight.start(party, setting.mapId)
    if (!started) return
    const monsterIds: string[] = []
    for (const foe of foes) {
      const added = await fight.addMonsters(foe.monster, foe.count, setting.known)
      monsterIds.push(...(added?.combatants.map((c) => c.id) ?? []))
    }
    await place(
      setting.mapId,
      party.map((c) => c.id),
      monsterIds,
    )
    events.add(
      'note',
      `A fight began: ${[...party.map((c) => c.name), ...foes.map((f) => `${f.count} × ${f.monster.name}`)].join(', ')}.`,
    )
    setFightDialog(null)
    setFightPreset(null)
    setTab('encounter')
  }

  function rollInitiativeFor(combatant: Combatant, row: FightRow) {
    if (row.character) void fight.rollInitiative(combatant, initiativeRoll(row.character))
    else {
      const monster = monsters?.find((m) => m.index === row.secret?.monster)
      void fight.rollInitiative(
        combatant,
        monster
          ? monsterInitiative(monster)
          : { ...freeRoll([{ sides: 20, count: 1 }]), kind: 'initiative', secret: true },
      )
    }
  }

  // Quick ±1 (or ±5) from the turn order: not logged, unlike Damage or heal on the party cards.
  function nudgeHp(character: Character, change: number) {
    const before = { current: character.currentHp, max: character.maxHp, temp: character.tempHp }
    const after = change < 0 ? takeDamage(before, -change) : heal(before, change)
    onUpdate(character.id, { currentHp: after.current, tempHp: after.temp })
  }

  function roll(request: RollRequest) {
    if (isSingleD20(request.dice)) setMode('normal')
    void table.roll(request)
  }

  // The DM can roll for any character from their sheet, say for a player who stepped away.
  const rollsFor = (character: Character): SheetRolls => ({
    ability: (ability) => roll(abilityCheck(character, ability, choices)),
    save: (ability) => roll(savingThrow(character, ability, choices)),
    skill: (index) => roll(skillCheck(character, index, choices)),
    initiative: () => roll(initiativeRoll(character, choices)),
    attack: (attack) => roll(attackRoll(character, attack, choices)),
    deathSave: () => void rollDeathSaveFor(character),
    disabled: table.rolling,
  })

  // In a fight the server rolls it and keeps count; outside one, the pips are ticked here.
  async function rollDeathSaveFor(character: Character) {
    const combatant = fighting?.combatants.find((c) => c.characterId === character.id)
    if (combatant) {
      void table.rollWith(() => fight.deathSave(combatant))
      return
    }
    const thrown = await table.roll({
      ...freeRoll([{ sides: 20, count: 1 }], { characterId: character.id }),
      kind: 'save',
      label: 'Death saving throw',
    })
    if (thrown) onUpdate(character.id, deathSavePatch(character, thrown.natural ?? thrown.total))
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.campaign}>{campaign.name}</h1>
        <span className={styles.headerNote}>
          Scene now: <strong className={styles.scene}>{sceneName || 'not named yet'}</strong>
        </span>
        <span className={styles.spacer} />
        {fighting && (
          <button type="button" className={styles.combatBadge} onClick={() => setTab('encounter')}>
            In combat · Round {fighting.encounter.round}
          </button>
        )}
        {audio && <NowPlaying audio={audio} />}
        <a className={styles.headerLink} href={href(`/c/${campaign.id}`)}>
          Join screen
        </a>
        <span className={styles.headerNote}>Session time {sessionTime}</span>
        <a className={styles.stage} href={href(`/c/${campaign.id}/stage`)}>
          Screen 2: Stage
        </a>
      </header>

      <aside className={styles.left}>
        <NotebookPanel
          className={styles.notebook}
          notebook={notebook}
          onNote={(text) => events.add('note', text)}
          noteInput={noteInput}
        />
        {saveError && <Notice tone="error">{saveError}</Notice>}
        {table.error && <Notice tone="error">{table.error}</Notice>}
        {placeProblem && <Notice tone="error">{placeProblem}</Notice>}
        {events.error && <Notice tone="error">{events.error}</Notice>}
        {fight.error && <Notice tone="error">{fight.error}</Notice>}
      </aside>

      <DiceControls
        className={styles.dice}
        isDm
        style={diceStyle}
        onStyleChange={onDiceStyleChange}
        mode={mode}
        onModeChange={setMode}
        secret={secret}
        onSecretChange={setSecret}
        onRoll={(dice) => roll(freeRoll(dice, choices))}
        onPractise={() =>
          table.showLocal(localRoll(PRACTICE_SET, { campaignId: campaign.id, rollerId: me.user_id, style: diceStyle }))
        }
        rolling={table.rolling}
      />

      <section className={styles.centre}>
        {request && !showResults && !askFor && (
          <button type="button" className={styles.waiting} onClick={() => setHiddenFor(null)}>
            {request.label}: {asking.answers.length} of {request.characterIds.length} rolled
            {allAnswered(request, asking.answers) ? ', all in' : ''} · <strong>Show results</strong>
          </button>
        )}
        <div className={styles.tabRow}>
          <div role="tablist" aria-label="DM panels" className={styles.tabs}>
            {TABS.map(({ label, tab: target, title }) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={target === tab}
                disabled={!target}
                title={title}
                className={cx(styles.tab, target === tab && styles.tabOn)}
                onClick={() => target && setTab(target)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={cx(styles.tab, styles.rulesButton, rulesOpen && styles.tabOn)}
            aria-pressed={rulesOpen}
            title="The rules in plain words (?)"
            onClick={() => setRulesOpen((o) => !o)}
          >
            <Icon name="rules" size={16} /> Rules
          </button>
        </div>
        <div className={styles.content} role="tabpanel">
          {tab === 'story' ? (
            <StoryTab
              story={story}
              currentSceneId={notebook.notebook.currentSceneId}
              onGoHere={goHere}
              readAloudOnStage={stage.readAloud}
              onShowReadAloud={(readAloud) => onStage({ readAloud })}
              library={library}
              onPaste={() => setPasting(true)}
              data={{
                characters,
                dmItems: giving.yours,
                npcs: npcs.npcs,
                shownNpc: stage.npcName,
                shops: shops.shops,
                monsters,
                maps: library.filter((a) => a.kind === 'art' && a.category === 'maps'),
              }}
              actions={{
                onAsk: (roll) =>
                  setAskFor({
                    only: null,
                    key: roll.key,
                    preset: { dc: roll.dc, dcShown: roll.dcShown, outcomeShown: roll.outcomeShown, who: roll.who },
                  }),
                onGiveItem: (id) => setGiveTo({ only: null, ticked: [`yours:${id}`] }),
                onOpenBox: (container, richness) => setBoxOpen({ container, richness }),
                onOpenShop: (id) => void shops.setOpen(id, true),
                onShowNpc: (npc) => showNpc({ ...npc, id: (npc as { id?: string }).id }),
                onOpenNpc: (id) => {
                  setNpcFocus(id)
                  setTab('npcs')
                },
                onStartFight: (planned) => {
                  setFightPreset(planned)
                  setFightDialog('start')
                },
              }}
            />
          ) : tab === 'npcs' ? (
            <NpcsTab
              key={npcFocus ?? 'all'}
              npcs={npcs}
              library={library}
              shops={shops.shops}
              shownName={stage.npcName}
              onShow={showNpc}
              onHide={() => onStage({ npcName: '', npcRole: '', npcImageId: null })}
              onOpenShop={(id) => void shops.setOpen(id, true)}
              startId={npcFocus}
              meetNote={meetNote}
              onAddPortrait={onAddPortrait}
            />
          ) : tab === 'encounter' ? (
            fighting ? (
              <EncounterTab
                campaignId={campaign.id}
                fight={fighting}
                controls={fight}
                characters={characters}
                monsters={monsters}
                selectedId={selectedCombatant}
                onSelect={setSelectedCombatant}
                onCharacterHp={nudgeHp}
                onAttack={aimMonster}
                onCharacterAttack={aimCharacter}
                onRoll={roll}
                aiming={aiming}
                onRollInitiative={rollInitiativeFor}
                onOpenSheet={(character) => {
                  setSheetTab('sheet')
                  setSheetFor(character.id)
                }}
                rolling={table.rolling}
              />
            ) : (
              <p className={styles.empty}>
                No fight going on. Press <strong>Start combat</strong> below to choose who fights and which monsters.
              </p>
            )
          ) : tab === 'items' ? (
            <ItemsTab
              characters={characters}
              giving={giving}
              onGive={(character) => setGiveTo({ only: character?.id ?? null })}
              onOpenBox={() => setBoxOpen({ container: 'chest', richness: 'ordinary' })}
              shops={shops}
              onShop={(shop) => setShopEdit({ shop })}
              equipment={equipment}
              magicItems={magicItems}
            />
          ) : tab === 'party' ? (
            <PartyCards
              onGive={(character) => setGiveTo({ only: character.id })}
              onLevelUp={onLevelUp}
              onDeathSave={(character) => void rollDeathSaveFor(character)}
              onUpdate={onUpdate}
              rolling={table.rolling}
              onQuickCheck={asking.ask}
              quickError={asking.error}
              spells={spells}
              combatants={fighting?.combatants ?? []}
              campaignId={campaign.id}
              members={members}
              characters={characters}
              onAsk={(character) => setAskFor({ only: character.id })}
              onHitPoints={hitPoints}
              onOpenSheet={(character) => {
                setSheetTab('sheet')
                setSheetFor(character.id)
              }}
            />
          ) : (
            <>
              <div className={styles.logSwitch} role="group" aria-label="What to show">
                <button
                  type="button"
                  className={cx(styles.logOption, logView === 'all' && styles.logOptionOn)}
                  aria-pressed={logView === 'all'}
                  onClick={() => setLogView('all')}
                >
                  Rolls and notes
                </button>
                <button
                  type="button"
                  className={cx(styles.logOption, logView === 'notes' && styles.logOptionOn)}
                  aria-pressed={logView === 'notes'}
                  onClick={() => setLogView('notes')}
                >
                  Session notes
                </button>
              </div>
              {logView === 'notes' ? (
                <SessionNotes load={loadSessionNotes} recent={events.events} />
              ) : (
                <RollLog
                  rolls={log.rolls}
                  events={events.events}
                  members={members}
                  characters={characters}
                  loading={log.status === 'loading'}
                  error={log.status === 'error' ? log.message : undefined}
                />
              )}
            </>
          )}
        </div>
        <nav className={styles.verbs} aria-label="DM actions">
          {(fighting ? COMBAT_VERBS : VERBS).map((verb) => (
            <button
              key={verb.label}
              type="button"
              className={cx(styles.verb, verb.primary && styles.verbPrimary)}
              disabled={!verb.verb}
              title={verb.title}
              onClick={() => verb.verb && runVerb(verb.verb)}
            >
              <Icon name={verb.icon} />
              {verb.label}
            </button>
          ))}
        </nav>

        {open && (
          <SheetPanel
            className={styles.sheet}
            character={open}
            canEdit
            editHref={href(`/c/${campaign.id}/character/${open.id}/edit`)}
            tab={sheetTab}
            onTab={setSheetTab}
            onClose={() => setSheetFor(null)}
            closeLabel="Back to the party"
            onUpdate={(patch) => onUpdate(open.id, patch)}
            rolls={rollsFor(open)}
          />
        )}
        <div ref={attachTray} className={styles.tray} aria-hidden="true" />
        <RollToasts
          className={styles.toasts}
          rolls={table.shown}
          members={members}
          characters={characters}
          onDismiss={table.dismiss}
        />
        <div className={styles.forDm}>
          <HaggleCards
            // Out of the way while a window (Give, a box, a roll) is open over the middle.
            className={styles.haggles}
            haggles={
              askFor || showResults || resting || fightDialog || giveTo || boxOpen || shopEdit || pasting
                ? []
                : shops.haggles
            }
            shops={shops}
            characters={characters}
            onPersuade={(id) => setAskFor({ only: id, key: 'skill:persuasion' })}
            equipment={equipment}
            magicItems={magicItems}
          />
          <RollsForDm rolls={forDm.rolls} characters={characters} onSettle={forDm.settle} />
        </div>
      </section>

      {(askFor || showResults || resting || fightDialog || giveTo || boxOpen || shopEdit || pasting) && (
        <Backdrop
          className={styles.overlay}
          onClose={() => {
            if (fightDialog) setFightDialog(null)
            else if (giveTo) setGiveTo(null)
            else if (boxOpen) setBoxOpen(null)
            else if (shopEdit) setShopEdit(null)
            else if (pasting) setPasting(false)
            else if (resting) setResting(false)
            else if (askFor) setAskFor(null)
            else if (request) setHiddenFor(request.id)
          }}
        >
          {fightDialog === 'start' ? (
            <StartFightDialog
              characters={characters}
              hereTonight={hereTonight}
              monsters={monsters}
              maps={maps}
              mapOnStage={mapOnStage}
              preset={
                fightPreset
                  ? {
                      foes: fightPreset.monsters.flatMap((m) => {
                        const monster = monsters?.find((x) => x.index === m.index)
                        return monster ? [{ monster, count: m.count }] : []
                      }),
                      mapId: fightPreset.mapId,
                    }
                  : null
              }
              onStart={startFight}
              onClose={() => {
                setFightDialog(null)
                setFightPreset(null)
              }}
            />
          ) : fightDialog === 'monster' ? (
            <AddMonsterDialog
              monsters={monsters}
              onAdd={async (pick) => {
                const added = await fight.addMonsters(pick.monster, pick.count, true)
                await place(mapOnStage, [], added?.combatants.map((c) => c.id) ?? [])
              }}
              onClose={() => setFightDialog(null)}
            />
          ) : giveTo ? (
            equipment && magicItems ? (
              <GiveDialog
                characters={characters}
                only={giveTo.only}
                ticked={giveTo.ticked ?? []}
                equipment={equipment}
                magicItems={magicItems}
                giving={giving}
                onKeyItem={keyItemGiven}
                onClose={() => setGiveTo(null)}
              />
            ) : null
          ) : pasting ? (
            <PasteDialog
              monsters={monsters ?? []}
              assetNames={library.map((a) => a.name)}
              shopNames={shops.shops.map((s) => s.name)}
              partyLevels={characters.map((c) => c.level)}
              onImport={(plan) =>
                importCampaign(plan, {
                  monsters: monsters ?? [],
                  library,
                  shops: shops.shops,
                  characters,
                  npcs: npcs.npcs,
                  items: giving.yours,
                  story: story.story,
                })
              }
              onClose={() => setPasting(false)}
            />
          ) : shopEdit ? (
            equipment && magicItems ? (
              <ShopDialog
                shop={shopEdit.shop}
                equipment={equipment}
                magicItems={magicItems}
                giving={giving}
                shops={shops}
                onClose={() => setShopEdit(null)}
              />
            ) : null
          ) : boxOpen ? (
            equipment && magicItems ? (
              <BoxDialog
                characters={characters}
                equipment={equipment}
                magicItems={magicItems}
                giving={giving}
                settings={notebook.notebook.boxSettings}
                onSettings={(boxSettings) => notebook.change({ ...notebook.notebook, boxSettings })}
                onKeyItem={keyItemGiven}
                start={boxOpen}
                onClose={() => setBoxOpen(null)}
              />
            ) : null
          ) : resting ? (
            <RestDialog
              characters={characters}
              hereTonight={hereTonight}
              onRest={rest}
              onLog={(text) => events.add('rest', text, true)}
              onClose={() => setResting(false)}
            />
          ) : askFor ? (
            <AskRollDialog
              characters={characters}
              hereTonight={hereTonight}
              only={askFor.only}
              startKey={askFor.key ?? null}
              preset={askFor.preset ?? null}
              onBehindScreen={(input) => void rollBehindScreen(input)}
              onSend={asking.ask}
              onCancel={() => setAskFor(null)}
              error={asking.error}
            />
          ) : (
            request && (
              <RequestResults
                key={request.id}
                request={request}
                answers={asking.answers}
                dc={asking.dc}
                characters={characters}
                onOverride={asking.override}
                onAccept={asking.accept}
                onRollFor={(character) => void rollFor(character)}
                onDamage={damage}
                onCondition={addCondition}
                onRollDamage={rollDamage}
                onDone={asking.close}
                onHide={() => setHiddenFor(request.id)}
                rolling={table.rolling}
                error={asking.error ?? table.error}
              />
            )
          )}
        </Backdrop>
      )}

      <CameraColumn
        className={styles.cameras}
        members={members}
        characters={characters}
        online={online}
        myId={me.user_id}
        chips={chips}
        turn={fighting ? cameraTurn(fightRows(fighting, characters, 'dm'), me.user_id) : null}
      />

      {rulesOpen && (
        <Suspense fallback={null}>
          <RulesPanel className={styles.rules} onClose={() => setRulesOpen(false)} />
        </Suspense>
      )}
    </main>
  )
}
