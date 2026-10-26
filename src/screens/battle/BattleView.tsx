import { useEffect, useState } from 'react'
import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { Notice } from '../../components/Notice.tsx'
import { Backdrop } from '../../components/Backdrop.tsx'
import { StoredImage } from '../../components/StoredImage.tsx'
import { RollToasts } from '../../dice/RollToasts.tsx'
import { useDiceTray } from '../../dice/useDiceTray.ts'
import { useTableRolls } from '../../dice/useTableRolls.ts'
import type { Member } from '../../live/campaigns.ts'
import { placeFighters, type Combatant, type Token } from '../../live/combat.ts'
import { messageFor } from '../../live/errors.ts'
import { STARTER_MAPS, starterMapUrl, type Asset, type AssetPatch, type StarterMap } from '../../live/library.ts'
import type { Roll } from '../../live/rolls.ts'
import type { StageControls } from '../../live/useStage.ts'
import type { FightControls, Pointer, TokenControls } from '../../live/useFight.ts'
import { useSrd } from '../../live/useSrd.ts'
import type { Character } from '../../rules/character.ts'
import { isAttack, monsterInitiative, startingSquares } from '../../rules/combat.ts'
import type { RollRequest } from '../../rules/dice.ts'
import { answerRoll, freeRoll, initiativeRoll } from '../../rules/rolls.ts'
import type { DiceGroup } from '../../rules/dice.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { RequestControls } from '../../live/useRollRequest.ts'
import { AskRollDialog } from '../rolls/AskRollDialog.tsx'
import { RequestResults } from '../rolls/RequestResults.tsx'
import { loadMonsters, loadSpells } from '../../rules/srd/index.ts'
import { ActingNow, TurnOrder } from '../fight/EncounterTab.tsx'
import { AddMonsterDialog } from '../fight/FightDialogs.tsx'
import { cameraTurn, fightRows, type FightRow } from '../fight/fightRows.ts'
import { CombatFeed } from '../fight/TurnParts.tsx'
import { useAiming, type Aiming } from '../fight/useAiming.ts'
import { useCasting } from '../fight/useCasting.ts'
import { AreaDialog, type AreaDraft } from '../fight/AreaDialog.tsx'
import { SlotPicker } from '../fight/SlotPicker.tsx'
import type { AreaControls } from '../../live/areas.ts'
import { ChanceStrip, type OpenChance } from '../fight/Reactions.tsx'
import { strikesFor, type Strike } from '../fight/strikes.ts'
import { MapStage } from '../stage/MapStage.tsx'
import { CameraColumn } from '../table/TableView.tsx'
import styles from './BattleView.module.css'

type Fight = NonNullable<FightControls['fight']>

type BattleViewProps = {
  campaignId: string
  campaignName: string
  me: Member
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  fight: Fight
  controls: FightControls
  tokens: TokenControls
  stage: StageControls
  /** Battle maps in the library, to put one up when there's none on stage. */
  maps: Asset[]
  pointers: {
    hands: Pointer[]
    pings: (Pointer & { id: number })[]
    sendHand: (x: number, y: number) => void
    sendPing: (x: number, y: number) => void
  }
  /** Changes a character's hit points by an amount (negative for damage). */
  onCharacterHp: (character: Character, change: number) => void
  /** Changes a character's sheet (conditions from a roll's outcome). */
  onUpdate: (characterId: string, patch: TrackerPatch) => void
  /** The DM's request for a roll and its answers: Ask for a roll works here too, mid-fight. */
  asking: RequestControls
  /** Areas on the map on stage: spells' lasting shapes and the DM's own. */
  areas: AreaControls
  onGrid: (map: Asset, patch: AssetPatch) => void
  /** Adds one of the maps that come with the table to the library (there's no map yet). */
  onAddStarter?: (starter: StarterMap) => Promise<Asset>
  /** Back to the stage (pictures, music, the library) without ending the fight. */
  onShowStage: () => void
  /** Throws in the browser instead of on the server (the design preview, which has no database). */
  thrower?: (request: RollRequest) => Promise<Roll>
}

/**
 * Screen 2 in a fight (docs/COMBAT_PLAN.md section 3): the whole fight on one screen. The turn order
 * and the acting creature on the left, the big map in the middle with what just happened under it,
 * and everyone's cameras on the right. A monster's turn is two clicks: its attack, then its target.
 * Keys: 1 to 9 an attack, N next turn, U undo, R reveal the name, Escape to put an attack away.
 */
