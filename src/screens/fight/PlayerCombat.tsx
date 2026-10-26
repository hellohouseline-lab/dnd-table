import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import type { Character } from '../../rules/character.ts'
import { HEALTH_WORDS } from '../../rules/combat.ts'
import type { RollMode } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { initiativeRoll } from '../../rules/rolls.ts'
import { actionFree, attacksLeft, movementLeft, type TurnRecord } from '../../rules/turn.ts'
import type { TurnAction } from '../../live/combat.ts'
import type { FightRow } from './fightRows.ts'
import styles from './PlayerCombat.module.css'

type RibbonProps = {
  rows: FightRow[]
  /** While picking a target: who can be picked, and what happens when one is. */
  picking?: { canPick: (row: FightRow) => boolean; onPick: (row: FightRow) => void } | null
}

/** The initiative ribbon along the top in design 05: everyone in turn order, whoever's acting lit. */
export function InitiativeRibbon({ rows, picking = null }: RibbonProps) {
  return (
    <ol className={styles.ribbon} aria-label="Turn order">
      {rows.map((row) => {
        const className = cx(
          styles.pill,
          row.combatant.kind === 'monster' && styles.pillMonster,
          row.status === 'acting' && styles.pillActing,
          row.health === 'down' && styles.pillDown,
        )
        const label = (
          <>
            <span className={styles.pillInit}>{row.combatant.initiative ?? '?'}</span> {row.name}
          </>
        )
        return (
          <li key={row.combatant.id} aria-current={row.status === 'acting' ? 'true' : undefined}>
            {picking && picking.canPick(row) ? (
              <button type="button" className={cx(className, styles.pillPick)} onClick={() => picking.onPick(row)}>
                {label}
              </button>
            ) : (
              <span className={className}>{label}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function TurnBanner({ round, mine, acting }: { round: number; mine: boolean; acting: string | null }) {
  if (mine) return <div className={styles.banner}>Your turn · Round {round}</div>
  return (
    <div className={styles.roundChip}>
      Round {round}
      {acting ? ` · ${acting} is acting` : ''}
    </div>
  )
}

type YourTurnProps = {
  turn: TurnRecord
  /** Your speed from your sheet. */
  speed: number
  /** Attacks your Attack action gives (Extra Attack). */
  perAction: number
  myTurn: boolean
  /** Everyone has initiative and turns have begun. */
  started: boolean
  /** False while unconscious: no actions or movement, only End turn. */
  canAct?: boolean
  onAct: (what: TurnAction) => void
  onEndTurn: () => void
}

/**
 * "This turn" from design 05, kept by the server: your action (and attacks left), bonus action,
 * reaction and movement, Dash, Disengage and Dodge, and End turn. It all comes back at the start of
 * your next turn. Bonus action and reaction are clicked when you use one for a spell or feature.
 */
export function YourTurn({ turn, speed, perAction, myTurn, started, canAct = true, onAct, onEndTurn }: YourTurnProps) {
  const attacks = attacksLeft(turn, perAction)
  const free = actionFree(turn)
  const action =
    turn.attacksMade > 0 && attacks > 0
      ? `${attacks} attack${attacks === 1 ? '' : 's'} left`
      : turn.actionUsed
        ? 'Used'
        : 'Ready'
  const rows: { key: 'bonus' | 'reaction'; label: string; tone: string; used: boolean; can: boolean; hint: string }[] = [
    {
      key: 'bonus',
      label: 'Bonus action',
      tone: styles.blue,
      used: turn.bonusUsed,
      can: myTurn && canAct,
      hint: 'Click when you use your bonus action, for a spell or feature',
    },
    {
      key: 'reaction',
      label: 'Reaction',
      tone: styles.grey,
      used: turn.reactionUsed,
      can: started && canAct,
      hint: 'Click when you use your reaction, such as an opportunity attack',
    },
  ]
  const moves: [TurnAction, string, string][] = [
    ['dash', 'Dash', 'Spend your action to move your speed again'],
    ['disengage', 'Disengage', 'Spend your action so moving away draws no opportunity attacks'],
    ['dodge', 'Dodge', 'Spend your action: attacks against you have disadvantage until your next turn'],
  ]
  const title = myTurn ? 'Your turn' : started ? 'Waiting for your turn' : 'Waiting for everyone’s initiative'
  return (
    <section className={styles.thisTurn} aria-label="This turn">
      <div className={styles.thisTurnTitle}>{title}</div>
      {!started && <p className={styles.placing}>Put your miniature where your character is standing.</p>}
      <ul className={styles.turnRows}>
        <li className={styles.turnRow}>
          <span className={cx(styles.dot, styles.gold, turn.actionUsed && attacks === 0 && styles.dotUsed)} />
          <span className={styles.turnLabel}>Action</span>
          <span className={styles.turnState}>{action}</span>
        </li>
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              className={styles.turnRow}
              title={row.hint}
              disabled={row.used || !row.can}
              onClick={() => onAct(row.key)}
            >
              <span className={cx(styles.dot, row.tone, row.used && styles.dotUsed)} />
              <span className={styles.turnLabel}>{row.label}</span>
              <span className={styles.turnState}>{row.used ? 'Used' : 'Ready'}</span>
            </button>
          </li>
        ))}
        <li className={styles.turnRow}>
          <span className={cx(styles.dot, styles.ring)} />
          <span className={styles.turnLabel}>Movement</span>
          <span className={styles.turnState}>
            {movementLeft(turn, speed)} of {speed + turn.extraFeet} ft
          </span>
        </li>
      </ul>
      <div className={styles.moves} role="group" aria-label="Other actions">
        {moves.map(([what, label, hint]) => (
          <button
            key={what}
            type="button"
            className={styles.move}
            title={hint}
            disabled={!myTurn || !free || !canAct}
            onClick={() => onAct(what)}
          >
            {label}
          </button>
        ))}
      </div>
      <button type="button" className={styles.endTurn} disabled={!myTurn} onClick={onEndTurn}>
        End turn
      </button>
    </section>
  )
}

type InitiativePromptProps = {
  character: Character
  mode: RollMode
  onRoll: () => void
  rolling?: boolean
}

/** The fight begins: one click rolls your initiative (a Dexterity check, conditions applied). */
export function InitiativePrompt({ character, mode, onRoll, rolling }: InitiativePromptProps) {
  const roll = initiativeRoll(character, { mode })
  return (
    <div className={styles.prompt} role="dialog" aria-labelledby="initiative-title">
      <span className={styles.seal} aria-hidden="true">
        <Icon name="sword" size={28} />
      </span>
      <div className={styles.eyebrow}>A fight breaks out</div>
      <h2 id="initiative-title" className={styles.promptTitle}>
        Roll initiative
      </h2>
      <p className={styles.plain}>How quickly you react decides when you act in the turn order.</p>
      <div className={styles.chips}>
        <span className={styles.chip}>Your bonus {formatBonus(roll.modifier)}</span>
        <span className={styles.chip}>{roll.mode === 'normal' ? 'Normal roll' : `With ${roll.mode}`}</span>
      </div>
      <button type="button" className={styles.roll} disabled={rolling} onClick={onRoll}>
        <Icon name="d20" size={20} />
        Roll the d20
      </button>
    </div>
  )
}

/** What the party knows about a token you click: its name and how hurt it looks. */
export function InspectCard({ row, onClose }: { row: FightRow | null; onClose: () => void }) {
  return (
    <div className={styles.inspect} role="status">
      <div className={styles.inspectHead}>
        <span className={styles.inspectName}>{row?.name ?? ''}</span>
        <button type="button" className={styles.inspectClose} aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {row && (
        <div className={cx(styles.health, styles[row.health])}>
          {row.character ? `${row.character.currentHp} of ${row.character.maxHp} hit points` : HEALTH_WORDS[row.health]}
        </div>
      )}
      {row?.combatant.kind === 'monster' && (
        <p className={styles.inspectNote}>Only what the party knows. The DM chooses what&rsquo;s revealed.</p>
      )}
    </div>
  )
}
