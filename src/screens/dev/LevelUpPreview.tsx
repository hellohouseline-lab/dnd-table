import { useState } from 'react'
import { useSrd } from '../../live/useSrd.ts'
import type { Character } from '../../rules/character.ts'
import { loadClasses, loadFeatures, loadSpells, type SrdSpell } from '../../rules/srd/index.ts'
import { LevelUpView } from '../builder/LevelUpView.tsx'
import { sampleFighter, sampleWizard } from './sampleData.ts'

const BARD_SPELLS = [
  'vicious-mockery',
  'minor-illusion',
  'healing-word',
  'sleep',
  'charm-person',
  'thunderwave',
  'faerie-fire',
]

/** Wren, a level 2 bard with five spells known, ready to swap one. */
function sampleBard(spells: SrdSpell[]): Character {
  return {
    ...sampleWizard,
    id: 'bard',
    name: 'Wren',
    race: 'Halfling',
    subrace: 'Lightfoot',
    className: 'Bard',
    level: 2,
    hitDie: 8,
    scores: { ...sampleWizard.scores, charisma: 16, intelligence: 10 },
    spellcasting: {
      ...sampleWizard.spellcasting,
      ability: 'charisma',
      spells: BARD_SPELLS.flatMap((index) => {
        const s = spells.find((x) => x.index === index)
        return s ? [{ id: index, index, name: s.name, level: s.level, prepared: true }] : []
      }),
    },
  }
}

/**
 * #/dev/level-up: Thorin, a level 2 fighter, takes level 3 (his path). #/dev/level-up/wizard:
 * Elowen takes level 4 (spellbook and more prepared). #/dev/level-up/bard: Wren takes level 3 (a
 * new spell, and a swap). Nothing is saved.
 */
export function LevelUpPreview({ who = 'fighter' }: { who?: string }) {
  const classes = useSrd(loadClasses)
  const features = useSrd(loadFeatures)
  const spells = useSrd(loadSpells)
  const [fighter] = useState(() => ({ ...sampleFighter, level: 2, levelUpTo: 3 }))
  if (!classes || !features || !spells) return null
  const character =
    who === 'wizard'
      ? { ...sampleWizard, levelUpTo: 4 }
      : who === 'bard'
        ? { ...sampleBard(spells), levelUpTo: 3 }
        : fighter
  const cls = classes.find((c) => c.name === character.className)
  if (!cls) return null
  return (
    <LevelUpView
      key={who}
      character={character}
      cls={cls}
      features={features}
      spells={spells}
      exitHref="#/dev/table"
      onRollHp={async () => 1 + Math.floor(Math.random() * cls.hitDie)}
      onSave={async (build, gain) =>
        `Saved in the preview: level ${build.level}, ${build.maxHp} hit points (+${gain}). Spells: ${build.spellcasting.spells
          .map((s) => `${s.name}${s.level > 0 && !s.prepared ? ' (in the book)' : ''}`)
          .join(', ')}.`
      }
    />
  )
}
