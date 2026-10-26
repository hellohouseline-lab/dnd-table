import { ABILITIES, ABILITY_NAME, ABILITY_SHORT } from '../../rules/abilities.ts'
import { coinText } from '../../rules/build/gear.ts'
import { modifierText } from '../../rules/build/steps.ts'
import type { CharacterBuild } from '../../rules/character.ts'
import styles from './Builder.module.css'
import { skillName } from './classWords.ts'

type ReviewStepProps = {
  build: CharacterBuild | null
  /** Everything still to pick, step by step. */
  missing: { step: string; stepIndex: number; items: string[] }[]
  onGoTo: (step: number) => void
  /** Why it can't be saved here (a DM, or someone who has a character already), or null. */
  cantSave: string | null
  onSave: () => void
  saving: boolean
  saveError: string | null
}

/**
 * Step 9: the whole character, and Save. Anything still to pick is listed with a link to its step;
 * once there's nothing left, Save puts the character at the table, ready to play.
 */
export function ReviewStep({ build, missing, onGoTo, cantSave, onSave, saving, saveError }: ReviewStepProps) {
  const left = missing.filter((m) => m.items.length > 0)
  const wallet = build?.wallet
  const coins = wallet ? wallet.cp + wallet.sp * 10 + wallet.ep * 50 + wallet.gp * 100 + wallet.pp * 1000 : 0

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>{build?.name ? `Meet ${build.name}` : 'Your character'}</h2>
        <p className={styles.stepLead}>
          Check it over. Anything can be changed on your sheet later, and your DM can help.
        </p>
      </div>

      {left.length > 0 && (
        <div className={styles.detail}>
          <h3 className={styles.choiceTitle}>Still to pick</h3>
          <ul className={styles.missingList}>
            {left.map((m) => (
              <li key={m.step}>
                <button type="button" className={styles.missingLink} onClick={() => onGoTo(m.stepIndex)}>
                  {m.step}
                </button>
                : {m.items.join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {build && (
        <div className={styles.detail}>
          <p className={styles.plays}>
            <strong>
              Level 1 {build.subrace || build.race} {build.className}
              {build.subclass ? ` (${build.subclass})` : ''}
            </strong>
            {build.background
              ? `, once ${/^[aeiou]/i.test(build.background) ? 'an' : 'a'} ${build.background.toLowerCase()}`
              : ''}
            {build.story.alignment ? `. ${build.story.alignment}.` : '.'}
          </p>
          <div className={styles.reviewScores}>
            {ABILITIES.map((a) => (
              <div key={a} className={styles.scoreBox} title={ABILITY_NAME[a]}>
                <span className={styles.scoreShort}>{ABILITY_SHORT[a]}</span>
                <span className={styles.scoreValue}>{build.scores[a]}</span>
                <span className={styles.scoreBonus}>{modifierText(build.scores[a])}</span>
              </div>
            ))}
          </div>
          <div className={styles.gearFacts}>
            <div>
              <span className={styles.summaryLabel}>Hit points</span>
              <span className={styles.bigFact}>{build.maxHp}</span>
            </div>
            <div>
              <span className={styles.summaryLabel}>Armour class</span>
              <span className={styles.bigFact}>{build.armourClass}</span>
            </div>
            <div>
              <span className={styles.summaryLabel}>Speed</span>
              <span className={styles.bigFact}>{build.speed} ft</span>
            </div>
            <div>
              <span className={styles.summaryLabel}>Coins</span>
              <span className={styles.bigFact}>{coinText(coins)}</span>
            </div>
          </div>
          <ul className={styles.traitList}>
            <li>
              <span className={styles.traitName}>Skills</span>
              <span className={styles.traitLine}>
                {build.skillProficiencies
                  .map((s) => `${skillName(s)}${build.skillExpertise.includes(s) ? ' (expertise)' : ''}`)
                  .sort()
                  .join(', ')}
              </span>
            </li>
            <li>
              <span className={styles.traitName}>Saving throws</span>
              <span className={styles.traitLine}>{build.saveProficiencies.map((a) => ABILITY_NAME[a]).join(', ')}</span>
            </li>
            <li>
              <span className={styles.traitName}>Languages</span>
              <span className={styles.traitLine}>{build.languages}</span>
            </li>
            {build.attacks.length > 0 && (
              <li>
                <span className={styles.traitName}>In your hand</span>
                <span className={styles.traitLine}>{build.attacks.map((a) => a.name).join(', ')}</span>
              </li>
            )}
            {build.spellcasting.spells.length > 0 && (
              <li>
                <span className={styles.traitName}>Spells</span>
                <span className={styles.traitLine}>
                  {build.spellcasting.spells
                    .map((s) => `${s.name}${s.prepared || s.level === 0 ? '' : ' (in your book)'}`)
                    .join(', ')}
                </span>
              </li>
            )}
            <li>
              <span className={styles.traitName}>Features</span>
              <span className={styles.traitLine}>
                {build.features
                  .map((f) => (f.usesMax ? `${f.name} (${f.usesMax} use${f.usesMax === 1 ? '' : 's'})` : f.name))
                  .join(', ')}
              </span>
            </li>
            <li>
              <span className={styles.traitName}>Carrying</span>
              <span className={styles.traitLine}>
                {build.inventory.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name)).join(', ')}
              </span>
            </li>
          </ul>
        </div>
      )}

      <div className={styles.saveRow}>
        <button
          type="button"
          className={styles.next}
          disabled={!build || left.length > 0 || cantSave !== null || saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Save and go to the table'}
        </button>
        <span className={styles.footerNote}>
          {cantSave ?? (left.length > 0 ? 'Pick what’s left, then save.' : 'Ready when you are.')}
        </span>
      </div>
      {saveError && <p className={styles.warn}>{saveError}</p>}
    </div>
  )
}
