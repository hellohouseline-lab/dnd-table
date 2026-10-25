import { buttonClassName } from '../../components/buttonClassName.ts'
import { SelectField } from '../../components/Field.tsx'
import { Panel } from '../../components/Panel.tsx'
import { ABILITIES, ABILITY_NAME } from '../../rules/abilities.ts'
import type { CharacterBuild } from '../../rules/character.ts'
import { abilityModifier, formatBonus } from '../../rules/maths/core.ts'
import { suggestedMaxHp } from '../../rules/maths/hitPoints.ts'
import { byName } from '../../rules/srd/index.ts'
import { raceDefaults } from '../../rules/srd/defaults.ts'
import styles from './form.module.css'
import { NumberField } from './NumberField.tsx'
import type { SrdBundle } from './srdBundle.ts'

type SectionProps = { build: CharacterBuild; onChange: (build: CharacterBuild) => void; srd: SrdBundle }

/** The six scores, with racial bonuses shown as a reminder to include them. */
export function AbilitiesSection({ build, onChange, srd }: SectionProps) {
  const race = srd.races ? byName(srd.races.races, build.race) : undefined
  const subrace = race?.subraces.find((s) => s.name.toLowerCase() === build.subrace.trim().toLowerCase())
  const bonuses = race ? raceDefaults(race, subrace?.index).bonusesText : ''

  return (
    <Panel title="Ability scores">
      <p className={styles.note}>
        Type your final scores{bonuses ? `, with your ${subrace?.name ?? race?.name} bonuses included (${bonuses})` : ''}.
        The table works out the modifiers.
      </p>
      <div className={styles.abilityGrid}>
        {ABILITIES.map((ability) => (
          <div key={ability} className={styles.abilityField}>
            <NumberField
              label={ABILITY_NAME[ability]}
              min={1}
              max={30}
              value={build.scores[ability]}
              onChange={(score) => onChange({ ...build, scores: { ...build.scores, [ability]: score } })}
            />
            <span className={styles.modifier}>Modifier {formatBonus(abilityModifier(build.scores[ability]))}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** Hit points, armour class, speed and hit die. */
export function VitalsSection({ build, onChange }: Omit<SectionProps, 'srd'>) {
  const suggested = suggestedMaxHp(build.hitDie, build.scores.constitution, build.level)
  return (
    <Panel title="Hit points, armour and speed">
      <div className={styles.grid3}>
        <NumberField
          label="Maximum hit points"
          min={1}
          max={999}
          value={build.maxHp}
          onChange={(maxHp) => onChange({ ...build, maxHp })}
        />
        <NumberField
          label="Armour class"
          hint="From your armour and shield"
          min={1}
          max={40}
          value={build.armourClass}
          onChange={(armourClass) => onChange({ ...build, armourClass })}
        />
        <NumberField
          label="Speed (feet)"
          min={0}
          max={200}
          value={build.speed}
          onChange={(speed) => onChange({ ...build, speed })}
        />
        <SelectField
          label="Hit die"
          value={build.hitDie}
          onChange={(event) => onChange({ ...build, hitDie: Number(event.target.value) })}
        >
          {[6, 8, 10, 12].map((die) => (
            <option key={die} value={die}>
              d{die}
            </option>
          ))}
        </SelectField>
      </div>
      {suggested !== build.maxHp && (
        <div className={styles.actions}>
          <span className={styles.note}>
            The usual maximum for a level {build.level} character with a d{build.hitDie} hit die and this Constitution
            is {suggested}.
          </span>
          <button
            type="button"
            className={buttonClassName('outline', { size: 'small' })}
            onClick={() => onChange({ ...build, maxHp: suggested })}
          >
            Use {suggested}
          </button>
        </div>
      )}
    </Panel>
  )
}
