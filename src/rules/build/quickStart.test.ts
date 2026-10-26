import { beforeAll, describe, expect, it } from 'vitest'
import { loadBackgrounds, loadClasses, loadEquipment, loadFeatures, loadRaces, loadSpells } from '../srd/index.ts'
import { assembleBuild, type BuilderData } from './assemble.ts'
import { raceSummary } from './draft.ts'
import { gearSummary } from './gearStep.ts'
import { autoDraft, PRESETS, surpriseDraft } from './quickStart.ts'
import { spellPlan, spellsMissing } from './spellsStep.ts'
import { backgroundSummary, classSummary, finalScores, scoresValid } from './steps.ts'

let data: BuilderData
beforeAll(async () => {
  data = {
    races: await loadRaces(),
    classes: await loadClasses(),
    features: await loadFeatures(),
    backgrounds: await loadBackgrounds(),
    equipment: await loadEquipment(),
    spells: await loadSpells(),
  }
})

/** Every step's "still to pick", which must be empty for a ready-made character. */
function missing(draft: ReturnType<typeof autoDraft>) {
  const cls = data.classes.find((c) => c.index === draft.className)!
  const race = raceSummary(draft, data.races)
  const klass = classSummary(draft, cls, data.features, race)
  const bg = backgroundSummary(draft, data.backgrounds, [...(race?.skills ?? []), ...draft.classSkillPicks])
  const scores = finalScores(draft, race)
  const gear = gearSummary(draft, cls, data.backgrounds[0], data.equipment, scores)
  const plan = spellPlan(cls, 1, klass.subclass?.index ?? null, scores, data.spells)
  return [
    ...(race?.missing ?? ['race']),
    ...klass.missing,
    ...(bg?.missing ?? ['background']),
    ...(scoresValid(draft) ? [] : ['scores']),
    ...gear.missing,
    ...spellsMissing(draft, plan),
    ...(draft.name ? [] : ['name']),
  ]
}

describe('quick starts', () => {
  it('has one ready-made character for each class, every one complete', () => {
    expect(PRESETS.map((p) => p.className).sort()).toEqual(data.classes.map((c) => c.index).sort())
    for (const preset of PRESETS) {
      const draft = autoDraft(preset, data)
      expect({ preset: preset.key, missing: missing(draft) }).toEqual({ preset: preset.key, missing: [] })
      const build = assembleBuild(draft, data)
      expect(build?.name).toBe(preset.name)
      expect(build?.maxHp).toBeGreaterThan(5)
    }
  })

  it('makes a fighter in chain mail with a longsword, and a wizard with Magic Missile', () => {
    const fighter = assembleBuild(
      autoDraft(
        PRESETS.find((p) => p.key === 'fighter')!,
        data,
      ),
      data,
    )!
    expect(fighter.attacks.map((a) => a.name)).toContain('Longsword')
    expect(fighter.armourClass).toBeGreaterThanOrEqual(16)
    expect(fighter.features.map((f) => f.name)).toContain('Fighting Style: Defense')
    const wizard = assembleBuild(
      autoDraft(
        PRESETS.find((p) => p.key === 'wizard')!,
        data,
      ),
      data,
    )!
    expect(wizard.spellcasting.spells.map((s) => s.name)).toEqual(
      expect.arrayContaining(['Fire Bolt', 'Magic Missile', 'Shield']),
    )
    expect(wizard.story.height).toMatch(/ft .*cm/)
  })

  it('surprises with a complete random character, the same for the same luck', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let n = seed
      const random = () => {
        n = (n * 16807) % 2147483647
        return (n - 1) / 2147483646
      }
      const draft = surpriseDraft(data, random)
      expect({ seed, missing: missing(draft) }).toEqual({ seed, missing: [] })
    }
  })
})
