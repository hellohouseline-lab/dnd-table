import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { ABILITIES, ABILITY_NAME, type Ability } from '../../rules/abilities.ts'
import {
  applyLevelUp,
  hpGain,
  levelUpMissing,
  levelUpSpells,
  NO_PICKS,
  prepareChoices,
  subclassIndex,
  swapChoices,
  type LevelUpPicks,
} from '../../rules/build/applyLevelUp.ts'
import { togglePick } from '../../rules/build/draft.ts'
import { levelPlan, subclassLevel } from '../../rules/build/levelUp.ts'
import { modifierText } from '../../rules/build/steps.ts'
import type { Character, CharacterBuild } from '../../rules/character.ts'
import type { SrdClass, SrdFeature, SrdSpell } from '../../rules/srd/index.ts'
import { SpellPick } from '../manage/SpellCard.tsx'
import styles from './Builder.module.css'
import { skillName } from './classWords.ts'

type LevelUpViewProps = {
  character: Character
  cls: SrdClass
  features: Record<string, SrdFeature>
  spells: SrdSpell[]
  /** Rolls the hit die on the server, for everyone to see. */
  onRollHp: () => Promise<number | null>
  /** Saves the new sheet and the hit points gained; resolves with a problem, or null. */
  onSave: (build: CharacterBuild, gain: number) => Promise<string | null>
  exitHref: string
}

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

/**
 * Levelling up, one card at a time (docs/C2_PLAN.md): what's new, hit points (the average or a
 * roll), the subclass when it's due, an ability score increase, every choice the level brings
 * (with what isn't allowed yet greyed out and why), new spells, then Take the level.
 */
