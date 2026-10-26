import { cx } from '../../components/cx.ts'
import type { Combatant } from '../../live/combat.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { AttackEntry, Character } from '../../rules/character.ts'
import { actionSummary, crText, HEALTH_WORDS, isAttack } from '../../rules/combat.ts'
import { defencesText, NO_DEFENCES } from '../../rules/damage.ts'
import { abilityModifier, formatBonus } from '../../rules/maths/core.ts'
import {
  CONDITIONS,
  findCondition,
  type SrdMonster,
  type SrdMonsterAction,
  type SrdSpell,
} from '../../rules/srd/index.ts'
import { fightRows, turnLimits, type FightRow } from './fightRows.ts'
import { actionFree } from '../../rules/turn.ts'
import styles from './Fight.module.css'
import { CombatFeed, TurnPips } from './TurnParts.tsx'
import { DeathSaves } from './Reactions.tsx'
import { ConcentrationChip, SlotPips, SpellList } from './SpellParts.tsx'
import { AtAGlance } from './AtAGlance.tsx'
import { SheetLink } from '../../components/SheetLink.tsx'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { Aiming } from './useAiming.ts'

type Fight = NonNullable<FightControls['fight']>

const STATUS_WORDS = { acting: 'Acting', next: 'Next', done: 'Done' }

type TurnOrderProps = {
  fight: Fight
  rows: FightRow[]
  controls: FightControls
  focusId: string | null
  onSelect: (id: string) => void
  /** Changes a character's hit points by an amount (negative for damage). */
  onCharacterHp: (character: Character, change: number) => void
  onRollInitiative: (combatant: Combatant, row: FightRow) => void
  /** Picking a target: names in the order can be clicked to pick them. */
  aiming?: Aiming
  rolling?: boolean
  /** Narrower rows, for the Battle screen's left column. */
  compact?: boolean
  /** The SRD monsters, so a monster's pips count its Multiattack. */
  monsters?: SrdMonster[] | null
  className?: string
}

