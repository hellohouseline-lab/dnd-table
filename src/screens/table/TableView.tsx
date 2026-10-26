import { lazy, Suspense, useCallback, useState } from 'react'
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
import type { Roll } from '../../live/rolls.ts'
import type { RequestControls } from '../../live/useRollRequest.ts'
import type { Asset } from '../../live/library.ts'
import { NowPlaying } from '../../audio/SoundControls.tsx'
import type { TableAudio } from '../../audio/useTableAudio.ts'
import { StoredImage } from '../../components/StoredImage.tsx'
import { hitDieHealing } from '../../rules/rest.ts'
import { abilityModifier } from '../../rules/maths/core.ts'
import { ABILITIES, ABILITY_NAME, ABILITY_SHORT } from '../../rules/abilities.ts'
import type { Character, FeatureEntry } from '../../rules/character.ts'
import { isSingleD20, type RollMode, type RollRequest } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import {
  abilityCheck,
  answerRoll,
  attackRoll,
  freeRoll,
  initiativeRoll,
  savingThrow,
  skillCheck,
} from '../../rules/rolls.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { findCondition } from '../../rules/srd/index.ts'
import { SheetPanel, type SheetTabName } from '../sheet/SheetPanel.tsx'
import type { SheetRolls } from '../sheet/SheetTab.tsx'
import { requestChips, type CameraChip } from '../rolls/requestStatus.ts'
import { RollPrompt, RollResult } from '../rolls/RollPrompt.tsx'
import type { FightControls, Pointer, TokenControls } from '../../live/useFight.ts'
import { feetBetween } from '../../rules/combat.ts'
import { mapTokens } from '../../map/mapTokens.ts'
import { fightRows } from '../fight/fightRows.ts'
import { InitiativePrompt, InitiativeRibbon, InspectCard, ThisTurn, TurnBanner } from '../fight/PlayerCombat.tsx'
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
  /** The table's sound in this tab (left out in the previews). */
  audio?: TableAudio
  /** Fights and the battle map (left out in the tests). */
  combat?: PlayerCombatProps
}

const BattleMap = lazy(() => import('../../map/BattleMap.tsx'))

/** A fight and the battle map, as a player sees them. */
export type PlayerCombatProps = {
  fight: FightControls['fight']
  rollInitiative: FightControls['rollInitiative']
  endTurn: () => void
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
  { label: 'Items', icon: 'items', title: 'Inventory arrives in Phase 2' },
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
  audio,
  combat,
}: TableViewProps) {
  const [inspected, setInspected] = useState<string | null>(null)
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

  // How far you've moved this turn: from where your token stood when your turn began.
  const tokens = combat?.tokens.tokens ?? []
  const myToken = tokens.find((t) => t.characterId === character.id)
  const turnKey = myTurn && fight ? `${fight.encounter.id}:${fight.encounter.round}` : null
  const [turnStart, setTurnStart] = useState<{ key: string; x: number; y: number } | null>(null)
  if (turnKey && myToken && turnStart?.key !== turnKey) setTurnStart({ key: turnKey, x: myToken.x, y: myToken.y })
  const moved = turnStart && turnStart.key === turnKey && myToken ? feetBetween(turnStart, myToken) : 0
  const feetLeft = Math.max(0, character.speed - moved)
  const mapView = combat
    ? mapTokens(
        tokens,
        { characters, combatants: fight?.combatants ?? [], secrets: [], currentId: fight?.encounter.currentId ?? null },
        { userId: me.user_id, isDm: false, playersMove: combat.playersMove },
      )
    : []
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
    attack: (attack) => roll(attackRoll(character, attack, choices)),
    hitDie: () => void spendHitDie(),
    disabled: table.rolling,
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

  function spendFeature(feature: FeatureEntry) {
    update({
      features: character.features.map((f) =>
        f.id === feature.id ? { ...f, usesLeft: Math.max(0, f.usesLeft - 1) } : f,
      ),
    })
  }

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
              onSelect={setInspected}
              onMove={(id, x, y) => {
                const token = tokens.find((t) => t.id === id)
                if (token) combat.tokens.move(token, x, y)
              }}
              reach={myTurn && myToken ? { tokenId: myToken.id, feet: feetLeft } : null}
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
          <div className={styles.sceneTitle}>The DM&rsquo;s scene appears here</div>
          <div className={styles.sceneNote}>
            When the DM puts a picture on stage, it fills this space. Dice land here.
          </div>
        </div>
      )}
      <div className={styles.topChips}>
        {fight && (
          <TurnBanner round={fight.encounter.round} mine={myTurn} acting={acting && !myTurn ? acting.name : null} />
        )}
        {fight && <InitiativeRibbon rows={rows} />}
        {audio && <NowPlaying audio={audio} />}
      </div>
      {inspectedRow && (
        <div className={styles.inspect}>
          <InspectCard row={inspectedRow} onClose={() => setInspected(null)} />
        </div>
      )}

      <Hand
        className={styles.hand}
        character={character}
        onAttack={rolls.attack}
        onUseFeature={spendFeature}
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

        {fight && mine && (
          <ThisTurn
            key={turnKey ?? 'waiting'}
            speed={character.speed}
            feetLeft={feetLeft}
            myTurn={myTurn}
            onEndTurn={() => combat?.endTurn()}
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
      </div>

      <CameraColumn
        members={members}
        characters={characters}
        online={online}
        myId={me.user_id}
        chips={chips}
        badges={badges}
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
          />
        </>
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
          <RollResult roll={myAnswer} shownDc={request.shownDc} onClose={() => setClosedResult(myAnswer.id)} />
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
  className?: string
}

/** The camera column from the designs. Until cameras arrive (milestone 7) each tile shows who's here. */
export function CameraColumn({
  members,
  characters,
  online,
  myId,
  chips = {},
  badges = {},
  className,
}: CameraColumnProps) {
  const ordered = [...members.filter((m) => m.role === 'dm'), ...members.filter((m) => m.role === 'player')]
  return (
    <div className={cx(styles.cameras, className)} aria-label="The table">
      {ordered.map((member) => {
        const character = characters.find((c) => c.ownerId === member.user_id)
        const here = online.has(member.user_id)
        const you = member.user_id === myId
        return (
          <div key={member.user_id} className={cx(styles.tile, you && styles.you)}>
            {badges[member.user_id] && <span className={styles.badge}>{badges[member.user_id]}</span>}
            {chips[member.user_id] && (
              <span className={cx(styles.chip, styles[`chip_${chips[member.user_id].tone}`])}>
                {chips[member.user_id].label}
              </span>
            )}
            <div className={cx(styles.feed, here && styles.feedHere)}>
              <Icon name="camera" size={14} />
              <span>{here ? 'Here' : 'Not here yet'}</span>
            </div>
            <div className={styles.namePlate}>
              <div className={styles.plateText}>
                <div className={styles.plateName}>
                  {member.role === 'dm' ? member.display_name : (character?.name ?? member.display_name)}
                </div>
                <div className={styles.plateWho}>
                  {member.role === 'dm' ? 'Dungeon Master' : member.display_name}
                  {you && ' · you'}
                </div>
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
