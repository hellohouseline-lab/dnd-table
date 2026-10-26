import { useSrd } from '../../live/useSrd.ts'
import {
  loadBackgrounds,
  loadClasses,
  loadEquipment,
  loadFeatures,
  loadRaces,
  loadSpells,
} from '../../rules/srd/index.ts'
import { BuilderView } from '../builder/BuilderView.tsx'
import { useDraft } from '../builder/useDraft.ts'

/** #/dev/builder: the character builder with nothing saved, not even in the browser. */
export function BuilderPreview() {
  const races = useSrd(loadRaces)
  const classes = useSrd(loadClasses)
  const features = useSrd(loadFeatures)
  const backgrounds = useSrd(loadBackgrounds)
  const equipment = useSrd(loadEquipment)
  const spells = useSrd(loadSpells)
  const [draft, setDraft] = useDraft(null)
  return (
    <BuilderView
      draft={draft}
      onDraft={setDraft}
      races={races}
      classes={classes}
      features={features}
      backgrounds={backgrounds}
      equipment={equipment}
      spells={spells}
      // In the preview the dice are thrown in the browser.
      onRoll={async () =>
        Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)))
      }
      campaignName="The Ember Road"
      exitHref="#/dev/table"
      formHref="#/dev/character"
    />
  )
}
