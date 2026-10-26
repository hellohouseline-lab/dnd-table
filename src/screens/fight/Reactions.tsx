import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { Pips } from '../../components/Pips.tsx'
import type { DeathSaves as DeathSaveCount } from '../../rules/dying.ts'
import type { Strike } from './strikes.ts'
import styles from './Reactions.module.css'

type StrikePromptProps = {
  /** Who is moving away: "Goblin A". */
  provoker: string
  strikes: Strike[]
  onStrike: (strike: Strike) => void
  onLetGo: () => void
  rolling?: boolean
}

/**
 * A player's chance to strike: someone moved out of their reach without Disengaging. One melee
 * attack with the reaction, or let it go. The move has already happened; this doesn't hold it up.
 */
export function StrikePrompt({ provoker, strikes, onStrike, onLetGo, rolling }: StrikePromptProps) {
  return (
    <div className={styles.prompt} role="dialog" aria-labelledby="strike-title">
      <span className={styles.seal} aria-hidden="true">
        <Icon name="sword" size={28} />
      </span>
      <div className={styles.eyebrow}>Opportunity attack</div>
      <h2 id="strike-title" className={styles.title}>
        {provoker} is getting away
      </h2>
      <p className={styles.plain}>
        It moved out of your reach without disengaging. You can use your reaction to make one melee attack before it
        goes.
      </p>
      {strikes.length === 0 && <p className={styles.plain}>You have no melee attack on your sheet to make.</p>}
      <div className={styles.buttons}>
        {strikes.map((strike) => (
          <button
            key={strike.label}
            type="button"
            className={styles.strike}
            disabled={rolling}
            onClick={() => onStrike(strike)}
          >
            <Icon name="d20" size={20} />
            Attack with {strike.label}
          </button>
        ))}
        <button type="button" className={styles.letGo} disabled={rolling} onClick={onLetGo}>
          Let it go
        </button>
      </div>
    </div>
  )
}

type ConcentrationPromptProps = {
  spell: string
  dc: number
  onRoll: () => void
  /** Let the spell end without rolling. */
  onLetGo: () => void
  rolling?: boolean
}

/** You took damage while concentrating: a Constitution save to keep the spell going. */
export function ConcentrationPrompt({ spell, dc, onRoll, onLetGo, rolling }: ConcentrationPromptProps) {
  return (
    <div className={styles.prompt} role="dialog" aria-labelledby="concentration-title">
      <span className={styles.seal} aria-hidden="true">
        <Icon name="star" size={28} />
      </span>
      <div className={styles.eyebrow}>Concentration</div>
      <h2 id="concentration-title" className={styles.title}>
        Hold on to {spell}
      </h2>
      <p className={styles.plain}>
        You took damage. Roll a Constitution save, DC {dc}, to keep the spell going. If you fail, it ends.
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.strike} disabled={rolling} onClick={onRoll}>
          <Icon name="d20" size={20} />
          Roll the save
        </button>
        <button type="button" className={styles.letGo} disabled={rolling} onClick={onLetGo}>
          Let the spell end
        </button>
      </div>
    </div>
  )
}

export type OpenChance = {
  id: string
  /** Who may strike, and who is moving away. */
  reactor: string
  provoker: string
  /** For a character's chance: the player deciding it. */
  player: string | null
  strikes: Strike[]
}

type ChanceStripProps = {
  chances: OpenChance[]
  onStrike: (id: string, strike: Strike) => void
  onLetGo: (id: string) => void
  rolling?: boolean
  className?: string
}

/**
 * The DM's chances to strike, along the top of the map: a monster's to take or let go, and the
 * players' (which they decide on their own screen, or the DM can for them).
 */
export function ChanceStrip({ chances, onStrike, onLetGo, rolling, className }: ChanceStripProps) {
  if (chances.length === 0) return null
  return (
    <ul className={cx(styles.strip, className)} aria-label="Opportunity attacks">
      {chances.map((chance) => (
        <li key={chance.id} className={cx(styles.chance, chance.player && styles.chancePlayer)}>
          <span className={styles.chanceWords}>
            <strong>{chance.reactor}</strong> can strike <strong>{chance.provoker}</strong> as they move away
            {chance.player && <span className={styles.deciding}> · {chance.player} is deciding</span>}
          </span>
          {chance.strikes.map((strike) => (
            <button
              key={strike.label}
              type="button"
              className={styles.chanceButton}
              disabled={rolling}
              title={chance.player ? `Attack for ${chance.player}` : 'Attack with its reaction'}
              onClick={() => onStrike(chance.id, strike)}
            >
              {strike.label}
            </button>
          ))}
          <button type="button" className={styles.chanceQuiet} onClick={() => onLetGo(chance.id)}>
            Let it go
          </button>
        </li>
      ))}
    </ul>
  )
}

type DeathSavesProps = {
  saves: DeathSaveCount
  /** Rolls the next save; leave out when it isn't their turn. */
  onRoll?: () => void
  /** The DM's quick fixes. */
  onStabilise?: () => void
  onWake?: () => void
  /** Words for a player ("you") or the DM (their name). */
  who?: string
  rolling?: boolean
}

/** A character at 0 hit points: three successes and three failures, and the next roll. */
export function DeathSaves({ saves, onRoll, onStabilise, onWake, who, rolling }: DeathSavesProps) {
  const you = !who
  const state = saves.dead
    ? you
      ? 'Your character has died. Talk to your DM about what happens next.'
      : `${who} has died. Undo, or bring them back, if that isn't how it should end.`
    : saves.stable
      ? you
        ? 'Stable: unconscious, but no longer dying. Healing brings you back.'
        : `${who} is stable: unconscious, but no longer dying.`
      : you
        ? 'At 0 hit points. On your turn, roll a death save: 10 or more is a success. Three successes and you are stable; three failures and your character dies. A 20 brings you back with 1 hit point.'
        : `${who} is dying. They roll a death save on each of their turns: 10 or more succeeds, a 20 brings them back with 1 hit point.`
  return (
    <section className={cx(styles.dying, saves.dead && styles.dead)} aria-label="Death saves">
      <div className={styles.dyingTitle}>{saves.dead ? 'Dead' : saves.stable ? 'Stable' : 'Dying'}</div>
      <div className={styles.counts}>
        <span className={styles.countLabel}>Successes</span>
        <Pips label="Death save successes" tone="pass" total={3} filled={saves.successes} />
        <span className={styles.countLabel}>Failures</span>
        <Pips label="Death save failures" tone="fail" total={3} filled={saves.failures} />
      </div>
      <p className={styles.dyingText}>{state}</p>
      {(onRoll || onStabilise || onWake) && (
        <div className={styles.dyingButtons}>
          {onRoll && !saves.stable && !saves.dead && (
            <button type="button" className={styles.saveRoll} disabled={rolling} onClick={onRoll}>
              <Icon name="d20" size={18} />
              {you ? 'Roll a death save' : 'Roll their death save'}
            </button>
          )}
          {onStabilise && !saves.stable && !saves.dead && (
            <button
              type="button"
              className={styles.dyingQuiet}
              onClick={onStabilise}
              title="Medicine check or a healer's kit"
            >
              Stabilise
            </button>
          )}
          {onWake && (
            <button type="button" className={styles.dyingQuiet} onClick={onWake}>
              Up with 1 HP
            </button>
          )}
        </div>
      )}
    </section>
  )
}
