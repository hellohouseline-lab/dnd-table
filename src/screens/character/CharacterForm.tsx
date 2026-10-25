import { useState, type FormEvent } from 'react'
import { ButtonLink } from '../../components/Button.tsx'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { Notice } from '../../components/Notice.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import { uploadPortrait } from '../../live/characters.ts'
import { messageFor } from '../../live/errors.ts'
import type { Character, CharacterBuild } from '../../rules/character.ts'
import { AbilitiesSection, VitalsSection } from './AbilitiesSection.tsx'
import { AttacksSection } from './AttacksSection.tsx'
import { BasicsSection } from './BasicsSection.tsx'
import { FeaturesSection } from './FeaturesSection.tsx'
import styles from './form.module.css'
import { ProficienciesSection } from './ProficienciesSection.tsx'
import { SpellsSection } from './SpellsSection.tsx'
import type { SrdBundle } from './srdBundle.ts'

type CharacterFormProps = {
  initial: CharacterBuild
  srd: SrdBundle
  /** The saved character, when editing; portraits can only be added once it exists. */
  character?: Character
  saveLabel: string
  cancelHref: string
  onSave: (build: CharacterBuild) => Promise<void>
}

/** The whole character, typed in. Every number shown here is worked out live as you type. */
export function CharacterForm({ initial, srd, character, saveLabel, cancelHref, onSave }: CharacterFormProps) {
  const [build, setBuild] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(build)
    } catch (caught) {
      setError(messageFor(caught))
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void save(event)}>
      <BasicsSection build={build} onChange={setBuild} srd={srd} />
      {character && <PortraitSection character={character} />}
      <AbilitiesSection build={build} onChange={setBuild} srd={srd} />
      <VitalsSection build={build} onChange={setBuild} />
      <ProficienciesSection build={build} onChange={setBuild} srd={srd} />
      <AttacksSection build={build} onChange={setBuild} />
      <FeaturesSection build={build} onChange={setBuild} srd={srd} />
      <SpellsSection build={build} onChange={setBuild} srd={srd} />

      <div className={styles.saveBar}>
        <button type="submit" className={buttonClassName('primary')} disabled={saving || !build.name.trim()}>
          {saving ? 'Saving…' : saveLabel}
        </button>
        <ButtonLink href={cancelHref} variant="quiet">
          Cancel
        </ButtonLink>
        {!build.name.trim() && <span className={styles.note}>Give your character a name to save.</span>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </form>
  )
}

function PortraitSection({ character }: { character: Character }) {
  const [current, setCurrent] = useState(character)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      setCurrent(await uploadPortrait(current, file))
    } catch (caught) {
      setError(messageFor(caught))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Panel title="Portrait">
      <div className={styles.portraitRow}>
        <Portrait path={current.portraitPath} size={96} name={current.name} />
        <div className={styles.form}>
          <p className={styles.note}>
            A square picture works best. It&rsquo;s shrunk to 512 pixels and only people at this table can see it. Saved
            straight away.
          </p>
          <label className={`${buttonClassName('outline', { size: 'small' })} ${styles.fileLabel}`}>
            {uploading ? 'Uploading…' : current.portraitPath ? 'Choose a different picture' : 'Choose a picture'}
            <input
              className={styles.fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(event) => void choose(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Panel>
  )
}
