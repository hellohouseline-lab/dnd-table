import { useId } from 'react'
import { TextField } from '../../components/Field.tsx'
import { Panel } from '../../components/Panel.tsx'
import { ABILITIES, ABILITY_NAME, ABILITY_SHORT } from '../../rules/abilities.ts'
import type { CharacterBuild } from '../../rules/character.ts'
import { saveBonus, skillBonus } from '../../rules/maths/checks.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { skillRank } from '../../rules/sheet.ts'
import { byName, SKILLS } from '../../rules/srd/index.ts'
import styles from './form.module.css'
import type { SrdBundle } from './srdBundle.ts'

type SectionProps = { build: CharacterBuild; onChange: (build: CharacterBuild) => void; srd: SrdBundle }

function toggle<T extends string>(list: T[], item: T, on: boolean): T[] {
  return on ? [...new Set([...list, item])] : list.filter((i) => i !== item)
}

/** Saving throws, skills (with expertise), other proficiencies and languages. */
export function ProficienciesSection({ build, onChange, srd }: SectionProps) {
  const otherId = useId()
  const srdClass = srd.classes ? byName(srd.classes, build.className) : undefined
  const background = srd.backgrounds ? byName(srd.backgrounds, build.background) : undefined
  const skillName = (index: string) => SKILLS.find((s) => s.index === index)?.name ?? index

  return (
    <Panel title="Proficiencies">
      <fieldset className={styles.form} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className={styles.note}>Saving throws your class is proficient in</legend>
        <div className={styles.checkGrid}>
          {ABILITIES.map((ability) => {
            const on = build.saveProficiencies.includes(ability)
            return (
              <label key={ability} className={styles.check}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(event) =>
                    onChange({ ...build, saveProficiencies: toggle(build.saveProficiencies, ability, event.target.checked) })
                  }
                />
                {ABILITY_NAME[ability]}{' '}
                <span className={styles.bonus}>{formatBonus(saveBonus(build.scores[ability], on, build.level))}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className={styles.form}>
        {srdClass?.skillChoices && (
          <p className={styles.note}>
            {srdClass.name}s choose {srdClass.skillChoices.choose} skills from:{' '}
            {srdClass.skillChoices.from.map(skillName).join(', ')}.
          </p>
        )}
        {background && background.skills.length > 0 && (
          <p className={styles.note}>
            The {background.name} background gives {background.skills.map(skillName).join(' and ')}.
          </p>
        )}
        <table className={styles.skillTable}>
          <thead>
            <tr>
              <th scope="col" className={styles.centre}>
                Proficient
              </th>
              <th scope="col" className={styles.centre} title="Doubles your proficiency bonus (rogues and bards)">
                Expertise
              </th>
              <th scope="col">Skill</th>
              <th scope="col">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((skill) => {
              const proficient = build.skillProficiencies.includes(skill.index)
              const expert = build.skillExpertise.includes(skill.index)
              const rank = skillRank(build, skill.index)
              return (
                <tr key={skill.index}>
                  <td className={styles.centre}>
                    <input
                      type="checkbox"
                      aria-label={`Proficient in ${skill.name}`}
                      checked={proficient}
                      onChange={(event) =>
                        onChange({
                          ...build,
                          skillProficiencies: toggle(build.skillProficiencies, skill.index, event.target.checked),
                          skillExpertise: event.target.checked ? build.skillExpertise : toggle(build.skillExpertise, skill.index, false),
                        })
                      }
                    />
                  </td>
                  <td className={styles.centre}>
                    <input
                      type="checkbox"
                      aria-label={`Expertise in ${skill.name}`}
                      checked={expert}
                      disabled={!proficient}
                      onChange={(event) =>
                        onChange({ ...build, skillExpertise: toggle(build.skillExpertise, skill.index, event.target.checked) })
                      }
                    />
                  </td>
                  <td>
                    {skill.name} <span className={styles.muted}>({ABILITY_SHORT[skill.ability]})</span>
                  </td>
                  <td className={styles.bonus}>{formatBonus(skillBonus(build.scores[skill.ability], rank, build.level))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.grid2}>
        <div className={styles.abilityField}>
          <label htmlFor={otherId} className={styles.note}>
            Armour, weapons and tools
          </label>
          <textarea
            id={otherId}
            className={styles.textarea}
            maxLength={2000}
            value={build.otherProficiencies}
            onChange={(event) => onChange({ ...build, otherProficiencies: event.target.value })}
          />
        </div>
        <TextField
          label="Languages"
          maxLength={500}
          value={build.languages}
          onChange={(event) => onChange({ ...build, languages: event.target.value })}
        />
      </div>
    </Panel>
  )
}
