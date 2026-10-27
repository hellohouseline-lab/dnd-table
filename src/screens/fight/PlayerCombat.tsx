import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import type { Character } from '../../rules/character.ts'
import { findCondition } from '../../rules/srd/index.ts'
import { canBreakFree, clockWords, CONDITION_WORD, type ConditionClock } from '../../rules/conditionClocks.ts'
import { ABILITY_NAME } from '../../rules/abilities.ts'
import { HEALTH_WORDS } from '../../rules/combat.ts'
import type { RollMode } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { initiativeRoll } from '../../rules/rolls.ts'
import { actionFree, attacksLeft, jumps, movementLeft, type BonusMove, type TurnRecord } from '../../rules/turn.ts'
import type { TurnAction } from '../../live/combat.ts'
import { isOut, STANCE_WORDS, TALK_SKILLS, type TalkSkill } from '../../rules/talk.ts'
import type { FightRow } from './fightRows.ts'
import styles from './PlayerCombat.module.css'

type RibbonProps = {
  rows: FightRow[]
  /** While picking a target: who can be picked, and what happens when one is. */
  picking?: { canPick: (row: FightRow) => boolean; onPick: (row: FightRow) => void } | null
  /** Your own place in the turn order: your conditions show beside your name, and open the Rules panel. */
  yours?: { combatantId: string; onCondition: (index: string) => void } | null
}