/** The turn order (design 10): initiative, names, hit points, what's left of the acting turn. */
export function TurnOrder({
  fight,
  rows,
  controls,
  focusId,
  onSelect,
  onCharacterHp,
  onRollInitiative,
  aiming = null,
  rolling,
  compact = false,
  monsters = null,
  className,
}: TurnOrderProps) {
  const waiting = rows.filter((r) => r.combatant.initiative === null)

  function changeHp(row: FightRow, by: number) {
    if (row.character) onCharacterHp(row.character, by)
    else if (row.secret) controls.setMonsterHp(row.secret, row.secret.hp + by)
  }

  return (
    <section className={cx(styles.order, className)} aria-labelledby="order-title">
      <div className={styles.orderHead}>
        <h2 id="order-title" className={styles.panelTitle}>
          Turn order
        </h2>
        <span className={styles.round}>Round {fight.encounter.round}</span>
      </div>
      {waiting.length > 0 && (
        <p className={styles.hint}>
          Waiting for initiative from {waiting.map((r) => r.name).join(', ')}. The first turn starts by itself once
          everyone has rolled, or press Next turn to start now.
        </p>
      )}
      {aiming && (
        <p className={styles.aimHint}>Pick a target for {aiming.label}: click a name below, or a miniature.</p>
      )}
      <ol className={styles.rows}>
        {rows.map((row) => {
          const pickable = aiming !== null && row.combatant.id !== aiming.attackerId
          return (
            <li key={row.combatant.id}>
              <div
                className={cx(
                  styles.row,
                  compact && styles.rowCompact,
                  row.status === 'acting' && styles.acting,
                  row.combatant.id === focusId && styles.focused,
                  row.health === 'down' && styles.down,
                  pickable && styles.pickable,
                )}
              >
                <span className={styles.init}>{row.combatant.initiative ?? '–'}</span>
                <button
                  type="button"
                  className={styles.rowName}
                  onClick={() => (pickable ? aiming.onPick(row) : onSelect(row.combatant.id))}
                  title={pickable ? `Attack ${row.name}` : undefined}
                >
                  <span className={row.combatant.kind === 'monster' ? styles.monsterText : undefined}>{row.name}</span>
                  {row.character?.concentration && (
                    <span className={styles.concentrating} title={`Concentrating on ${row.character.concentration}`}>
                      C
                    </span>
                  )}
                  {row.unrevealed && (
                    <span className={styles.hidden}> · players see &ldquo;{row.combatant.shownName}&rdquo;</span>
                  )}
                  {row.status === 'acting' && (
                    <span className={styles.rowPips}>
                      <TurnPips turn={row.combatant.turn} {...turnLimits(row, monsters)} />
                    </span>
                  )}
                </button>
                <span className={styles.hp}>{row.hp ? `${row.hp.current}/${row.hp.max}` : ''}</span>
                <span className={styles.status}>
                  {row.combatant.initiative === null ? (
                    <button
                      type="button"
                      className={styles.link}
                      disabled={rolling}
                      onClick={() => onRollInitiative(row.combatant, row)}
                    >
                      {row.character && !compact ? 'Roll for them' : 'Roll'}
                    </button>
                  ) : row.status ? (
                    STATUS_WORDS[row.status]
                  ) : row.conditions.length > 0 ? (
                    row.conditions.map((c) => findCondition(c)?.name ?? c).join(', ')
                  ) : row.health !== 'healthy' ? (
                    HEALTH_WORDS[row.health]
                  ) : (
                    ''
                  )}
                </span>
                <button
                  type="button"
                  className={styles.hpButton}
                  aria-label={`Take 1 hit point from ${row.name}`}
                  title="Click for 1, Shift-click for 5"
                  disabled={!row.hp}
                  onClick={(event) => changeHp(row, event.shiftKey ? -5 : -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.hpButton}
                  aria-label={`Give 1 hit point to ${row.name}`}
                  title="Click for 1, Shift-click for 5"
                  disabled={!row.hp}
                  onClick={(event) => changeHp(row, event.shiftKey ? 5 : 1)}
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

type ActingNowProps = {
  campaignId: string
  row: FightRow | null
  controls: FightControls
  monsters: SrdMonster[] | null
  /** A monster's attack: pick its target next. */
  onAttack: (row: FightRow, action: SrdMonsterAction) => void
  /** Acting for a player: one of their attacks, then its target. */
  onCharacterAttack: (row: FightRow, attack: AttackEntry) => void
  /** Opens a sheet in the app on a plain click (Screen 1's panel); otherwise it opens in a new tab. */
  onOpenSheet?: (character: Character) => void
  /** A character at 0 hit points: roll their death save. */
  onDeathSave?: (row: FightRow) => void
  /** Changes a character's sheet: Stabilise, up with 1 hit point, or Lost it (concentration). */
  onUpdate?: (characterId: string, patch: TrackerPatch) => void
  /** The SRD spells, for a caster's spell list. */
  spells?: SrdSpell[] | null
  /** Acting for a caster: one of their spells, then its target or where it goes. */
  onCast?: (row: FightRow, spell: SrdSpell) => void
  /** Rolls the save a caster owes to keep concentrating. */
  onConcentrationSave?: (character: Character) => void
  /** Show the number key for each attack (the Battle screen's keyboard). */
  numbered?: boolean
  rolling?: boolean
  className?: string
}

/** The Acting now card (design 10): what the creature can do this turn, each attack a click away from its target. */
export function ActingNow({
  campaignId,
  row,
  controls,
  monsters,
  onAttack,
  onCharacterAttack,
  onOpenSheet,
  onDeathSave,
  onUpdate,
  spells = null,
  onCast,
  onConcentrationSave,
  numbered = false,
  rolling,
  className,
}: ActingNowProps) {
  if (!row) {
    return (
      <section className={cx(styles.actingCard, className)} aria-label="Acting now">
        <div className={styles.eyebrow}>Acting now</div>
        <p className={styles.hint}>
          Nobody yet. The first turn starts once everyone has initiative, or press Next turn.
        </p>
      </section>
    )
  }

  const monster = row.secret?.monster ? monsters?.find((m) => m.index === row.secret?.monster) : undefined
  const available = CONDITIONS.filter((c) => c.index !== 'exhaustion' && !row.conditions.includes(c.index))
  const attacks = monster?.actions.filter(isAttack) ?? []
  // What it can do with a bonus action, from its stat block (a goblin's Nimble Escape).
  const bonusActions = [...(monster?.traits ?? []), ...(monster?.actions ?? [])].filter((a) =>
    /bonus action/i.test(a.desc),
  )
  const defences = defencesText(row.character ?? row.secret ?? NO_DEFENCES)

  return (
    <section className={cx(styles.actingCard, className)} aria-label="Acting now">
      <div className={styles.eyebrow}>{row.status === 'acting' ? 'Acting now' : 'Looking at'}</div>
      <div className={styles.actingHead}>
        <div>
          <div className={styles.actingName}>{row.name}</div>
          <div className={styles.actingMeta}>
            {row.character
              ? `AC ${row.character.armourClass} · HP ${row.character.currentHp}/${row.character.maxHp} · speed ${row.character.speed} ft`
              : row.secret
                ? `AC ${row.secret.ac} · HP ${row.secret.hp}/${row.secret.maxHp}${monster ? ` · speed ${monster.speedText}` : ''}`
                : ''}
          </div>
          <div className={styles.actingPips}>
            <TurnPips turn={row.combatant.turn} {...turnLimits(row, monsters)} />
          </div>
          {defences && <div className={styles.defences}>{defences}</div>}
        </div>
      </div>

      {row.character ? (
        <>
          {row.character.currentHp === 0 && (
            <DeathSaves
              who={row.character.name}
              saves={{
                successes: row.character.deathSaveSuccesses,
                failures: row.character.deathSaveFailures,
                stable: row.character.stable,
                dead: row.character.dead,
              }}
              onRoll={onDeathSave && (() => onDeathSave(row))}
              onStabilise={onUpdate && (() => row.character && onUpdate(row.character.id, { stable: true }))}
              onWake={onUpdate && (() => row.character && onUpdate(row.character.id, { currentHp: 1 }))}
              rolling={rolling}
            />
          )}
          <p className={styles.hint}>
            {row.character.name} acts from their own screen. If they&rsquo;ve stepped away, act for them:
          </p>
          <ul className={styles.actions}>
            {row.character.attacks.map((attack, i) => (
              <li key={attack.id ?? i}>
                <button
                  type="button"
                  className={styles.action}
                  disabled={rolling}
                  onClick={() => row.character && onCharacterAttack(row, attack)}
                >
                  <span className={styles.actionName}>
                    {numbered && i < 9 && <span className={styles.key}>{i + 1}</span>}
                    {attack.name || 'Attack'}
                  </span>
                  <span className={styles.actionText}>Then pick a target</span>
                </button>
              </li>
            ))}
          </ul>
          {onCast && row.character.spellcasting.spells.length > 0 && (
            <>
              <div className={styles.legend}>Spells</div>
              <SlotPips spellcasting={row.character.spellcasting} />
              <SpellList
                character={row.character}
                spells={spells}
                onCast={(spell) => onCast(row, spell)}
                rolling={rolling}
              />
            </>
          )}
          <ConcentrationChip
            character={row.character}
            onLostIt={onUpdate && (() => row.character && onUpdate(row.character.id, { concentration: null }))}
            onSave={onConcentrationSave && (() => row.character && onConcentrationSave(row.character))}
            rolling={rolling}
          />
          <AtAGlance character={row.character} spells={spells} />
          <SheetLink
            campaignId={campaignId}
            characterId={row.character.id}
            className={styles.secondary}
            onOpen={onOpenSheet && (() => row.character && onOpenSheet(row.character))}
            title="Cmd or Ctrl click to open it in a new tab"
          >
            Open their sheet
          </SheetLink>
        </>
      ) : (
        <>
          {row.unrevealed ? (
            <button type="button" className={styles.reveal} onClick={() => controls.reveal(row.combatant)}>
              Reveal name: players see &ldquo;{row.combatant.shownName}&rdquo;
            </button>
          ) : (
            <p className={styles.hint}>Players see its name.</p>
          )}
          {monster && (
            <>
              <div className={styles.legend}>What it can do this turn</div>
              <ul className={styles.actions}>
                {monster.actions.map((action) => {
                  const number = attacks.indexOf(action)
                  return (
                    <li key={action.name}>
                      <button
                        type="button"
                        className={styles.action}
                        disabled={!isAttack(action) || rolling}
                        title={isAttack(action) ? 'Then pick a target' : action.desc}
                        onClick={() => onAttack(row, action)}
                      >
                        <span className={styles.actionName}>
                          {numbered && number >= 0 && number < 9 && <span className={styles.key}>{number + 1}</span>}
                          {action.name}
                        </span>
                        <span className={styles.actionText}>{actionSummary(action)}</span>
                      </button>
                    </li>
                  )
                })}
                {monster.traits.map((trait) => (
                  <li key={trait.name} className={styles.trait} title={trait.desc}>
                    <span className={styles.actionName}>{trait.name}</span>
                    <span className={styles.actionText}>{actionSummary({ ...trait, damage: [] })}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.legend}>Also on its turn</div>
              <div className={styles.turnButtons}>
                {(['dash', 'disengage', 'dodge'] as const).map((what) => (
                  <button
                    key={what}
                    type="button"
                    className={styles.turnButton}
                    disabled={!actionFree(row.combatant.turn)}
                    title={`Spends its action: ${what === 'dash' ? 'its speed again' : what === 'disengage' ? 'no opportunity attacks as it moves away' : 'attacks against it have disadvantage'}`}
                    onClick={() => controls.act(row.combatant, what)}
                  >
                    {what[0].toUpperCase() + what.slice(1)}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.turnButton}
                  disabled={row.combatant.turn.bonusUsed}
                  title={
                    bonusActions.map((a) => `${a.name}: ${a.desc}`).join('\n\n') ||
                    'Click when it uses its bonus action'
                  }
                  onClick={() => controls.act(row.combatant, 'bonus')}
                >
                  {row.combatant.turn.bonusUsed ? 'Bonus action used' : 'Bonus action'}
                  {bonusActions.length > 0 && `: ${bonusActions.map((a) => a.name).join(', ')}`}
                </button>
                <button
                  type="button"
                  className={styles.turnButton}
                  disabled={row.combatant.turn.reactionUsed}
                  title={
                    monster.reactions.map((a) => `${a.name}: ${a.desc}`).join('\n\n') ||
                    'Click when it uses its reaction'
                  }
                  onClick={() => controls.act(row.combatant, 'reaction')}
                >
                  {row.combatant.turn.reactionUsed ? 'Reaction used' : 'Reaction'}
                  {monster.reactions.length > 0 && `: ${monster.reactions.map((a) => a.name).join(', ')}`}
                </button>
              </div>
              <p className={styles.hint}>
                Initiative {formatBonus(abilityModifier(monster.scores.dexterity))} · passive Perception{' '}
                {monster.passivePerception} · CR {crText(monster.cr)}
              </p>
            </>
          )}
          <div className={styles.conditionRow}>
            {row.conditions.map((c) => (
              <span key={c} className={styles.condition}>
                {findCondition(c)?.name ?? c}
                <button
                  type="button"
                  className={styles.removeSmall}
                  aria-label={`Remove ${findCondition(c)?.name ?? c}`}
                  onClick={() =>
                    controls.setConditions(
                      row.combatant,
                      row.conditions.filter((x) => x !== c),
                    )
                  }
                >
                  ×
                </button>
              </span>
            ))}
            <select
              aria-label="Add a condition"
              value=""
              onChange={(event) =>
                event.target.value && controls.setConditions(row.combatant, [...row.conditions, event.target.value])
              }
            >
              <option value="">Add a condition…</option>
              {available.map((c) => (
                <option key={c.index} value={c.index}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actingButtons}>
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                if (window.confirm(`Take ${row.name} out of the fight?`)) controls.remove(row.combatant)
              }}
            >
              Remove from the fight
            </button>
          </div>
        </>
      )}
    </section>
  )
}

type EncounterTabProps = {
  campaignId: string
  fight: Fight
  controls: FightControls
  characters: Character[]
  monsters: SrdMonster[] | null
  selectedId: string | null
  onSelect: (id: string) => void
  onCharacterHp: (character: Character, change: number) => void
  onAttack: (row: FightRow, action: SrdMonsterAction) => void
  onCharacterAttack: (row: FightRow, attack: AttackEntry) => void
  onRollInitiative: (combatant: Combatant, row: FightRow) => void
  onOpenSheet: (character: Character) => void
  aiming?: Aiming
  rolling?: boolean
}

/** Screen 1's Encounter tab: the turn order, what just happened, and the Acting now card. */
export function EncounterTab({
  campaignId,
  fight,
  controls,
  characters,
  monsters,
  selectedId,
  onSelect,
  onCharacterHp,
  onAttack,
  onCharacterAttack,
  onRollInitiative,
  onOpenSheet,
  aiming = null,
  rolling,
}: EncounterTabProps) {
  const rows = fightRows(fight, characters, 'dm')
  const focus = rows.find((r) => r.combatant.id === (selectedId ?? fight.encounter.currentId)) ?? null
  const nameOf = (id: string | null) => rows.find((r) => r.combatant.id === id)?.name ?? 'Someone'

  return (
    <div className={styles.encounter}>
      <div className={styles.encounterLeft}>
        <TurnOrder
          monsters={monsters}
          fight={fight}
          rows={rows}
          controls={controls}
          focusId={focus?.combatant.id ?? null}
          onSelect={onSelect}
          onCharacterHp={onCharacterHp}
          onRollInitiative={onRollInitiative}
          aiming={aiming}
          rolling={rolling}
        />
        <CombatFeed events={controls.events} nameOf={nameOf} onUndo={controls.undo} limit={4} />
      </div>
      <ActingNow
        campaignId={campaignId}
        row={focus}
        controls={controls}
        monsters={monsters}
        onAttack={onAttack}
        onCharacterAttack={onCharacterAttack}
        onOpenSheet={onOpenSheet}
        rolling={rolling}
      />
    </div>
  )
}
