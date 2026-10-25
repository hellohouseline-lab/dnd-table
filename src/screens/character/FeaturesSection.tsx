import { useState } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { Notice } from '../../components/Notice.tsx'
import { Panel } from '../../components/Panel.tsx'
import { entryId, type CharacterBuild, type FeatureEntry } from '../../rules/character.ts'
import { addMissingFeatures, classFeatures, raceTraits } from '../../rules/srd/defaults.ts'
import { byName, loadFeatures } from '../../rules/srd/index.ts'
import styles from './form.module.css'
import type { SrdBundle } from './srdBundle.ts'

type SectionProps = { build: CharacterBuild; onChange: (build: CharacterBuild) => void; srd: SrdBundle }

/** Class features and racial traits, from the rules or typed in, each with optional uses. */
export function FeaturesSection({ build, onChange, srd }: SectionProps) {
  const [added, setAdded] = useState<string | null>(null)
  const srdClass = srd.classes ? byName(srd.classes, build.className) : undefined
  const race = srd.races ? byName(srd.races.races, build.race) : undefined
  const subclass = srdClass?.subclasses.find((s) => s.name.toLowerCase() === build.subclass.trim().toLowerCase())

  const setFeatures = (features: FeatureEntry[]) => onChange({ ...build, features })
  const change = (id: string, patch: Partial<FeatureEntry>) =>
    setFeatures(build.features.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  async function addClassFeatures() {
    if (!srdClass) return
    const extra = classFeatures(srdClass, subclass?.index ?? null, build.level, await loadFeatures())
    const features = addMissingFeatures(build.features, extra)
    setAdded(`Added ${features.length - build.features.length} ${srdClass.name} features up to level ${build.level}.`)
    setFeatures(features)
  }

  function addRaceTraits() {
    if (!srd.races || !race) return
    const subrace = race.subraces.find((s) => s.name.toLowerCase() === build.subrace.trim().toLowerCase())
    const features = addMissingFeatures(build.features, raceTraits(srd.races, race, subrace?.index))
    setAdded(`Added ${features.length - build.features.length} ${subrace?.name ?? race.name} traits.`)
    setFeatures(features)
  }

  return (
    <Panel title="Features and traits">
      <p className={styles.note}>
        Add your class features and racial traits from the rules, then fill in how many uses each has (like Second
        Wind: 1, back after a short rest). Leave uses empty for features with no limit.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={buttonClassName('outline', { size: 'small' })}
          disabled={!srdClass}
          title={srdClass ? undefined : 'Pick a class from the list first'}
          onClick={() => void addClassFeatures()}
        >
          Add {srdClass?.name ?? 'class'} features
        </button>
        <button
          type="button"
          className={buttonClassName('outline', { size: 'small' })}
          disabled={!race}
          title={race ? undefined : 'Pick a race from the list first'}
          onClick={addRaceTraits}
        >
          Add {race?.name ?? 'racial'} traits
        </button>
        <button
          type="button"
          className={buttonClassName('quiet')}
          onClick={() =>
            setFeatures([...build.features, { id: entryId(), name: '', description: '', usesMax: null, usesLeft: 0, recharge: null }])
          }
        >
          Add a feature by hand
        </button>
      </div>
      {added && <Notice tone="success">{added}</Notice>}

      <ul className={styles.list}>
        {build.features.map((feature) => (
          <li key={feature.id} className={styles.item}>
            <div className={styles.itemRow}>
              <input
                className={`${styles.input} ${styles.grow}`}
                aria-label="Feature name"
                placeholder="Feature name"
                maxLength={80}
                value={feature.name}
                onChange={(event) => change(feature.id, { name: event.target.value })}
              />
              <label className={styles.check}>
                Uses
                <input
                  className={`${styles.input} ${styles.narrow}`}
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Any"
                  value={feature.usesMax ?? ''}
                  onChange={(event) => {
                    const uses = Math.min(20, Math.trunc(Number(event.target.value)) || 0)
                    change(feature.id, uses > 0 ? { usesMax: uses, usesLeft: uses } : { usesMax: null, usesLeft: 0, recharge: null })
                  }}
                />
              </label>
              <select
                className={styles.select}
                aria-label="When uses come back"
                disabled={feature.usesMax === null}
                value={feature.recharge ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  change(feature.id, { recharge: value === 'short' || value === 'long' ? value : null })
                }}
              >
                <option value="">Doesn&rsquo;t come back</option>
                <option value="short">Back after a short rest</option>
                <option value="long">Back after a long rest</option>
              </select>
              <button
                type="button"
                className={buttonClassName('quiet')}
                onClick={() => setFeatures(build.features.filter((f) => f.id !== feature.id))}
              >
                Remove
              </button>
            </div>
            <textarea
              className={styles.textarea}
              aria-label="What it does"
              placeholder="What it does"
              maxLength={4000}
              value={feature.description}
              onChange={(event) => change(feature.id, { description: event.target.value })}
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}
