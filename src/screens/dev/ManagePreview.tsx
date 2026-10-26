import { useSrd } from '../../live/useSrd.ts'
import {
  loadBackgrounds,
  loadClasses,
  loadEquipment,
  loadFeatures,
  loadRaces,
  loadSpells,
} from '../../rules/srd/index.ts'
import { ManageView } from '../manage/ManageView.tsx'
import { sampleFighter, sampleWizard } from './sampleData.ts'

/** #/dev/change/:who: Change your character for Elara the wizard, or Thorin the fighter. Nothing is saved. */
export function ManagePreview({ who }: { who: string }) {
  const classes = useSrd(loadClasses)
  const races = useSrd(loadRaces)
  const backgrounds = useSrd(loadBackgrounds)
  const equipment = useSrd(loadEquipment)
  const features = useSrd(loadFeatures)
  const spells = useSrd(loadSpells)
  if (!classes || !races || !backgrounds || !equipment || !features || !spells) return null
  return (
    <ManageView
      key={who}
      character={who === 'fighter' ? sampleFighter : sampleWizard}
      data={{ classes, races, backgrounds, equipment, features, spells }}
      exitHref="#/dev/table"
      formHref="#/dev/character"
      onSave={async () => null}
    />
  )
}
