import { cx } from '../../components/cx.ts'
import type { Combatant } from '../../live/combat.ts'
import type { FightControls } from '../../live/useFight.ts'
import type { Character } from '../../rules/character.ts'
import { actionSummary, crText, HEALTH_WORDS, isAttack } from '../../rules/combat.ts'
import { abilityModifier, formatBonus } from '../../rules/maths/core.ts'
import { CONDITIONS, findCondition, type SrdMonster, type SrdMonsterAction } from '../../rules/srd/index.ts'
import { fightRows, type FightRow } from './fightRows.ts'
import styles from './Fight.module.css'

type EncounterTabProps = {
  fight: NonNullable<FightControls['fight']>
  controls: FightControls
  characters: Character[]
  monsters: SrdMonster[] | null
  selectedId: string | null
  onSelect: (id: string) => void
  /** Changes a character's hit points by an amount (negative for damage). */
  onCharacterHp: (character: Character, change: number) => void
  onRollAttack: (name: string, action: SrdMonsterAction) => void
  onRollInitiative: (combatant: Combatant, row: FightRow) => void
  onOpenSheet: (character: Character) => void
  rolling?: boolean
}

const STATUS_WORDS = { acting: 'Acting', next: 'Next', done: 'Done' }

/** Screen 10's Encounter tab: the turn order with quick HP, and the Acting now card. */
export function EncounterTab({
  fight,
  controls,
  characters,
  monsters,
  selectedId,
  onSelect,
  onCharacterHp,
  onRollAttack,
  onRollInitiative,
  onOpenSheet,
  rolling,
}: EncounterTabProps) {
  const rows = fightRows(fight, characters, 'dm')
  const focus = rows.find((r) => r.combatant.id === (selectedId ?? fight.encounter.currentId)) ?? null
  const waiting = rows.filter((r) => r.combatant.initiative === null)

  function changeHp(row: FightRow, by: number) {
    if (row.character) onCharacterHp(row.character, by)
    else if (row.secret) controls.setMonsterHp(row.secret, row.secret.hp + by)
  }

  return (
    <div className={styles.encounter}>
      <section className={styles.order} aria-labelledby="order-title">
        <div className={styles.orderHead}>
          <h2 id="order-title" className={styles.panelTitle}>
            Turn order
          </h2>
          <span className={styles.round}>Round {fight.encounter.round}</span>
        </div>
        {waiting.length > 0 && (
          <p className={styles.hint}>
            Waiting for initiative from {waiting.map((r) => r.name).join(', ')}. Start the first turn whenever
            you&rsquo;re ready.
          </p>
        )}
        <ol className={styles.rows}>
          {rows.map((row) => (
            <li key={row.combatant.id}>
              <div
                className={cx(
                  styles.row,
                  row.status === 'acting' && styles.acting,
                  row.combatant.id === focus?.combatant.id && styles.focused,
                  row.health === 'down' && styles.down,
                )}
              >
                <span className={styles.init}>{row.combatant.initiative ?? '–'}</span>
                <button type="button" className={styles.rowName} onClick={() => onSelect(row.combatant.id)}>
                  <span className={row.combatant.kind === 'monster' ? styles.monsterText : undefined}>{row.name}</span>
                  {row.unrevealed && (
                    <span className={styles.hidden}> · players see &ldquo;{row.combatant.shownName}&rdquo;</span>
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
          ))}
        </ol>
      </section>

      <ActingNow
        row={focus}
        controls={controls}
        monsters={monsters}
        onRollAttack={onRollAttack}
        onOpenSheet={onOpenSheet}
        rolling={rolling}
      />
    </div>
  )
}

function ActingNow({
  row,
  controls,
  monsters,
  onRollAttack,
  onOpenSheet,
  rolling,
}: {
  row: FightRow | null
  controls: FightControls
  monsters: SrdMonster[] | null
  onRollAttack: (name: string, action: SrdMonsterAction) => void
  onOpenSheet: (character: Character) => void
  rolling?: boolean
}) {
  if (!row) {
    return (
      <section className={styles.actingCard} aria-label="Acting now">
        <div className={styles.eyebrow}>Acting now</div>
        <p className={styles.hint}>
          Nobody yet. Press Next turn to start the first turn, or click anyone in the order.
        </p>
      </section>
    )
  }

  const monster = row.secret?.monster ? monsters?.find((m) => m.index === row.secret?.monster) : undefined
  const attacks = monster?.actions.filter(isAttack) ?? []
  const available = CONDITIONS.filter((c) => c.index !== 'exhaustion' && !row.conditions.includes(c.index))

  return (
    <section className={styles.actingCard} aria-label="Acting now">
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
        </div>
      </div>

      {row.character ? (
        <>
          <p className={styles.hint}>
            {row.character.name} acts from their own screen. You can open their sheet to help.
          </p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => row.character && onOpenSheet(row.character)}
          >
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
                {monster.actions.map((action) => (
                  <li key={action.name}>
                    <button
                      type="button"
                      className={styles.action}
                      disabled={!isAttack(action) || rolling}
                      title={isAttack(action) ? 'Roll it behind the screen' : action.desc}
                      onClick={() => onRollAttack(row.name, action)}
                    >
                      <span className={styles.actionName}>{action.name}</span>
                      <span className={styles.actionText}>{actionSummary(action)}</span>
                    </button>
                  </li>
                ))}
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
            {attacks.length > 0 && (
              <button
                type="button"
                className={styles.secret}
                disabled={rolling}
                onClick={() => onRollAttack(row.name, attacks[0])}
              >
                Roll its attack in secret
              </button>
            )}
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
