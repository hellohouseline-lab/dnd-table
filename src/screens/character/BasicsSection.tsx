import { useState } from 'react'
import { SelectField, TextField } from '../../components/Field.tsx'
import { Panel } from '../../components/Panel.tsx'
import type { CharacterBuild } from '../../rules/character.ts'
import { byName } from '../../rules/srd/index.ts'
import { withBackground, withClass, withLevel, withRace } from '../../rules/srd/defaults.ts'
import styles from './form.module.css'
import type { SrdBundle } from './srdBundle.ts'

type SectionProps = { build: CharacterBuild; onChange: (build: CharacterBuild) => void; srd: SrdBundle }

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

/**
 * Name, race, class, background and level. Picking one from the rules list fills in what the
 * rules give (hit die, saves, speed, skills, spell slots); anything else can be typed freely.
 */
export function BasicsSection({ build, onChange, srd }: SectionProps) {
  const [filledFrom, setFilledFrom] = useState<string | null>(null)
  const srdClass = srd.classes ? byName(srd.classes, build.className) : undefined
  const srdRace = srd.races ? byName(srd.races.races, build.race) : undefined

  function setClass(name: string) {
    const match = srd.classes ? byName(srd.classes, name) : undefined
    if (match && match.index !== srdClass?.index) {
      onChange(withClass(build, match))
      setFilledFrom(`Filled in from the ${match.name} rules: hit die, saving throws, proficiencies and spell slots.`)
    } else {
      onChange({ ...build, className: name })
    }
  }

  function setRace(name: string) {
    const match = srd.races ? byName(srd.races.races, name) : undefined
    if (match && match.index !== srdRace?.index) {
      onChange({ ...withRace(build, match), subrace: '' })
      setFilledFrom(`Filled in from the ${match.name} rules: speed and languages.`)
    } else {
      onChange({ ...build, race: name })
    }
  }

  function setBackground(name: string) {
    const match = srd.backgrounds ? byName(srd.backgrounds, name) : undefined
    if (match && match.name !== build.background) {
      onChange(withBackground(build, match))
      setFilledFrom(`Added the ${match.name} background's skills.`)
    } else {
      onChange({ ...build, background: name })
    }
  }

  return (
    <Panel title="Who they are">
      <div className={styles.grid2}>
        <TextField
          label="Character name"
          required
          maxLength={60}
          placeholder="Thorin Ironfist"
          value={build.name}
          onChange={(event) => onChange({ ...build, name: event.target.value })}
        />
        <SelectField
          label="Level"
          value={build.level}
          onChange={(event) => onChange(withLevel(build, Number(event.target.value), srdClass))}
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Race"
          list="srd-races"
          hint="Pick from the list, or type your own"
          maxLength={60}
          value={build.race}
          onChange={(event) => setRace(event.target.value)}
        />
        <TextField
          label="Subrace"
          list="srd-subraces"
          maxLength={60}
          value={build.subrace}
          onChange={(event) => onChange({ ...build, subrace: event.target.value })}
        />
        <TextField
          label="Class"
          list="srd-classes"
          hint="Pick from the list, or type your own"
          maxLength={60}
          value={build.className}
          onChange={(event) => setClass(event.target.value)}
        />
        <TextField
          label="Subclass"
          list="srd-subclasses"
          hint="Most classes choose one at level 3"
          maxLength={60}
          value={build.subclass}
          onChange={(event) => onChange({ ...build, subclass: event.target.value })}
        />
        <TextField
          label="Background"
          list="srd-backgrounds"
          hint="The free rules include Acolyte; type any other"
          maxLength={60}
          value={build.background}
          onChange={(event) => setBackground(event.target.value)}
        />
      </div>
      {filledFrom && <p className={styles.filled}>{filledFrom} Change anything you like.</p>}

      <datalist id="srd-races">{srd.races?.races.map((r) => <option key={r.index} value={r.name} />)}</datalist>
      <datalist id="srd-subraces">{srdRace?.subraces.map((s) => <option key={s.index} value={s.name} />)}</datalist>
      <datalist id="srd-classes">{srd.classes?.map((c) => <option key={c.index} value={c.name} />)}</datalist>
      <datalist id="srd-subclasses">{srdClass?.subclasses.map((s) => <option key={s.index} value={s.name} />)}</datalist>
      <datalist id="srd-backgrounds">{srd.backgrounds?.map((b) => <option key={b.index} value={b.name} />)}</datalist>
    </Panel>
  )
}
