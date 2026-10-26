import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { toBuild } from '../../rules/build/applyLevelUp.ts'
import type { Character, CharacterBuild } from '../../rules/character.ts'
import { spellCounts, spellLimits } from '../../rules/manage.ts'
import type { SrdBackground, SrdClass, SrdEquipment, SrdFeature, SrdRaces, SrdSpell } from '../../rules/srd/index.ts'
import styles from '../builder/Builder.module.css'
import { StoryFields } from '../builder/WhoStep.tsx'
import { ManageChoices } from './ManageChoices.tsx'
import { ManageGear } from './ManageGear.tsx'
import { ManageSpells } from './ManageSpells.tsx'
import own from './Manage.module.css'

export type ManageData = {
  classes: SrdClass[]
  races: SrdRaces
  backgrounds: SrdBackground[]
  equipment: SrdEquipment
  features: Record<string, SrdFeature>
  spells: SrdSpell[]
}

type ManageViewProps = {
  character: Character
  data: ManageData
  /** Saves the sheet; resolves with a problem, or null. */
  onSave: (build: CharacterBuild) => Promise<string | null>
  exitHref: string
  /** The plain form, for typing anything in by hand. */
  formHref: string
  /** Whether gear can be added for free here (the DM always; players unless the DM has turned it off). */
  canAddGear?: boolean
}

type Panel = 'spells' | 'gear' | 'choices' | 'who'

/**
 * Change your character, the builder's way: spells from the class's list as cards (within what the
 * level allows), gear off the shelves (weapons join the hand, armour sets the AC), the choices the
 * class has made, and who they are. Anything else can still be typed in on the plain form.
 */
export function ManageView({ character, data, onSave, exitHref, formHref, canAddGear = true }: ManageViewProps) {
  const [build, setBuild] = useState<CharacterBuild>(() => toBuild(character))
  const [saved, setSaved] = useState<CharacterBuild>(build)
  const cls = data.classes.find((c) => c.name.toLowerCase() === build.className.trim().toLowerCase()) ?? null
  const casts = cls ? spellLimits(build, cls).way !== 'none' : false
  const [panel, setPanel] = useState<Panel>(casts ? 'spells' : 'gear')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const changed = JSON.stringify(build) !== JSON.stringify(saved)

  const panels: { key: Panel; name: string }[] = [
    ...(casts ? [{ key: 'spells' as const, name: 'Spells' }] : []),
    { key: 'gear', name: 'Gear' },
    ...(cls ? [{ key: 'choices' as const, name: 'Your choices' }] : []),
    { key: 'who', name: 'Who they are' },
  ]

  const race = data.races.races.find((r) => r.name.toLowerCase() === build.race.trim().toLowerCase())
  const background = data.backgrounds.find((b) => b.name.toLowerCase() === build.background.trim().toLowerCase())

  // Over the limit (after a level, or typed in by hand): say so, but let it save.
  const over = (() => {
    if (!cls || !casts) return null
    const limits = spellLimits(build, cls)
    const counts = spellCounts(build)
    if (counts.cantrips > limits.cantrips)
      return `You have ${counts.cantrips} cantrips; your level allows ${limits.cantrips}.`
    if (limits.known !== null && counts.spells > limits.known) {
      return `You know ${counts.spells} spells; your level allows ${limits.known}. Your subclass's spells may not count.`
    }
    return null
  })()

  async function save() {
    setSaving(true)
    setProblem(null)
    const result = await onSave(build)
    setSaving(false)
    setProblem(result)
    if (result === null) {
      setSaved(build)
      setDone(true)
    }
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{build.name || 'Your character'}</div>
          <h1 className={styles.title}>Change your character</h1>
        </div>
        <span className={styles.spacer} />
        <a className={styles.headerLink} href={formHref}>
          Type it in (advanced)
        </a>
        <a className={styles.headerButton} href={exitHref}>
          {changed ? 'Leave without saving' : 'Back'}
        </a>
      </header>

      <div className={own.body}>
        <nav className={own.tabs} role="tablist" aria-label="What to change">
          {panels.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={panel === p.key}
              className={cx(own.tab, panel === p.key && own.tabHere)}
              onClick={() => setPanel(p.key)}
            >
              {p.name}
            </button>
          ))}
        </nav>

        <section className={own.panel} aria-label={panels.find((p) => p.key === panel)?.name}>
          {panel === 'spells' && cls && (
            <ManageSpells build={build} onBuild={setBuild} cls={cls} spells={data.spells} />
          )}
          {panel === 'gear' && (
            <ManageGear build={build} onBuild={setBuild} equipment={data.equipment} canAdd={canAddGear} />
          )}
          {panel === 'choices' && cls && (
            <ManageChoices build={build} onBuild={setBuild} cls={cls} features={data.features} />
          )}
          {panel === 'who' && (
            <StoryFields
              title="Who they are"
              name={build.name}
              onName={(name) => setBuild({ ...build, name })}
              story={build.story}
              onStory={(story) => setBuild({ ...build, story })}
              background={background ?? null}
              race={
                race ? { index: race.index, name: race.name } : build.race ? { index: null, name: build.race } : null
              }
            />
          )}
        </section>

        <footer className={styles.footer}>
          <span className={styles.footerNote} role="status">
            {problem ?? over ?? (changed ? 'You have changes to save.' : done ? 'Saved.' : 'Nothing changed yet.')}
          </span>
          <button
            type="button"
            className={styles.next}
            disabled={!changed || saving || !build.name.trim()}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </div>
    </main>
  )
}