export function BattleView({
  campaignId,
  campaignName,
  me,
  members,
  characters,
  online,
  fight,
  controls,
  tokens,
  stage,
  maps,
  pointers,
  onCharacterHp,
  onUpdate,
  asking,
  areas,
  onGrid,
  onAddStarter,
  onShowStage,
  thrower,
}: BattleViewProps) {
  const monsters = useSrd(loadMonsters)
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // Add an area: the DM's shape, first described, then put on the map.
  const [drawing, setDrawing] = useState<{ draft: AreaDraft | null } | null>(null)
  const spells = useSrd(loadSpells)
  const [askFor, setAskFor] = useState<{ only: string | null } | null>(null)
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const { request } = asking
  const showResults = request !== null && hiddenFor !== request.id && !askFor && !adding
  const hereTonight = characters.filter((c) =>
    members.some((m) => m.user_id === c.ownerId && m.role === 'player' && m.here_tonight),
  )
  const [problem, setProblem] = useState<string | null>(null)
  const { attach: attachTray, throwDice } = useDiceTray()
  const table = useTableRolls({ campaignId, userId: me.user_id, throwDice, thrower })
  const {
    aiming: attacking,
    aimMonster,
    aimCharacter,
    cancel: cancelAttack,
  } = useAiming(controls.attack, table.rollWith, tokens.tokens, monsters)

  const rows = fightRows(fight, characters, 'dm')
  const {
    casting,
    begin: beginCast,
    cancel: cancelCast,
    problem: castProblem,
  } = useCasting(controls.cast, table.rollWith, tokens.tokens, rows)
  // Whatever is waiting for its target: an attack, or a spell aimed at a creature.
  const aiming: Aiming =
    attacking ??
    (casting && casting.mode === 'target'
      ? {
          label: casting.label,
          attackerId: casting.casterId,
          reach: { melee: casting.rangeFt ?? 5280, normal: null, long: null },
          onPick: casting.onPick,
        }
      : null)
  const cancel = () => {
    cancelAttack()
    cancelCast()
    setDrawing(null)
  }
  // Characters who took damage while concentrating, and owe the save.
  const owing = characters.filter(
    (c) => c.concentration && c.concentrationDc !== null && fight.combatants.some((x) => x.characterId === c.id),
  )
  const acting = rows.find((r) => r.status === 'acting') ?? null
  const focus = rows.find((r) => r.combatant.id === (selected ?? fight.encounter.currentId)) ?? null
  const nameOf = (id: string | null) => rows.find((r) => r.combatant.id === id)?.name ?? 'Someone'
  const map = stage.stage.mode === 'map' ? (maps.find((m) => m.id === stage.stage.mapId) ?? null) : null

  // Opportunity attacks: someone moved out of reach without Disengaging. A monster's chance is the
  // DM's to take; a character's their player decides, though the DM can take it for them.
  const chances: OpenChance[] = controls.prompts.flatMap((prompt) => {
    const reactor = rows.find((r) => r.combatant.id === prompt.combatantId)
    const provoker = rows.find((r) => r.combatant.id === prompt.provokerId)
    if (!reactor || !provoker) return []
    const owner = reactor.character ? members.find((m) => m.user_id === reactor.character?.ownerId) : undefined
    return [
      {
        id: prompt.id,
        reactor: reactor.name,
        provoker: provoker.name,
        player: owner && owner.user_id !== me.user_id ? owner.display_name : null,
        strikes: strikesFor(reactor, monsters),
      },
    ]
  })

  function strikeFor(promptId: string, strike: Strike) {
    const prompt = controls.prompts.find((p) => p.id === promptId)
    const provoker = rows.find((r) => r.combatant.id === prompt?.provokerId)
    if (!prompt || !provoker) return
    const request = strike.build(provoker)
    void table.rollWith(() => controls.strike(prompt, request))
  }

  function rowOfToken(token: Token): FightRow | undefined {
    return rows.find((r) =>
      token.characterId ? r.combatant.characterId === token.characterId : r.combatant.id === token.combatantId,
    )
  }

  // The acting creature's attacks, in the order the number keys fire them.
  function attackByNumber(row: FightRow | null, n: number) {
    if (!row) return
    if (row.character) {
      const weapon = row.character.attacks[n]
      if (weapon) aimCharacter(row, weapon)
      return
    }
    const monster = monsters?.find((m) => m.index === row.secret?.monster)
    const action = monster?.actions.filter(isAttack)[n]
    if (action) aimMonster(row, action)
  }

  const { next, undo, reveal } = controls
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select')) return
      const key = event.key.toLowerCase()
      if (key === 'n') next()
      else if (key === 'u') undo()
      else if (key === 'r' && acting?.unrevealed) reveal(acting.combatant)
      else if (key === 'a') setAskFor({ only: null })
      else if (/^[1-9]$/.test(key)) attackByNumber(focus, Number(key) - 1)
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  })

  // The results of a roll the DM asked for: roll for someone who's away, then what happens.
  async function rollFor(character: Character) {
    if (!request) return
    const thrown = await table.roll(answerRoll(character, request))
    if (thrown) asking.putAnswer(thrown)
  }

  async function rollDamage(dice: DiceGroup[]) {
    const thrown = await table.roll(freeRoll(dice, { secret: true }))
    return thrown ? (thrown.damage?.total ?? thrown.total) : null
  }

  function damage(ids: string[], amount: number) {
    characters.filter((c) => ids.includes(c.id)).forEach((character) => onCharacterHp(character, -amount))
  }

  function addCondition(ids: string[], condition: string) {
    for (const character of characters.filter((c) => ids.includes(c.id) && !c.conditions.includes(condition))) {
      onUpdate(character.id, { conditions: [...character.conditions, condition] })
    }
  }

  function rollInitiativeFor(combatant: Combatant, row: FightRow) {
    if (row.character) void controls.rollInitiative(combatant, initiativeRoll(row.character))
    else {
      const monster = monsters?.find((m) => m.index === row.secret?.monster)
      void controls.rollInitiative(
        combatant,
        monster
          ? monsterInitiative(monster)
          : { ...freeRoll([{ sides: 20, count: 1 }]), kind: 'initiative', secret: true },
      )
    }
  }

  // New monsters on the map that's up: a few squares from the party, clear of everyone else.
  async function placeMonsters(combatantIds: string[]) {
    const onMap = tokens.tokens
    const squares = startingSquares(onMap, combatantIds.length, 7)
    await tokens.place(combatantIds.map((combatantId, i) => ({ combatantId, ...squares[i] })))
  }

  // A map goes up mid-fight: everyone in the fight gets a miniature on it.
  async function putUp(mapId: string) {
    setProblem(null)
    stage.change({ mapId, mode: 'map' })
    try {
      await placeFighters(campaignId, mapId, {
        characterIds: fight.combatants.flatMap((c) => (c.characterId ? [c.characterId] : [])),
        combatantIds: fight.combatants.filter((c) => c.kind === 'monster' && c.health !== 'down').map((c) => c.id),
      })
    } catch (caught) {
      setProblem(messageFor(caught))
    }
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{campaignName}</h1>
        <span className={styles.battle}>
          Battle · Round {fight.encounter.round}
          {acting ? ` · ${acting.name} is acting` : fight.encounter.currentId ? '' : ' · waiting for initiative'}
        </span>
        <span className={styles.spacer} />
        {request && !showResults && (
          <button type="button" className={styles.waiting} onClick={() => setHiddenFor(null)}>
            {request.label}: {asking.answers.length} of {request.characterIds.length} rolled · Show results
          </button>
        )}
        <button type="button" className={styles.headerButton} onClick={() => setAskFor({ only: null })} title="A">
          Ask for a roll
        </button>
        <button type="button" className={styles.headerButton} onClick={onShowStage}>
          Show the stage
        </button>
        <a className={styles.headerButton} href={href(`/c/${campaignId}/dm`)}>
          Screen 1: Story
        </a>
      </header>

      <div className={styles.body}>
        <div className={styles.left}>
          <TurnOrder
            monsters={monsters}
            className={styles.order}
            fight={fight}
            rows={rows}
            controls={controls}
            focusId={focus?.combatant.id ?? null}
            onSelect={setSelected}
            onCharacterHp={onCharacterHp}
            onRollInitiative={rollInitiativeFor}
            aiming={aiming}
            rolling={table.rolling}
            compact
          />
          <ActingNow
            campaignId={campaignId}
            className={styles.acting}
            row={focus}
            controls={controls}
            monsters={monsters}
            onAttack={aimMonster}
            onCharacterAttack={aimCharacter}
            onDeathSave={(row) => void table.rollWith(() => controls.deathSave(row.combatant))}
            onUpdate={onUpdate}
            spells={spells}
            onCast={(row, spell) => beginCast(row, spell)}
            onConcentrationSave={(character) => void table.rollWith(() => controls.concentrationSave(character.id))}
            numbered
            rolling={table.rolling}
          />
          <div className={styles.foot}>
            <button type="button" className={styles.next} onClick={next} title="N">
              Next turn
            </button>
            <button type="button" className={styles.footButton} onClick={() => setAdding(true)}>
              Add a monster
            </button>
            {map && (
              <button type="button" className={styles.footButton} onClick={() => setDrawing({ draft: null })}>
                Add an area
              </button>
            )}
            <button
              type="button"
              className={styles.footButton}
              onClick={() => {
                if (window.confirm('End the fight? Every miniature leaves the map, and the map stays up as a picture.'))
                  controls.end()
              }}
            >
              End fight
            </button>
          </div>
        </div>

        <div className={styles.centre}>
          <ChanceStrip
            chances={chances}
            onStrike={strikeFor}
            onLetGo={(id) => {
              const prompt = controls.prompts.find((p) => p.id === id)
              if (prompt) controls.letGo(prompt)
            }}
            rolling={table.rolling}
          />
          {owing.map((character) => (
            <div key={character.id} className={styles.owing} role="status">
              <span>
                <strong>{character.name}</strong> took damage while concentrating on {character.concentration}:
                Constitution save, DC {character.concentrationDc}
              </span>
              <button
                type="button"
                className={styles.aimingCancel}
                disabled={table.rolling}
                onClick={() => void table.rollWith(() => controls.concentrationSave(character.id))}
              >
                Roll for them
              </button>
            </div>
          ))}
          {aiming && (
            <div className={styles.aiming} role="status">
              {casting && casting.mode === 'target'
                ? `Cast ${aiming.label}: click who it's for, on the map or in the turn order.`
                : `Pick a target for ${aiming.label}: click a miniature or a name in the turn order.`}
              {casting && <SlotPicker casting={casting} />}
              <button type="button" className={styles.aimingCancel} onClick={cancel}>
                Cancel
              </button>
            </div>
          )}
          {casting && casting.mode === 'area' && (
            <div className={styles.aiming} role="status">
              Cast {casting.label}:{' '}
              {casting.area?.fromCaster ? 'point it with the mouse and click' : 'click where it goes'}.
              <SlotPicker casting={casting} />
              <button type="button" className={styles.aimingCancel} onClick={cancel}>
                Cancel
              </button>
            </div>
          )}
          {drawing?.draft && (
            <div className={styles.aiming} role="status">
              Click on the map where {drawing.draft.label || 'the area'} goes.
              <button type="button" className={styles.aimingCancel} onClick={cancel}>
                Cancel
              </button>
            </div>
          )}
          {map ? (
            <MapStage
              className={styles.map}
              map={map}
              tokens={tokens}
              fight={fight}
              characters={characters}
              userId={me.user_id}
              playersMove={stage.stage.playersMoveTokens}
              pointers={pointers}
              onGrid={(patch) => onGrid(map, patch)}
              aim={
                aiming && !(casting && casting.rangeFt === null)
                  ? { attackerId: aiming.attackerId, reach: aiming.reach }
                  : null
              }
              areas={areas.areas}
              onAreaClick={(id) => {
                const area = areas.areas.find((a) => a.id === id)
                if (area && window.confirm(`Take ${area.label || 'this area'} off the map?`)) areas.remove(area)
              }}
              placing={
                casting && casting.mode === 'area' && casting.area
                  ? {
                      shape: casting.area.shape,
                      sizeFt: casting.area.sizeFt,
                      tone: casting.area.tone,
                      label: casting.label,
                      fromId: casting.area.fromCaster ? casting.casterId : null,
                      onPlace: casting.onPlace,
                    }
                  : drawing?.draft
                    ? {
                        ...drawing.draft,
                        fromId: null,
                        onPlace: (template) => {
                          const draft = drawing.draft
                          setDrawing(null)
                          if (draft)
                            void areas.add({ ...template, label: draft.label, tone: draft.tone, hidden: draft.hidden })
                        },
                      }
                    : null
              }
              targeting={
                aiming
                  ? {
                      onPick: (token) => {
                        const row = rowOfToken(token)
                        if (row && row.combatant.id !== aiming.attackerId) aiming.onPick(row)
                      },
                    }
                  : null
              }
            />
          ) : (
            <section className={styles.noMap} aria-label="No map on stage">
              <h2 className={styles.noMapTitle}>No battle map on stage</h2>
              <p className={styles.hint}>
                Fight in your heads (pick targets in the turn order), or put a map up and everyone gets a miniature.
              </p>
              <div className={styles.mapChoices}>
                {maps.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={styles.mapChoice}
                    onClick={() => void putUp(choice.id)}
                  >
                    <StoredImage
                      className={styles.mapThumb}
                      path={choice.thumbPath ?? choice.path}
                      alt=""
                      fallback="Map"
                    />
                    <span>{choice.name}</span>
                  </button>
                ))}
              </div>
              {onAddStarter && (
                <div className={styles.mapChoices}>
                  {STARTER_MAPS.filter((s) => !maps.some((m) => m.name === s.name)).map((starter) => (
                    <button
                      key={starter.file}
                      type="button"
                      className={styles.mapChoice}
                      title={starter.hint}
                      onClick={() =>
                        void onAddStarter(starter).then(
                          (added) => putUp(added.id),
                          (caught: unknown) => setProblem(messageFor(caught)),
                        )
                      }
                    >
                      <img className={styles.mapThumb} src={starterMapUrl(starter)} alt="" />
                      <span>{starter.name} (comes with the table)</span>
                    </button>
                  ))}
                </div>
              )}
              {maps.length === 0 && <p className={styles.hint}>Or upload your own under Maps on the stage.</p>}
            </section>
          )}
          <div className={styles.strip}>
            <CombatFeed
              className={styles.feed}
              events={controls.events}
              nameOf={nameOf}
              onUndo={controls.undo}
              limit={5}
            />
            {controls.events.length === 0 && (
              <p className={cx(styles.hint, styles.feedEmpty)}>
                What happens shows here: hits, misses and damage, with Undo for the newest.
              </p>
            )}
            {(problem ?? castProblem ?? controls.error ?? table.error ?? tokens.error ?? areas.error) && (
              <Notice tone="error">
                {problem ?? castProblem ?? controls.error ?? table.error ?? tokens.error ?? areas.error}
              </Notice>
            )}
          </div>
        </div>

        <CameraColumn
          className={styles.cameras}
          members={members}
          characters={characters}
          online={online}
          myId={me.user_id}
          turn={cameraTurn(rows, me.user_id)}
        />
      </div>

      <div ref={attachTray} className={styles.tray} aria-hidden="true" />
      <RollToasts
        className={styles.toasts}
        rolls={table.shown}
        members={members}
        characters={characters}
        onDismiss={table.dismiss}
      />

      {(askFor || showResults) && !adding && (
        <Backdrop
          className={styles.overlay}
          onClose={() => (askFor ? setAskFor(null) : request && setHiddenFor(request.id))}
        >
          {askFor ? (
            <AskRollDialog
              characters={characters}
              hereTonight={hereTonight}
              only={askFor.only}
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

      {drawing && !drawing.draft && (
        <Backdrop className={styles.overlay} onClose={() => setDrawing(null)}>
          <AreaDialog onPlace={(draft) => setDrawing({ draft })} onCancel={() => setDrawing(null)} />
        </Backdrop>
      )}

      {adding && (
        <Backdrop className={styles.overlay} onClose={() => setAdding(false)}>
          <AddMonsterDialog
            monsters={monsters}
            onAdd={async (pick) => {
              const added = await controls.addMonsters(pick.monster, pick.count, true)
              if (map && added) await placeMonsters(added.combatants.map((c) => c.id))
            }}
            onClose={() => setAdding(false)}
          />
        </Backdrop>
      )}
    </main>
  )
}
