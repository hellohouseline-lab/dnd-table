import { Icon } from '../../components/Icon.tsx'
import { PRESETS, type Preset } from '../../rules/build/quickStart.ts'
import type { SrdRaces } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'
import { CLASS_WORDS } from './classWords.ts'

type QuickStartProps = {
  races: SrdRaces
  onPreset: (preset: Preset) => void
  onSurprise: () => void
  onOwn: () => void
}

/**
 * The builder's first screen: three ways in. A ready-made character (one for each class, every
 * choice made), Surprise me (random but sensible), or Build my own, step by step. Ready-made and
 * random characters can still be changed in any step before saving.
 */
export function QuickStart({ races, onPreset, onSurprise, onOwn }: QuickStartProps) {
  const raceName = (preset: Preset) => {
    const race = races.races.find((r) => r.index === preset.race)
    return race?.subraces.find((s) => s.index === preset.subrace)?.name ?? race?.name ?? ''
  }
  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>How would you like to start?</h2>
        <p className={styles.stepLead}>
          Pick a ready-made character and you can play in a minute. Or let the dice surprise you, or build your own step
          by step. You can change anything before you save.
        </p>
      </div>

      <div className={styles.startRow}>
        <button type="button" className={styles.next} onClick={onSurprise}>
          Surprise me
        </button>
        <button type="button" className={styles.back} onClick={onOwn}>
          Build my own
        </button>
      </div>

      <h3 className={styles.choiceTitle}>Ready-made characters</h3>
      <ul className={styles.raceGrid}>
        {PRESETS.map((preset) => {
          const words = CLASS_WORDS[preset.className]
          return (
            <li key={preset.key}>
              <button type="button" className={styles.raceCard} onClick={() => onPreset(preset)}>
                <span className={styles.crest} aria-hidden="true">
                  {words && <Icon name={words.icon} size={24} />}
                </span>
                <span className={styles.raceName}>{preset.name}</span>
                <span className={styles.presetWho}>
                  {raceName(preset)} {preset.className.replace(/^./, (c) => c.toUpperCase())}
                </span>
                <span className={styles.raceLine}>{words?.plays}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