export function LevelUpView({ character, cls, features, spells, onRollHp, onSave, exitHref }: LevelUpViewProps) {
  const [picks, setPicks] = useState<LevelUpPicks>(NO_PICKS)
  const [rolling, setRolling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const level = character.level + 1

  // What they have, for prerequisites: features by SRD index, and spells known (with new picks).
  const names = new Set(character.features.map((f) => f.name.replace(/^[^:]+:\s*/, '').toLowerCase()))
  const have = {
    features: Object.keys(features).filter((k) => names.has(features[k].name.replace(/^[^:]+:\s*/, '').toLowerCase())),
    spells: [...character.spellcasting.spells.flatMap((s) => (s.index ? [s.index] : [])), ...picks.cantrips],
  }
  const plan = levelPlan(cls, level, subclassIndex(cls, character, picks.subclass), have, features)
  const missing = levelUpMissing(plan, picks)
  // The path card stays up once one is picked, so it can be changed.
  const choosingPath = level === subclassLevel(cls) && !subclassIndex(cls, character, null)
  const options = levelUpSpells(cls, character, level, spells)
  const swap = swapChoices(cls, character, level, spells, picks)
  const more = prepareChoices(cls, character, level, spells, picks)
  // Prepared picks still on offer (a wizard may have unpicked a book spell), within the room.
  const prepared = more ? picks.prepare.filter((i) => more.options.some((s) => s.index === i)).slice(0, more.room) : []
  const gain = hpGain(character, cls, picks)
  const points = Object.values(picks.increase).reduce((n, v) => n + (v ?? 0), 0)

  function raise(ability: Ability, by: 1 | -1) {
    const now = picks.increase[ability] ?? 0
    const next = now + by
    if (next < 0 || next > 2 || points + by > 2 || character.scores[ability] + next > 20) return
    setPicks({ ...picks, increase: { ...picks.increase, [ability]: next } })
  }

  async function save() {
    setSaving(true)
    setProblem(null)
    const result = await onSave(
      applyLevelUp(character, cls, plan, { ...picks, prepare: prepared }, { features, spells }),
      gain,
    )
    setSaving(false)
    setProblem(result)
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{character.name}</div>
          <h1 className={styles.title}>Level up to {level}</h1>
        </div>
        <span className={styles.spacer} />
        <a className={styles.headerButton} href={exitHref}>
          Back to the table
        </a>
      </header>

      <div className={styles.levelBody}>
        <section className={styles.centre} aria-label="Level up">
          <div className={styles.detail}>
            <h2 className={styles.stepTitle}>What&rsquo;s new at level {level}</h2>
            {plan.profUp && (
              <p className={styles.plays}>
                <strong>Training bonus +{plan.profBonus}:</strong> every skill, save and attack you&rsquo;re trained in
                gets 1 better.
              </p>
            )}
            {plan.numbers.length > 0 && (
              <div className={styles.optionRow}>
                {plan.numbers.map((n) => (
                  <span key={n.key} className={cx(styles.chip, styles.fixed)}>
                    {n.label}: {n.before ? `${n.before} → ` : ''}
                    {n.after}
                  </span>
                ))}
              </div>
            )}
            <ul className={styles.traitList}>
              {plan.features
                .filter((f) => !plan.choices.some((c) => c.feature === f.index))
                .map((f) => (
                  <li key={f.index}>
                    <details>
                      <summary>
                        <span className={styles.traitName}>{f.name}</span>
                        <span className={styles.traitLine}>{first(f.desc)}</span>
                      </summary>
                      <p>{f.desc}</p>
                    </details>
                  </li>
                ))}
              {plan.features.length === 0 && <li>Nothing else new at this level: just more hit points.</li>}
            </ul>
          </div>

          <div className={styles.detail}>
            <h3 className={styles.choiceTitle}>Hit points</h3>
            <div className={styles.optionRow}>
              <button
                type="button"
                className={cx(styles.option, picks.rolled === null && styles.picked)}
                aria-pressed={picks.rolled === null}
                onClick={() => setPicks({ ...picks, rolled: null })}
              >
                <span className={styles.optionName}>Take the average</span>
                <span className={styles.optionLine}>{cls.hitDie / 2 + 1} plus your Constitution modifier</span>
              </button>
              <button
                type="button"
                className={cx(styles.option, picks.rolled !== null && styles.picked)}
                aria-pressed={picks.rolled !== null}
                disabled={rolling || picks.rolled !== null}
                onClick={() => {
                  setRolling(true)
                  void onRollHp().then((rolled) => {
                    setRolling(false)
                    if (rolled !== null) setPicks({ ...picks, rolled })
                  })
                }}
              >
                <span className={styles.optionName}>
                  {picks.rolled !== null ? `Rolled ${picks.rolled}` : rolling ? 'Rolling…' : `Roll a d${cls.hitDie}`}
                </span>
                <span className={styles.optionLine}>Once, for the table to see. Riskier, maybe more.</span>
              </button>
            </div>
            <p className={styles.plays}>
              <strong>+{gain} hit points</strong>: {character.maxHp} → {character.maxHp + gain}
            </p>
          </div>

          {choosingPath && (
            <div className={styles.detail}>
              <h3 className={styles.choiceTitle}>Pick your path</h3>
              <div className={styles.ancestryGrid}>
                {cls.subclasses.map((s) => (
                  <button
                    key={s.index}
                    type="button"
                    className={cx(styles.option, picks.subclass === s.index && styles.picked)}
                    aria-pressed={picks.subclass === s.index}
                    onClick={() => setPicks({ ...picks, subclass: s.index })}
                  >
                    <span className={styles.optionName}>{s.name}</span>
                  </button>
                ))}
              </div>
              <p className={styles.note}>
                The free rules have one path for each class; others from books can be typed in on your sheet.
              </p>
            </div>
          )}

          {plan.abilityIncrease && (
            <div className={styles.detail}>
              <h3 className={styles.choiceTitle}>Ability score increase: +2 to one, or +1 to two ({points} of 2)</h3>
              <table className={styles.scoreTable}>
                <tbody>
                  {ABILITIES.map((a) => {
                    const add = picks.increase[a] ?? 0
                    return (
                      <tr key={a}>
                        <th scope="row">
                          <span className={styles.abilityName}>{ABILITY_NAME[a]}</span>
                        </th>
                        <td>
                          <span className={styles.stepper}>
                            <button
                              type="button"
                              aria-label={`Less ${ABILITY_NAME[a]}`}
                              disabled={add === 0}
                              onClick={() => raise(a, -1)}
                            >
                              −
                            </button>
                            <span className={styles.stepperValue}>+{add}</span>
                            <button
                              type="button"
                              aria-label={`More ${ABILITY_NAME[a]}`}
                              disabled={points >= 2 || add >= 2 || character.scores[a] + add >= 20}
                              onClick={() => raise(a, 1)}
                            >
                              +
                            </button>
                          </span>
                        </td>
                        <td className={styles.totalCell}>
                          {character.scores[a]} → {character.scores[a] + add}
                        </td>
                        <td className={styles.modCell}>{modifierText(character.scores[a] + add)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {plan.choices.map((choice) => {
            const picked = picks.choices[choice.feature] ?? []
            return (
              <div key={choice.feature} className={styles.detail}>
                <h3 className={styles.choiceTitle}>
                  {choice.name}: pick {choice.choose === 1 ? 'one' : choice.choose} ({picked.length} of {choice.choose})
                </h3>
                <div className={choice.kind === 'feature' ? styles.ancestryGrid : styles.optionRow}>
                  {choice.options.map((option) => {
                    const on = picked.includes(option.index)
                    const pick = () =>
                      setPicks({
                        ...picks,
                        choices: {
                          ...picks.choices,
                          [choice.feature]: togglePick(picked, option.index, choice.choose),
                        },
                      })
                    return choice.kind === 'feature' ? (
                      <button
                        key={option.index}
                        type="button"
                        className={cx(styles.option, on && styles.picked)}
                        aria-pressed={on}
                        disabled={!option.allowed}
                        title={option.desc}
                        onClick={pick}
                      >
                        <span className={styles.optionName}>{option.name}</span>
                        <span className={styles.optionLine}>
                          {option.why ? `Not yet: ${option.why}` : first(option.desc)}
                        </span>
                      </button>
                    ) : (
                      <button
                        key={option.index}
                        type="button"
                        className={cx(styles.chip, on && styles.picked)}
                        aria-pressed={on}
                        disabled={!option.allowed}
                        onClick={pick}
                      >
                        {choice.kind === 'skill' ? skillName(option.index) : option.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {(plan.cantrips > 0 || plan.spells > 0 || swap || more) && (
            <div className={styles.detail}>
              {plan.newSpellLevel && (
                <p className={styles.plays}>
                  <strong>New:</strong> level {plan.newSpellLevel} spell slots, so level {plan.newSpellLevel} spells are
                  open to you.
                </p>
              )}
              {plan.cantrips > 0 && (
                <SpellPick
                  title={`New cantrips: pick ${plan.cantrips}`}
                  spells={options.cantrips}
                  picked={picks.cantrips}
                  choose={plan.cantrips}
                  onChange={(cantrips) => setPicks({ ...picks, cantrips })}
                />
              )}
              {plan.spells > 0 && (
                <SpellPick
                  title={`${cls.index === 'wizard' ? 'For your spellbook' : 'New spells'}: pick ${plan.spells}`}
                  spells={options.spells.filter((s) => s.index !== picks.swapIn)}
                  picked={picks.spells}
                  choose={plan.spells}
                  startLevel={plan.newSpellLevel}
                  note={
                    cls.index === 'wizard'
                      ? 'Wizards add two spells to their book each level, free. Prepare them below.'
                      : undefined
                  }
                  onChange={(spells) => setPicks({ ...picks, spells })}
                />
              )}
              {swap && (
                <div className={styles.choice}>
                  <h3 className={styles.choiceTitle}>Swap a spell (if you like)</h3>
                  <p className={styles.note}>
                    Each level you can forget one spell you know and learn another in its place.
                  </p>
                  <div className={styles.optionRow} role="group" aria-label="Spell to forget">
                    {swap.out.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={cx(styles.chip, picks.swapOut === s.index && styles.picked)}
                        aria-pressed={picks.swapOut === s.index}
                        onClick={() =>
                          setPicks({
                            ...picks,
                            swapOut: picks.swapOut === s.index ? null : s.index,
                            swapIn: picks.swapOut === s.index ? null : picks.swapIn,
                          })
                        }
                      >
                        Forget {s.name}
                      </button>
                    ))}
                  </div>
                  {picks.swapOut && (
                    <SpellPick
                      title="Learn in its place"
                      spells={swap.in}
                      picked={picks.swapIn ? [picks.swapIn] : []}
                      choose={1}
                      startLevel={plan.newSpellLevel}
                      onChange={(chosen) => setPicks({ ...picks, swapIn: chosen[0] ?? null })}
                    />
                  )}
                </div>
              )}
              {more && (
                <SpellPick
                  title={`Prepare more today: up to ${more.room}`}
                  spells={more.options}
                  picked={prepared}
                  choose={more.room}
                  startLevel={plan.newSpellLevel}
                  note={`Your new level lets you prepare ${more.room} more. You can change what's prepared after any long rest.`}
                  onChange={(prepare) => setPicks({ ...picks, prepare })}
                />
              )}
            </div>
          )}

          <div className={styles.saveRow}>
            <button
              type="button"
              className={styles.next}
              disabled={missing.length > 0 || saving}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : `Take level ${level}`}
            </button>
            <span className={styles.footerNote}>
              {missing.length > 0 ? `Still to pick: ${missing.join('; ')}.` : 'All set.'}
            </span>
          </div>
          {problem && <p className={styles.warn}>{problem}</p>}
        </section>
      </div>
    </main>
  )
}
