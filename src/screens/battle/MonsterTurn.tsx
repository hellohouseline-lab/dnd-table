import { cx } from '../../components/cx.ts'
import type { TurnAction } from '../../live/combat.ts'
import { ABILITY_NAME } from '../../rules/abilities.ts'
import { actionSummary } from '../../rules/combat.ts'
import { CONDITION_WORD } from '../../rules/conditionClocks.ts'
import { monsterBonusActions } from '../../rules/monsterBonus.ts'
import { multiattackText, type MonsterCard } from '../../rules/monsterTurn.ts'
import type { SrdMonster } from '../../rules/srd/index.ts'
import type { BonusMove } from '../../rules/turn.ts'
import { YourTurn } from '../fight/PlayerCombat.tsx'
import { turnLimits, type FightRow } from '../fight/fightRows.ts'
import styles from './MonsterTurn.module.css'

type MonsterPanelProps = {
  row: FightRow
  monster: SrdMonster
  onAct: (what: TurnAction) => void
  onEndTurn: () => void
  /** Same for the rest: the last attack by one of its kind, to repeat with this one. */
  same: { label: string; target: string; onRepeat: () => void } | null
  rolling: boolean
  className?: string
}

/**
 * Play as the monsters (P1c): the acting monster's turn as a player sees their own, with its hit
 * points, armour class and conditions on top, and Same for the rest for a group of one kind.
 */
export function MonsterPanel({ row, monster, onAct, onEndTurn, same, rolling, className }: MonsterPanelProps) {
  const secret = row.secret
  const limits = turnLimits(row, [monster])
  const moves = [...new Set(monsterBonusActions(monster).flatMap((b) => b.moves))] as BonusMove[]
  const multiattack = multiattackText(monster)
  return (
    <section className={cx(styles.panel, className)} aria-label="Playing the monster">
      <div className={styles.head}>
        <div className={styles.name}>{row.name}</div>
        {secret && (
          <div className={styles.stats}>
            <span>
              HP <strong>{secret.hp}</strong>/{secret.maxHp}
            </span>
            <span>
              AC <strong>{secret.ac}</strong>
            </span>
            <span>Speed {monster.speedText}</span>
          </div>
        )}
        {row.conditions.length > 0 && (
          <div className={styles.conditions}>
            {row.conditions.map((c) => (
              <span key={c} className={styles.condition}>
                {CONDITION_WORD[c] ?? c}
              </span>
            ))}
          </div>
        )}
        {multiattack && <p className={styles.multi}>{multiattack}</p>}
      </div>
      {same && (
        <button type="button" className={styles.same} disabled={rolling} onClick={same.onRepeat}>
          Same for the rest: {same.label} on {same.target}
        </button>
      )}
      <YourTurn
        title={`${row.name}’s turn`}
        turn={row.combatant.turn}
        speed={limits.speed}
        perAction={limits.perAction}
        myTurn
        started
        bonusMoves={moves}
        onAct={onAct}
        onEndTurn={onEndTurn}
      />
    </section>
  )
}

const COST_WORDS = { action: 'Action', bonus: 'Bonus', reaction: 'Reaction', legendary: 'Legendary' } as const

type MonsterHandProps = {
  name: string
  cards: MonsterCard[]
  /** What its turn has left, to grey out what's spent. */
  turn: { actionFree: boolean; attacksLeft: number; bonusUsed: boolean; reactionUsed: boolean }
  onPlay: (card: MonsterCard) => void
  rolling: boolean
  className?: string
}

/** The acting monster's cards along the bottom, like a player's hand: click one, then its target. */
export function MonsterHand({ name, cards, turn, onPlay, rolling, className }: MonsterHandProps) {
  let attackNumber = 0
  return (
    <div className={cx(styles.hand, className)} role="group" aria-label={`${name}’s cards`}>
      {cards.map((card) => {
        const number = card.kind === 'attack' && card.cost === 'action' ? ++attackNumber : null
        const spent =
          card.cost === 'action'
            ? card.kind === 'attack'
              ? turn.attacksLeft === 0
              : !turn.actionFree
            : card.cost === 'bonus'
              ? turn.bonusUsed
              : card.cost === 'reaction'
                ? turn.reactionUsed
                : false
        const detail =
          card.kind === 'attack'
            ? actionSummary(card.action)
            : card.kind === 'save'
              ? `DC ${card.ability.dc} ${ABILITY_NAME[card.ability.save]} save${
                  card.ability.damage ? ` · ${card.ability.damageType || 'damage'}` : ''
                }`
              : card.desc.split(/(?<=\.)\s/)[0]
        return (
          <button
            key={card.key}
            type="button"
            className={cx(styles.card, styles[card.cost], spent && styles.spent)}
            disabled={rolling}
            title={card.kind === 'attack' ? card.action.desc : card.desc}
            aria-label={`${card.name} (${COST_WORDS[card.cost].toLowerCase()})${spent ? ', used' : ''}`}
            onClick={() => onPlay(card)}
          >
            <span className={styles.tag}>
              {number !== null && number <= 9 && <span className={styles.key}>{number}</span>}
              {COST_WORDS[card.cost]}
              {card.kind === 'save' && ' · save'}
            </span>
            <span className={styles.cardName}>{card.name}</span>
            <span className={styles.detail}>{detail}</span>
            {card.recharge && <span className={styles.recharge}>{card.recharge}</span>}
          </button>
        )
      })}
    </div>
  )
}
