import { useEffect } from 'react'
import { ButtonLink } from '../../components/Button.tsx'
import { cx } from '../../components/cx.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { Character } from '../../rules/character.ts'
import { InventoryTab } from './InventoryTab.tsx'
import { PowersTab } from './PowersTab.tsx'
import { SheetTab, type SheetRolls } from './SheetTab.tsx'
import styles from './SheetPanel.module.css'

export type SheetTabName = 'sheet' | 'inventory' | 'powers'

const TABS: { name: string; tab?: SheetTabName }[] = [
  { name: 'Sheet', tab: 'sheet' },
  { name: 'Inventory', tab: 'inventory' },
  { name: 'Powers', tab: 'powers' },
  { name: 'Journal' },
  { name: 'Lore' },
]

type SheetPanelProps = {
  character: Character
  /** The player who owns it, or the DM. */
  canEdit: boolean
  editHref: string
  tab: SheetTabName
  onTab: (tab: SheetTabName) => void
  onClose: () => void
  closeLabel: string
  onUpdate: (patch: TrackerPatch) => void
  /** Click a skill, save or attack to roll it. */
  rolls?: SheetRolls
  className?: string
}

/** The big character panel from design 06, with the Sheet and Powers tabs working in Phase 1. */
export function SheetPanel({
  character,
  canEdit,
  editHref,
  tab,
  onTab,
  onClose,
  closeLabel,
  onUpdate,
  rolls,
  className,
}: SheetPanelProps) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <section className={cx(styles.panel, className)} aria-label={`${character.name}'s character sheet`}>
      <div role="tablist" aria-label="Character panels" className={styles.tabs}>
        {TABS.map(({ name, tab: target }) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={target === tab}
            disabled={!target}
            title={target ? undefined : 'Arrives in Phase 2'}
            className={cx(styles.tab, target === tab && styles.selected)}
            onClick={() => target && onTab(target)}
          >
            {name}
          </button>
        ))}
        <span className={styles.spacer} />
        {canEdit && (
          <ButtonLink href={editHref} variant="quiet" className={styles.edit}>
            Edit character
          </ButtonLink>
        )}
        <button type="button" className={styles.close} onClick={onClose} title="Close (Esc)">
          <span className={styles.x} aria-hidden="true">
            ×
          </span>
          {closeLabel}
        </button>
      </div>
      <div className={styles.body} role="tabpanel">
        {tab === 'sheet' ? (
          <SheetTab character={character} canEdit={canEdit} onUpdate={onUpdate} rolls={rolls} />
        ) : tab === 'inventory' ? (
          <InventoryTab character={character} canEdit={canEdit} onUpdate={onUpdate} />
        ) : (
          <PowersTab character={character} canEdit={canEdit} onUpdate={onUpdate} />
        )}
      </div>
    </section>
  )
}
