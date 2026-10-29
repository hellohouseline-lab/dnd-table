import { cx } from '../../components/cx.ts'
import { HpBar } from '../../components/HpBar.tsx'
import type { IconName } from '../../components/Icon.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import { presetPortraitUrl } from '../../live/library.ts'
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
import { CardHand, type HandCard, type HandSet } from '../table/CardHand.tsx'
import { moveDetails, weaponIcon } from '../table/cardDetails.ts'
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

/** "1/4" for a quarter, "5" for five. */
function challengeWords(cr: number): string {
  if (cr > 0 && cr < 1) return `1/${Math.round(1 / cr)}`
  return String(cr)
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
      <div className={styles.plate}>
        <div className={styles.who}>
          {row.combatant.art ? (
            <img className={styles.picture} src={presetPortraitUrl(row.combatant.art)} alt="" />
          ) : (
            <Portrait path={null} size={60} name={row.name} />
          )}
          <div>
            <div className={styles.name}>{row.name}</div>
            <div className={styles.sub}>
              {monster.name} · Challenge {challengeWords(monster.cr)}
            </div>
          </div>
        </div>
        {secret && (
          <div>
            <div className={styles.hpLine}>
              <span className={styles.label}>Hit points</span>
              <span className={styles.hp}>
                {secret.hp} <span className={styles.hpMax}>/ {secret.maxHp}</span>
              </span>
            </div>
            <div className={styles.hpBar}>
              <HpBar current={secret.hp} max={secret.maxHp} temp={0} />
            </div>
          </div>
        )}
        <div className={styles.stats}>
          <StatBox label="AC" value={secret?.ac ?? monster.ac} title="Armour class" />
          <StatBox label="Speed" value={monster.speed} title={`Speed: ${monster.speedText}`} />
          <StatBox label="Init." value={row.combatant.initiative ?? '–'} title="What it rolled for initiative" />
          <StatBox label="Percep." value={monster.passivePerception} title="Passive Perception" />
        </div>
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

const COST_WORDS = { action: 'Action', bonus: 'Bonus action', reaction: 'Reaction', legendary: 'Legendary' } as const
const MOVE_WORDS: Record<BonusMove, [string, string]> = {
  dash: ['Dash', 'Move its speed again this turn.'],
  disengage: ['Disengage', 'Moving away draws no opportunity attacks this turn.'],
  hide: ['Hide', 'Try to hide: its Stealth, rolled secretly, against what the party can see.'],
  dodge: ['Dodge', 'Attacks against it have disadvantage until its next turn.'],
}
const COST_FOR_INFO = { action: 'action', bonus: 'bonus', reaction: 'reaction', legendary: 'free' } as const

/** What a monster's turn has left, to grey out what's spent. */
export type MonsterTurnLeft = { actionFree: boolean; attacksLeft: number; bonusUsed: boolean; reactionUsed: boolean }

/** Bites, claws and the like get a beast's horns; slams a fist; weapons their own picture. */
function cardIcon(card: MonsterCard): IconName {
  if (card.kind === 'save') return 'flame'
  if (card.kind === 'other') return 'powers'
  if (/\b(bite|claw|claws|gore|horn|horns|tail|sting|tentacle|tentacles|beak|talons|hooves|tusk)\b/i.test(card.name))
    return 'horns'
  if (/\b(slam|fist|unarmed|touch)\b/i.test(card.name)) return 'fist'
  return weaponIcon(card.name)
}

/** Why a card is greyed out, or null. */
function whyNot(card: MonsterCard, turn: MonsterTurnLeft): string | null {
  if (card.cost === 'action')
    return card.kind === 'attack'
      ? turn.attacksLeft === 0
        ? 'no attacks left this turn'
        : null
      : turn.actionFree
        ? null
        : 'its action is used this turn'
  if (card.cost === 'bonus') return turn.bonusUsed ? 'its bonus action is used this turn' : null
  if (card.cost === 'reaction') return turn.reactionUsed ? 'its reaction is used' : null
  return null
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 7)
}

