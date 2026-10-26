import { useEffect, useState } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import {
  DICE_COLOURS,
  DICE_MATERIALS,
  describeDiceStyle,
  NUMBER_COLOURS,
  type DiceStyle,
  type Swatch,
} from '../../dice/style.ts'
import { DIE_SIDES, MAX_OF_ONE_DIE, type DiceGroup, type DieSides, type RollMode } from '../../rules/dice.ts'
import styles from './DiceControls.module.css'

type DiceControlsProps = {
  style: DiceStyle
  onStyleChange: (style: DiceStyle) => void
  /** Advantage or disadvantage for the next d20 roll, from here, a card or the sheet. */
  mode: RollMode
  onModeChange: (mode: RollMode) => void
  secret: boolean
  onSecretChange: (secret: boolean) => void
  onRoll: (dice: DiceGroup[]) => void
  /** Throws one of each die in your look, on your screen only. */
  onPractise: () => void
  rolling?: boolean
  isDm?: boolean
  /** Opens the picker straight away (the design previews). */
  startOpen?: boolean
  className?: string
}

const MODES: { mode: RollMode; label: string }[] = [
  { mode: 'normal', label: 'Normal' },
  { mode: 'advantage', label: 'Advantage' },
  { mode: 'disadvantage', label: 'Disadvantage' },
]

/** The dice medallion from design 02, with its picker for free rolls and a chooser for how the dice look. */
export function DiceControls(props: DiceControlsProps) {
  const { style, mode, secret, isDm, startOpen = false, className } = props
  const [open, setOpen] = useState(startOpen)
  const [view, setView] = useState<'roll' | 'look'>('roll')

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const status = [
    mode !== 'normal' && `next d20 with ${mode}`,
    secret && (isDm ? 'rolling in secret' : 'secret rolls on'),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={className}>
      {open && (
        <div role="dialog" aria-label={view === 'roll' ? 'Roll dice' : 'How your dice look'} className={styles.picker}>
          {view === 'roll' ? (
            <RollView {...props} onLook={() => setView('look')} />
          ) : (
            <LookView {...props} onDone={() => setView('roll')} />
          )}
        </div>
      )}
      <div className={styles.dock}>
        <button
          type="button"
          className={cx(styles.medallion, open && styles.medallionOpen)}
          aria-label={open ? 'Close the dice' : 'Roll dice'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name="d20" size={40} />
        </button>
        <div>
          <div className={styles.dockTitle}>Your dice</div>
          <div className={styles.dockStyle}>{describeDiceStyle(style)}</div>
          {status && <div className={styles.dockStatus}>{status[0].toUpperCase() + status.slice(1)}</div>}
        </div>
      </div>
    </div>
  )
}

function RollView({
  mode,
  onModeChange,
  secret,
  onSecretChange,
  onRoll,
  rolling,
  isDm,
  onLook,
}: DiceControlsProps & { onLook: () => void }) {
  const [die, setDie] = useState<DieSides>(20)
  const [count, setCount] = useState(1)
  const single = die === 20 && count === 1

  return (
    <>
      <div className={styles.head}>
        <span className={styles.title}>Roll dice</span>
        <span className={styles.hint}>Pick a die, then how many</span>
      </div>
      <div className={styles.dieGrid}>
        {DIE_SIDES.map((sides) => (
          <button
            key={sides}
            type="button"
            aria-pressed={sides === die}
            className={cx(styles.die, sides === die && styles.dieOn)}
            onClick={() => setDie(sides)}
          >
            d{sides}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>How many</span>
        <div className={styles.counter}>
          <button
            type="button"
            className={styles.step}
            aria-label="One fewer die"
            disabled={count <= 1}
            onClick={() => setCount(count - 1)}
          >
            −
          </button>
          <span className={styles.count}>{count}</span>
          <button
            type="button"
            className={styles.step}
            aria-label="One more die"
            disabled={count >= MAX_OF_ONE_DIE}
            onClick={() => setCount(count + 1)}
          >
            +
          </button>
        </div>
      </div>
      <div className={styles.modes} role="radiogroup" aria-label="Your next d20 roll">
        {MODES.map((option) => (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={mode === option.mode}
            className={cx(styles.mode, mode === option.mode && styles.modeOn)}
            onClick={() => onModeChange(option.mode)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className={styles.secret}>
        <input type="checkbox" checked={secret} onChange={(event) => onSecretChange(event.target.checked)} />
        {isDm ? 'Roll behind the screen: only you see it' : 'Secret: only you and the DM see it'}
      </label>
      <button
        type="button"
        className={buttonClassName('primary', { className: styles.rollButton })}
        disabled={rolling}
        onClick={() => onRoll([{ sides: die, count }])}
      >
        Roll {count}d{die}
        {single && mode !== 'normal' ? ` with ${mode}` : ''}
      </button>
      <p className={styles.note}>
        Rolling from a card or your sheet adds your bonuses for you. Advantage and disadvantage apply to your next d20
        roll.
      </p>
      <button type="button" className={styles.link} onClick={onLook}>
        Change how your dice look
      </button>
    </>
  )
}

function LookView({ style, onStyleChange, onPractise, rolling, onDone }: DiceControlsProps & { onDone: () => void }) {
  const change = (patch: Partial<DiceStyle>) => onStyleChange({ ...style, ...patch })
  return (
    <>
      <div className={styles.head}>
        <span className={styles.title}>Your dice</span>
        <span className={styles.hint}>{describeDiceStyle(style)}</span>
      </div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Material</legend>
        <div className={styles.materials}>
          {DICE_MATERIALS.map((material) => (
            <button
              key={material.key}
              type="button"
              aria-pressed={style.material === material.key}
              className={cx(styles.material, style.material === material.key && styles.dieOn)}
              onClick={() => change({ material: material.key })}
            >
              <span>{material.name}</span>
              <span className={styles.materialNote}>{material.note}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Swatches legend="Colour" list={DICE_COLOURS} chosen={style.colour} onPick={(colour) => change({ colour })} />
      <Swatches
        legend="Numbers"
        list={NUMBER_COLOURS}
        chosen={style.numbers}
        onPick={(numbers) => change({ numbers })}
      />
      <p className={styles.note}>Everyone at the table, and the stream later, sees your rolls in these dice.</p>
      <div className={styles.lookButtons}>
        <button
          type="button"
          className={buttonClassName('outline', { size: 'small' })}
          disabled={rolling}
          onClick={onPractise}
        >
          Practice throw
        </button>
        <button type="button" className={buttonClassName('primary', { size: 'small' })} onClick={onDone}>
          Done
        </button>
      </div>
    </>
  )
}

function Swatches({
  legend,
  list,
  chosen,
  onPick,
}: {
  legend: string
  list: Swatch[]
  chosen: string
  onPick: (key: string) => void
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.swatches}>
        {list.map((swatch) => (
          <button
            key={swatch.key}
            type="button"
            aria-pressed={swatch.key === chosen}
            aria-label={swatch.name}
            title={swatch.name[0].toUpperCase() + swatch.name.slice(1)}
            className={cx(styles.swatch, swatch.key === chosen && styles.swatchOn)}
            style={{ background: swatch.hex }}
            onClick={() => onPick(swatch.key)}
          />
        ))}
      </div>
    </fieldset>
  )
}