/** The initiative ribbon along the top in design 05: everyone in turn order, whoever's acting lit. */
export function InitiativeRibbon({ rows, picking = null, yours = null }: RibbonProps) {
  return (
    <ol className={styles.ribbon} aria-label="Turn order">
      {rows.map((row) => {
        const className = cx(
          styles.pill,
          row.combatant.kind === 'monster' && styles.pillMonster,
          row.status === 'acting' && styles.pillActing,
          isOut(row.combatant) && styles.pillDown,
        )
        const label = (
          <>
            <span className={styles.pillInit}>{row.combatant.initiative ?? '?'}</span> {row.name}
            {row.combatant.stance !== 'fighting' && (
              <span className={styles.pillStance}> · {STANCE_WORDS[row.combatant.stance]}</span>
            )}
            {row.character?.concentration && (
              <span className={styles.pillConc} title={`Concentrating on ${row.character.concentration}`}>
                C
              </span>
            )}
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
            {yours?.combatantId === row.combatant.id &&
              (row.character?.conditions ?? row.combatant.conditions).map((index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.pillCondition}
                  title={`What ${(findCondition(index)?.name ?? index).toLowerCase()} does`}
                  onClick={() => yours.onCondition(index)}
                >
                  {CONDITION_WORD[index] ?? findCondition(index)?.name ?? index}
                  {(() => {
                    const rounds = row.combatant.clocks.find((c) => c.condition === index)?.rounds
                    return rounds ? ` · ${rounds}` : ''
                  })()}
                </button>
              ))}
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
  /** What this character can do as a bonus action instead (a rogue's Cunning Action). */
  bonusMoves?: BonusMove[]
  /** Strength score, for how far you can jump. */
  strength?: number
  onAct: (what: TurnAction) => void
  onEndTurn: () => void
}

/**
 * "This turn" from design 05, kept by the server: your action (and attacks left), bonus action,
 * reaction and movement, Dash, Disengage and Dodge, and End turn. It all comes back at the start of
 * your next turn. Bonus action and reaction are clicked when you use one for a spell or feature.
 */
export function YourTurn({
  turn,
  speed,
  perAction,
  myTurn,
  started,
  canAct = true,
  bonusMoves = [],
  strength,
  onAct,
  onEndTurn,
}: YourTurnProps) {
  const attacks = attacksLeft(turn, perAction)
  const free = actionFree(turn)
  const action =
    turn.attacksMade > 0 && attacks > 0
      ? `${attacks} attack${attacks === 1 ? '' : 's'} left`
      : turn.actionUsed
        ? 'Used'
        : 'Ready'
  const rows: { key: 'bonus' | 'reaction'; label: string; tone: string; used: boolean; can: boolean; hint: string }[] =
    [
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
  // The other things the rules let you do with your action.
  const others: [TurnAction, string, string][] = [
    ['hide', 'Hide', 'Spend your action to hide: roll Stealth against what the enemies can see'],
    ['help', 'Help', 'Spend your action: an ally has advantage on their next check, or on an attack next to you'],
    ['search', 'Search', 'Spend your action looking for something: roll Perception'],
    ['ready', 'Ready', 'Spend your action to choose a trigger and what you will do (it uses your reaction)'],
    ['object', 'Use an object', 'Spend your action on something like drinking a potion or opening a door'],
  ]
  const leap = strength === undefined ? null : jumps(strength)
  const BONUS_WORDS: Record<BonusMove, string> = {
    dash: 'Dash',
    disengage: 'Disengage',
    hide: 'Hide',
    dodge: 'Dodge',
  }
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
      {leap && (
        <p className={styles.jump} title="A jump costs movement. Standing still first, it's half as far.">
          Jump: {leap.long} ft long, {leap.high} ft high ({leap.standingLong} and {leap.standingHigh} from standing)
        </p>
      )}
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
      <div className={styles.moves} role="group" aria-label="More actions">
        {others.map(([what, label, hint]) => (
          <button
            key={what}
            type="button"
            className={cx(styles.move, styles.moveSmall)}
            title={hint}
            disabled={!myTurn || !free || !canAct}
            onClick={() => onAct(what)}
          >
            {label}
          </button>
        ))}
      </div>
      {bonusMoves.length > 0 && (
        <div className={styles.moves} role="group" aria-label="As a bonus action">
          <span className={styles.bonusLabel}>Bonus action:</span>
          {bonusMoves.map((move) => (
            <button
              key={move}
              type="button"
              className={cx(styles.move, styles.moveBonus)}
              title={`${BONUS_WORDS[move]} with your bonus action, keeping your action`}
              disabled={!myTurn || turn.bonusUsed || !canAct}
              onClick={() => onAct(`bonus_${move}` as TurnAction)}
            >
              {BONUS_WORDS[move]}
            </button>
          ))}
        </div>
      )}
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

type YourConditionsProps = {
  /** Your conditions, and how long each lasts. */
  conditions: string[]
  clocks: ConditionClock[]
  myTurn: boolean
  /** Feet of movement left this turn, and your speed. */
  feetLeft: number
  speed: number
  actionFree: boolean
  rolling: boolean
  onSave: (condition: string) => void
  onStandUp: () => void
  onBreakFree: () => void
}

/**
 * What you can do about your conditions (C3a): roll the save you owe at the end of your turn, stand
 * up from prone (half your speed), and break free of a grab or a web (your action).
 */
export function YourConditions({
  conditions,
  clocks,
  myTurn,
  feetLeft,
  speed,
  actionFree,
  rolling,
  onSave,
  onStandUp,
  onBreakFree,
}: YourConditionsProps) {
  const owed = clocks.filter((c) => c.owed && c.save && conditions.includes(c.condition))
  const prone = conditions.includes('prone')
  const held = clocks.some((c) => conditions.includes(c.condition) && canBreakFree(c))
  const half = Math.ceil(speed / 2)
  if (owed.length === 0 && !(myTurn && (prone || held))) return null
  return (
    <section className={styles.thisTurn} aria-label="Your conditions">
      <div className={styles.thisTurnTitle}>Your conditions</div>
      {owed.map((clock) => (
        <div key={clock.condition} className={styles.owed}>
          <p className={styles.owedWords}>
            You&rsquo;re {(CONDITION_WORD[clock.condition] ?? clock.condition).toLowerCase()} (
            {clockWords(clock, { forPlayers: true })}).
          </p>
          <button type="button" className={styles.endTurn} disabled={rolling} onClick={() => onSave(clock.condition)}>
            Roll a {clock.save ? ABILITY_NAME[clock.save.ability] : ''} save to shake off{' '}
            {CONDITION_WORD[clock.condition] ?? clock.condition}
          </button>
        </div>
      ))}
      {myTurn && (prone || held) && (
        <div className={styles.moves} role="group" aria-label="Get free">
          {prone && (
            <button
              type="button"
              className={styles.move}
              disabled={feetLeft < half}
              title={feetLeft < half ? 'Standing up takes half your speed' : `Uses ${half} feet of your movement`}
              onClick={onStandUp}
            >
              Stand up ({half} ft)
            </button>
          )}
          {held && (
            <button
              type="button"
              className={styles.move}
              disabled={!actionFree || rolling}
              title="Your action: Athletics or Acrobatics, whichever is better"
              onClick={onBreakFree}
            >
              Break free
            </button>
          )}
        </div>
      )}
    </section>
  )
}

type YourTalkProps = {
  /** Who is still there to talk to: monsters that are up and haven't given up, by the names you know. */
  listeners: { id: string; name: string }[]
  myTurn: boolean
  actionFree: boolean
  rolling?: boolean
  onTalk: (skill: TalkSkill, targetIds: string[], words: string) => void
}

const EVERYONE = 'everyone'

/**
 * Talk (C3b): Persuade, Intimidate or Deceive with your action. Pick who you're talking to, say it
 * in a line if you like, and the table rolls the skill. The DM decides what comes of it.
 */
export function YourTalk({ listeners, myTurn, actionFree, rolling, onTalk }: YourTalkProps) {
  const [skill, setSkill] = useState<TalkSkill | null>(null)
  const [who, setWho] = useState('')
  const [words, setWords] = useState('')
  if (listeners.length === 0) return null
  const chosen = TALK_SKILLS.find((t) => t.skill === skill)
  const to = who || (listeners.length > 1 ? EVERYONE : listeners[0].id)

  function talk() {
    if (!skill) return
    onTalk(skill, to === EVERYONE ? listeners.map((l) => l.id) : [to], words)
    setSkill(null)
    setWho('')
    setWords('')
  }

  return (
    <section className={styles.thisTurn} aria-label="Talk">
      <div className={styles.thisTurnTitle}>Talk</div>
      <div className={styles.moves} role="group" aria-label="Talk instead of fighting">
        {TALK_SKILLS.map((t) => (
          <button
            key={t.skill}
            type="button"
            className={cx(styles.move, styles.moveSmall, skill === t.skill && styles.moveChosen)}
            title={`${t.hint}. Uses your action.`}
            aria-pressed={skill === t.skill}
            disabled={!myTurn || !actionFree || rolling}
            onClick={() => setSkill(skill === t.skill ? null : t.skill)}
          >
            {t.verb}
          </button>
        ))}
      </div>
      {chosen && myTurn && actionFree && (
        <div className={styles.talkForm}>
          <label className={styles.talkField}>
            <span>Who to</span>
            <select value={to} onChange={(event) => setWho(event.target.value)}>
              {listeners.length > 1 && <option value={EVERYONE}>Everyone on their side</option>}
              {listeners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.talkField}>
            <span>Say</span>
            <input
              type="text"
              maxLength={200}
              placeholder="Optional: say it in a line"
              value={words}
              onChange={(event) => setWords(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') talk()
              }}
            />
          </label>
          <button type="button" className={styles.endTurn} disabled={rolling} onClick={talk}>
            {chosen.verb}: roll {chosen.word}
          </button>
        </div>
      )}
    </section>
  )
}
