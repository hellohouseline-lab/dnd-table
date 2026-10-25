import { useState } from 'react'
import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { Icon, type IconName } from '../../components/Icon.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Parchment } from '../../components/Parchment.tsx'
import { localRoll, PRACTICE_SET } from '../../dice/localRoll.ts'
import { RollLog } from '../../dice/RollLog.tsx'
import { RollToasts } from '../../dice/RollToasts.tsx'
import type { DiceStyle } from '../../dice/style.ts'
import { useDiceTray } from '../../dice/useDiceTray.ts'
import { useTableRolls } from '../../dice/useTableRolls.ts'
import type { Campaign, Member } from '../../live/campaigns.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { Roll } from '../../live/rolls.ts'
import type { RollLogState } from '../../live/useRollLog.ts'
import type { Character } from '../../rules/character.ts'
import { isSingleD20, type RollMode, type RollRequest } from '../../rules/dice.ts'
import { abilityCheck, attackRoll, freeRoll, initiativeRoll, savingThrow, skillCheck } from '../../rules/rolls.ts'
import { SheetPanel, type SheetTabName } from '../sheet/SheetPanel.tsx'
import type { SheetRolls } from '../sheet/SheetTab.tsx'
import { CameraColumn } from '../table/TableView.tsx'
import { DiceControls } from '../table/DiceControls.tsx'
import { PartyCards } from './PartyCards.tsx'
import styles from './DmView.module.css'

type DmTab = 'party' | 'log'

const TABS: { label: string; tab?: DmTab; title?: string }[] = [
  { label: 'Party', tab: 'party' },
  { label: 'Encounter', title: 'Fights arrive in milestone 6' },
  { label: 'NPCs', title: 'NPCs arrive in Phase 2' },
  { label: 'Items and loot', title: 'Items arrive in Phase 2' },
  { label: 'Log', tab: 'log' },
]

const VERBS: { label: string; icon: IconName; title: string }[] = [
  { label: 'Ask for a roll', icon: 'd20', title: 'Arrives in milestone 4' },
  { label: 'Start combat', icon: 'sword', title: 'Arrives in milestone 6' },
  { label: 'Show an NPC', icon: 'journal', title: 'Arrives in Phase 2' },
  { label: 'Give an item', icon: 'items', title: 'Arrives in Phase 2' },
  { label: 'Rest', icon: 'star', title: 'Arrives in milestone 5' },
  { label: 'Add a note', icon: 'log', title: 'Arrives in milestone 5' },
]

type DmViewProps = {
  campaign: Campaign
  me: Member
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  onUpdate: (characterId: string, patch: TrackerPatch) => void
  saveError?: string | null
  log: RollLogState
  diceStyle: DiceStyle
  onDiceStyleChange: (style: DiceStyle) => void
  /** Throws in the browser instead of on the server (the design preview, which has no database). */
  thrower?: (request: RollRequest) => Promise<Roll>
  startTab?: DmTab
}

/**
 * Screen 07, the DM's Command screen. In milestone 3: the party at a glance, the roll log and the
 * DM's own dice, with everyone's throws landing in the middle. The notebook, stage and combat
 * arrive in later milestones.
 */
