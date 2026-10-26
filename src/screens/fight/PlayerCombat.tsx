import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import type { Character } from '../../rules/character.ts'
import { HEALTH_WORDS } from '../../rules/combat.ts'
import type { RollMode } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { initiativeRoll } from '../../rules/rolls.ts'
import type { FightRow } from './fightRows.ts'
import styles from './PlayerCombat.module.css'

/** The initiative ribbon along the top in design 05: everyone in turn order, whoever's acting lit. */
export function InitiativeRibbon({ rows }: { rows: FightRow[] }) {
  return (
    <ol className={styles.ribbon} aria-label="Turn order">
      {rows.map((row) => (
        <li
          key={row.combatant.id}
          className={cx(
            styles.pill,
            row.combatant.kind === 'monster' && styles.pillMonster,
            row.status === 'acting' && styles.pillActing,
            row.health === 'down' && styles.pillDown,
          )}
          aria-current={row.status === 'acting' ? 'true' : undefined}
        >
          <span className={styles.pillInit}>{row.combatant.initiative ?? '?'}</span> {row.name}
        </li>
      ))}
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

type ThisTurnProps = {
  speed: number
  feetLeft: number
  myTurn: boolean
  onEndTurn: () => void
}

type Spent = { action: boolean; bonus: boolean; reaction: boolean }

/**
 * "This turn" from design 05: what you've used of your action, bonus action and reaction (a reminder
 * you tick yourself), how far you can still move, and End turn. Reset by its parent on each new turn.
 */
export function ThisTurn({ speed, feetLeft, myTurn, onEndTurn }: ThisTurnProps) {
  const [spent, setSpent] = useState<Spent>({ action: false, bonus: false, reaction: false })
  const rows: { key: keyof Spent; label: string; tone: string }[] = [
    { key: 'action', label: 'Action', tone: styles.gold },
    { key: 'bonus', label: 'Bonus action', tone: styles.blue },
    { key: 'reaction', label: 'Reaction', tone: styles.grey },
  ]
  return (
    <section className={styles.thisTurn} aria-label="This turn">
      <div className={styles.thisTurnTitle}>{myTurn ? 'This turn' : 'Waiting for your turn'}</div>
      <ul className={styles.turnRows}>
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              className={styles.turnRow}
              aria-pressed={spent[row.key]}
              title="Click when you've used it"
              onClick={() => setSpent({ ...spent, [row.key]: !spent[row.key] })}
            >
              <span className={cx(styles.dot, row.tone, spent[row.key] && styles.dotUsed)} />
              <span className={styles.turnLabel}>{row.label}</span>
              <span className={styles.turnState}>{spent[row.key] ? 'Used' : 'Ready'}</span>
            </button>
          </li>
        ))}
        <li className={styles.turnRow}>
          <span className={cx(styles.dot, styles.ring)} />
          <span className={styles.turnLabel}>Movement</span>
          <span className={styles.turnState}>
            {myTurn ? feetLeft : speed} of {speed} ft
          </span>
        </li>
      </ul>
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
