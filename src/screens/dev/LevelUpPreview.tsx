import { useState } from 'react'
import { useSrd } from '../../live/useSrd.ts'
import { loadClasses, loadFeatures, loadSpells } from '../../rules/srd/index.ts'
import { LevelUpView } from '../builder/LevelUpView.tsx'
import { sampleFighter } from './sampleData.ts'

/** #/dev/level-up: Thorin, a level 2 fighter, takes level 3 (his path). Nothing is saved. */
export function LevelUpPreview() {
  const classes = useSrd(loadClasses)
  const features = useSrd(loadFeatures)
  const spells = useSrd(loadSpells)
  const [character] = useState(() => ({ ...sampleFighter, level: 2, levelUpTo: 3 }))
  const cls = classes?.find((c) => c.index === 'fighter')
  if (!cls || !features || !spells) return null
  return (
    <LevelUpView
      character={character}
      cls={cls}
      features={features}
      spells={spells}
      exitHref="#/dev/table"
      onRollHp={async () => 1 + Math.floor(Math.random() * cls.hitDie)}
      onSave={async (build, gain) =>
        `Saved in the preview: level ${build.level}, ${build.maxHp} hit points (+${gain}).`
      }
    />
  )
}
