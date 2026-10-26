import { useSrd } from '../../live/useSrd.ts'
import { loadRaces, loadSpells } from '../../rules/srd/index.ts'
import { BuilderView } from '../builder/BuilderView.tsx'
import { useDraft } from '../builder/useDraft.ts'

/** #/dev/builder: the character builder with nothing saved, not even in the browser. */
export function BuilderPreview() {
  const races = useSrd(loadRaces)
  const spells = useSrd(loadSpells)
  const [draft, setDraft] = useDraft(null)
  return (
    <BuilderView
      draft={draft}
      onDraft={setDraft}
      races={races}
      spells={spells}
      campaignName="The Ember Road"
      exitHref="#/dev/table"
      formHref="#/dev/character"
    />
  )
}