export function DmView({
  campaign,
  me,
  members,
  characters,
  online,
  onUpdate,
  saveError,
  log,
  diceStyle,
  onDiceStyleChange,
  thrower,
  startTab = 'party',
}: DmViewProps) {
  const [tab, setTab] = useState<DmTab>(startTab)
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const [sheetTab, setSheetTab] = useState<SheetTabName>('sheet')
  const [mode, setMode] = useState<RollMode>('normal')
  const [secret, setSecret] = useState(false)
  const { attach: attachTray, throwDice } = useDiceTray()
  const table = useTableRolls({ campaignId: campaign.id, userId: me.user_id, throwDice, thrower })
  const open = characters.find((c) => c.id === sheetFor)
  const choices = { mode, secret }

  function roll(request: RollRequest) {
    if (isSingleD20(request.dice)) setMode('normal')
    void table.roll(request)
  }

  // The DM can roll for any character from their sheet, say for a player who stepped away.
  const rollsFor = (character: Character): SheetRolls => ({
    ability: (ability) => roll(abilityCheck(character, ability, choices)),
    save: (ability) => roll(savingThrow(character, ability, choices)),
    skill: (index) => roll(skillCheck(character, index, choices)),
    initiative: () => roll(initiativeRoll(character, choices)),
    attack: (attack) => roll(attackRoll(character, attack, choices)),
    disabled: table.rolling,
  })

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.campaign}>{campaign.name}</h1>
        <span className={styles.headerNote}>DM screen</span>
        <span className={styles.spacer} />
        <a className={styles.headerLink} href={href(`/c/${campaign.id}`)}>
          Join screen and invites
        </a>
        <span className={styles.stage} title="The stage screen arrives in milestone 5">
          Screen 2: Stage
        </span>
      </header>

      <aside className={styles.left}>
        <Parchment title="Your notebook" className={styles.notebook}>
          <p className={styles.ink}>
            Where we are, what happens next, key items to collect and quick notes arrive here in milestone 5.
          </p>
          <p className={styles.ink}>
            For now: watch everyone&rsquo;s rolls land in the middle, check the Log tab, and roll your own dice below,
            in secret if you like.
          </p>
        </Parchment>
        {saveError && <Notice tone="error">{saveError}</Notice>}
        {table.error && <Notice tone="error">{table.error}</Notice>}
      </aside>

      <DiceControls
        className={styles.dice}
        isDm
        style={diceStyle}
        onStyleChange={onDiceStyleChange}
        mode={mode}
        onModeChange={setMode}
        secret={secret}
        onSecretChange={setSecret}
        onRoll={(dice) => roll(freeRoll(dice, choices))}
        onPractise={() =>
          table.showLocal(localRoll(PRACTICE_SET, { campaignId: campaign.id, rollerId: me.user_id, style: diceStyle }))
        }
        rolling={table.rolling}
      />

      <section className={styles.centre}>
        <div role="tablist" aria-label="DM panels" className={styles.tabs}>
          {TABS.map(({ label, tab: target, title }) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={target === tab}
              disabled={!target}
              title={title}
              className={cx(styles.tab, target === tab && styles.tabOn)}
              onClick={() => target && setTab(target)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.content} role="tabpanel">
          {tab === 'party' ? (
            <PartyCards
              members={members}
              characters={characters}
              onOpenSheet={(character) => {
                setSheetTab('sheet')
                setSheetFor(character.id)
              }}
            />
          ) : (
            <RollLog
              rolls={log.rolls}
              members={members}
              characters={characters}
              loading={log.status === 'loading'}
              error={log.status === 'error' ? log.message : undefined}
            />
          )}
        </div>
        <nav className={styles.verbs} aria-label="DM actions">
          {VERBS.map((verb) => (
            <button key={verb.label} type="button" className={styles.verb} disabled title={verb.title}>
              <Icon name={verb.icon} />
              {verb.label}
            </button>
          ))}
        </nav>

        {open && (
          <SheetPanel
            className={styles.sheet}
            character={open}
            canEdit
            editHref={href(`/c/${campaign.id}/character/${open.id}/edit`)}
            tab={sheetTab}
            onTab={setSheetTab}
            onClose={() => setSheetFor(null)}
            closeLabel="Back to the party"
            onUpdate={(patch) => onUpdate(open.id, patch)}
            rolls={rollsFor(open)}
          />
        )}
        <div ref={attachTray} className={styles.tray} aria-hidden="true" />
        <RollToasts
          className={styles.toasts}
          rolls={table.shown}
          members={members}
          characters={characters}
          onDismiss={table.dismiss}
        />
      </section>

      <CameraColumn
        className={styles.cameras}
        members={members}
        characters={characters}
        online={online}
        myId={me.user_id}
      />
    </main>
  )
}