/** The monster's cards as a player's hand: attacks, abilities, bonus actions, reactions and legendary actions. */
function monsterHandSets(
  cards: MonsterCard[],
  turn: MonsterTurnLeft,
  onPlay: (card: MonsterCard) => void,
  bonus: { moves: BonusMove[]; source: string; onMove: (move: BonusMove) => void },
): HandSet[] {
  let attackNumber = 0
  const toCard = (card: MonsterCard): HandCard => {
    // Attacks from its action are numbered, as the 1 to 9 keys pick them.
    const number = card.kind === 'attack' && card.cost === 'action' ? ++attackNumber : null
    const why = whyNot(card, turn)
    const detail =
      card.kind === 'attack'
        ? actionSummary(card.action)
        : card.kind === 'save'
          ? `DC ${card.ability.dc} ${ABILITY_NAME[card.ability.save]} save${
              card.ability.damage ? ` · ${card.ability.damageType || 'damage'}` : ''
            }`
          : (card.desc.split(/(?<=\.)\s/)[0] ?? '')
    const desc = card.kind === 'attack' ? card.action.desc : card.desc
    const tag =
      card.kind === 'attack' && card.cost === 'action'
        ? `Attack${number !== null && number <= 9 ? ` · ${number}` : ''}`
        : card.kind === 'save' && card.cost === 'action'
          ? 'Ability · save'
          : COST_WORDS[card.cost]
    return {
      key: card.key,
      tag,
      tone:
        card.cost === 'bonus'
          ? 'bonus'
          : card.kind === 'attack'
            ? 'action'
            : card.kind === 'save'
              ? 'spell'
              : 'feature',
      icon: cardIcon(card),
      name: card.name,
      detail: detail.length > 60 ? `${detail.slice(0, 57)}…` : detail,
      why,
      info: {
        kind: card.kind === 'attack' ? 'weapon' : 'move',
        title: card.name,
        icon: cardIcon(card),
        stats: [
          { label: 'Takes', value: COST_WORDS[card.cost] },
          ...(card.kind === 'save'
            ? [{ label: 'Save', value: `DC ${card.ability.dc} ${ABILITY_NAME[card.ability.save]}` }]
            : []),
          ...(card.recharge ? [{ label: 'Comes back', value: card.recharge }] : []),
        ],
        bullets: sentences(desc),
        footer: [card.kind === 'attack' ? 'Attack' : card.kind === 'save' ? 'Ability with a save' : 'Ability', ''],
        cost: COST_FOR_INFO[card.cost],
      },
      ariaLabel: `${card.name} (${COST_WORDS[card.cost].toLowerCase()})${why ? ', used' : ''}`,
      spent: why !== null,
      play: () => onPlay(card),
    }
  }
  const of = (test: (c: MonsterCard) => boolean) => cards.filter(test).map(toCard)
  // Bonus moves its traits give it (a goblin's Nimble Escape: Disengage or Hide).
  const moveCards = bonus.moves.map((move): HandCard => ({
    key: `move-${move}`,
    tag: 'Bonus action',
    tone: 'bonus',
    icon: 'leave',
    name: MOVE_WORDS[move][0],
    detail: bonus.source ? `${bonus.source}: keeps its action` : 'Keeps its action',
    why: turn.bonusUsed ? 'its bonus action is used this turn' : null,
    info: moveDetails(MOVE_WORDS[move][0], MOVE_WORDS[move][1]),
    ariaLabel: `${MOVE_WORDS[move][0]} (bonus action)${turn.bonusUsed ? ', used' : ''}`,
    spent: turn.bonusUsed,
    play: () => bonus.onMove(move),
  }))
  return [
    { key: 'attacks', name: 'Attacks', cards: of((c) => c.cost === 'action' && c.kind === 'attack') },
    { key: 'abilities', name: 'Abilities', cards: of((c) => c.cost === 'action' && c.kind !== 'attack') },
    { key: 'bonus', name: 'Bonus actions', cards: [...moveCards, ...of((c) => c.cost === 'bonus')], bonus: true },
    { key: 'reactions', name: 'Reactions', cards: of((c) => c.cost === 'reaction') },
    { key: 'legendary', name: 'Legendary actions', cards: of((c) => c.cost === 'legendary') },
  ]
}

type MonsterHandProps = {
  name: string
  monster: SrdMonster
  cards: MonsterCard[]
  /** A bonus move from its traits: Disengage or Hide for a goblin. */
  onAct: (what: TurnAction) => void
  /** What its turn has left, to grey out what's spent. */
  turn: MonsterTurnLeft
  onPlay: (card: MonsterCard) => void
  rolling: boolean
  className?: string
}

/** The acting monster's cards along the bottom, the same hand a player has: click one, then its target. */
export function MonsterHand({ name, monster, cards, onAct, turn, onPlay, rolling, className }: MonsterHandProps) {
  const traits = monsterBonusActions(monster)
  const bonus = {
    moves: [...new Set(traits.flatMap((b) => b.moves))] as BonusMove[],
    source: traits.find((b) => b.moves.length > 0)?.name ?? '',
    onMove: (move: BonusMove) => onAct(`bonus_${move}` as TurnAction),
  }
  return (
    <div className={className} role="group" aria-label={`${name}’s cards`}>
      <CardHand
        sets={monsterHandSets(cards, turn, onPlay, bonus)}
        bonusUsed={turn.bonusUsed}
        label={`${name}’s hand`}
        playSpent
        disabled={rolling}
      />
    </div>
  )
}
