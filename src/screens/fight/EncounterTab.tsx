import { cx } from '../../components/cx.ts'
import type { Combatant } from '../../live/combat.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { AttackEntry, Character } from '../../rules/character.ts'
import { actionSummary, crText, HEALTH_WORDS, isAttack } from '../../rules/combat.ts'
import { abilityModifier, formatBonus } from '../../rules/maths/core.ts'
import { CONDITIONS, findCondition, type SrdMonster, type SrdMonsterAction } from '../../rules/srd/index.ts'
import { fightRows, turnLimits, type FightRow } from './fightRows.ts'
import styles from './Fight.module.css'
import { CombatFeed, TurnPips } from './TurnParts.tsx'
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
      {aiming && <p className={styles.aimHint}>Pick a target for {aiming.label}: click a name below, or a miniature.</p>}
      <ol className={styles.rows}>
        {rows.map((row) => {
          const pickable = aiming !== null && row.combatant.id !== aiming.attackerId
          return (
            <li key={row.combatant.id}>
              <div
                className={cx(
                  styles.row,
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
                  {row.unrevealed && (
                    <span className={styles.hidden}> · players see &ldquo;{row.combatant.shownName}&rdquo;</span>
                  )}
                  {row.status === 'acting' && (
                    <span className={styles.rowPips}>
                      <TurnPips turn={row.combatant.turn} {...turnLimits(row)} />
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
                      {row.character ? 'Roll for them' : 'Roll'}
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
  row: FightRow | null
  controls: FightControls
  monsters: SrdMonster[] | null
  /** A monster's attack: pick its target next. */
  onAttack: (row: FightRow, action: SrdMonsterAction) => void
  /** Acting for a player: one of their attacks, then its target. */
  onCharacterAttack: (row: FightRow, attack: AttackEntry) => void
  onOpenSheet: (character: Character) => void
  /** Show the number key for each attack (the Battle screen's keyboard). */
  numbered?: boolean
  rolling?: boolean
  className?: string
}

/** The Acting now card (design 10): what the creature can do this turn, each attack a click away from its target. */
export function ActingNow({
  row,
  controls,
  monsters,
  onAttack,
  onCharacterAttack,
  onOpenSheet,
  numbered = false,
  rolling,
  className,
}: ActingNowProps) {
  if (!row) {
    return (
      <section className={cx(styles.actingCard, className)} aria-label="Acting now">
        <div className={styles.eyebrow}>Acting now</div>
        <p className={styles.hint}>Nobody yet. The first turn starts once everyone has initiative, or press Next turn.</p>
      </section>
    )
  }

  const monster = row.secret?.monster ? monsters?.find((m) => m.index === row.secret?.monster) : undefined
  const available = CONDITIONS.filter((c) => c.index !== 'exhaustion' && !row.conditions.includes(c.index))
  const attacks = monster?.actions.filter(isAttack) ?? []

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
            <TurnPips turn={row.combatant.turn} {...turnLimits(row)} />
          </div>
        </div>
      </div>

      {row.character ? (
        <>
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
          <button type="button" className={styles.secondary} onClick={() => row.character && onOpenSheet(row.character)}>
            Open their sheet
          </button>
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

