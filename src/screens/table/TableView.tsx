import { useState } from 'react'
import { href } from '../../app/router.ts'
import { cx } from '../../components/cx.ts'
import { HpBar } from '../../components/HpBar.tsx'
import { Icon, type IconName } from '../../components/Icon.tsx'
import { Notice } from '../../components/Notice.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import { localRoll, PRACTICE_SET } from '../../dice/localRoll.ts'
import { RollToasts } from '../../dice/RollToasts.tsx'
import type { DiceStyle } from '../../dice/style.ts'
import { useDiceTray } from '../../dice/useDiceTray.ts'
import { useTableRolls } from '../../dice/useTableRolls.ts'
import type { Member } from '../../live/campaigns.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import type { Roll } from '../../live/rolls.ts'
import { ABILITIES, ABILITY_NAME, ABILITY_SHORT } from '../../rules/abilities.ts'
import type { Character, FeatureEntry } from '../../rules/character.ts'
import { isSingleD20, type RollMode, type RollRequest } from '../../rules/dice.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { abilityCheck, attackRoll, freeRoll, initiativeRoll, savingThrow, skillCheck } from '../../rules/rolls.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { findCondition } from '../../rules/srd/index.ts'
import { SheetPanel, type SheetTabName } from '../sheet/SheetPanel.tsx'
import type { SheetRolls } from '../sheet/SheetTab.tsx'
import { DiceControls } from './DiceControls.tsx'
import { Hand } from './Hand.tsx'
import styles from './TableView.module.css'

type TableViewProps = {
  campaignId: string
  me: Member
  character: Character
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  onUpdate: (characterId: string, patch: TrackerPatch) => void
  saveError?: string | null
  diceStyle: DiceStyle
  onDiceStyleChange: (style: DiceStyle) => void
  /** Throws in the browser instead of on the server (the design preview, which has no database). */
  thrower?: (request: RollRequest) => Promise<Roll>
}

const PANEL_BUTTONS: { label: string; icon: IconName; tab?: SheetTabName; title: string }[] = [
  { label: 'Sheet', icon: 'sheet', tab: 'sheet', title: 'Character sheet' },
  { label: 'Items', icon: 'items', title: 'Inventory arrives in Phase 2' },
  { label: 'Powers', icon: 'powers', tab: 'powers', title: 'Features and spells' },
  { label: 'Journal', icon: 'journal', title: 'Journal arrives in Phase 2' },
  { label: 'Lore', icon: 'lore', title: 'Handouts arrive in Phase 2' },
]

/**
 * Screen 02, "At the table": the scene fills the screen and your character floats over it. Dice
 * thrown by anyone at the table land in the middle, followed by their result.
 */
export function TableView({
  campaignId,
  me,
  character,
  members,
  characters,
  online,
  onUpdate,
  saveError,
  diceStyle,
  onDiceStyleChange,
  thrower,
}: TableViewProps) {
  const [sheetTab, setSheetTab] = useState<SheetTabName | null>(null)
  const [mode, setMode] = useState<RollMode>('normal')
  const [secret, setSecret] = useState(false)
  const { attach: attachTray, throwDice } = useDiceTray()
  const table = useTableRolls({ campaignId, userId: me.user_id, throwDice, thrower })
  const sheet = deriveSheet(character)
  const update = (patch: TrackerPatch) => onUpdate(character.id, patch)
  const conditions = character.conditions.map((c) => findCondition(c)?.name ?? c)
  const choices = { mode, secret }

  function roll(request: RollRequest) {
    // Advantage and disadvantage are for the next d20 roll only.
    if (isSingleD20(request.dice)) setMode('normal')
    void table.roll(request)
  }

  const rolls: SheetRolls = {
    ability: (ability) => roll(abilityCheck(character, ability, choices)),
    save: (ability) => roll(savingThrow(character, ability, choices)),
    skill: (index) => roll(skillCheck(character, index, choices)),
    initiative: () => roll(initiativeRoll(character, choices)),
    attack: (attack) => roll(attackRoll(character, attack, choices)),
    disabled: table.rolling,
  }

  function spendFeature(feature: FeatureEntry) {
    update({
      features: character.features.map((f) =>
        f.id === feature.id ? { ...f, usesLeft: Math.max(0, f.usesLeft - 1) } : f,
      ),
    })
  }

  return (
    <main className={styles.screen}>
      <div className={styles.floor} aria-hidden="true" />
      <div className={styles.scene}>
        <div className={styles.sceneTitle}>The DM&rsquo;s scene appears here</div>
        <div className={styles.sceneNote}>Scene art and battle maps arrive in the next milestones. Dice land here.</div>
      </div>

      <Hand
        className={styles.hand}
        character={character}
        onAttack={rolls.attack}
        onUseFeature={spendFeature}
        disabled={table.rolling}
      />

      <DiceControls
        className={styles.dice}
        style={diceStyle}
        onStyleChange={onDiceStyleChange}
        mode={mode}
        onModeChange={setMode}
        secret={secret}
        onSecretChange={setSecret}
        onRoll={(dice) => roll(freeRoll(dice, { ...choices, characterId: character.id }))}
        onPractise={() =>
          table.showLocal(localRoll(PRACTICE_SET, { campaignId, rollerId: me.user_id, style: diceStyle }))
        }
        rolling={table.rolling}
      />

      <div className={styles.left}>
        <section className={styles.plate} aria-label="Your character">
          <div className={styles.who}>
            <Portrait path={character.portraitPath} size={60} name={character.name} />
            <div>
              <div className={styles.name}>{character.name}</div>
              <div className={styles.sub}>
                Level {character.level} · {me.display_name} (you)
              </div>
            </div>
          </div>
          <div>
            <div className={styles.hpLine}>
              <span className={styles.label}>Hit points</span>
              <span className={styles.hp}>
                {character.currentHp} <span className={styles.hpMax}>/ {character.maxHp}</span>
                {character.tempHp > 0 && <span className={styles.hpTemp}> +{character.tempHp}</span>}
              </span>
            </div>
            <div className={styles.hpBar}>
              <HpBar current={character.currentHp} max={character.maxHp} temp={character.tempHp} />
            </div>
          </div>
          <div className={styles.stats}>
            <StatBox label="AC" value={character.armourClass} title="Armour class" />
            <StatBox label="Speed" value={character.speed} title="Speed in feet" />
            <StatBox
              label="Init."
              value={formatBonus(sheet.initiative)}
              title="Roll initiative"
              onClick={rolls.initiative}
              disabled={table.rolling}
            />
            <StatBox label="Percep." value={sheet.passivePerception} title="Passive Perception" />
          </div>
        </section>

        <section className={styles.abilities} aria-label="Abilities and conditions">
          <div className={styles.abilityRow}>
            {ABILITIES.map((ability) => (
              <button
                key={ability}
                type="button"
                className={styles.ability}
                title={`Roll a ${ABILITY_NAME[ability]} check`}
                disabled={table.rolling}
                onClick={() => rolls.ability(ability)}
              >
                <span className={styles.abilityShort}>{ABILITY_SHORT[ability]}</span>
                <span className={styles.medallion}>{formatBonus(sheet.modifiers[ability])}</span>
                <span className={styles.score}>{character.scores[ability]}</span>
              </button>
            ))}
          </div>
          <div className={styles.status}>
            <span>
              <span className={styles.muted}>Conditions:</span> {conditions.length ? conditions.join(', ') : 'none'}
            </span>
            <button
              type="button"
              className={cx(styles.inspiration, character.inspiration && styles.inspired)}
              aria-pressed={character.inspiration}
              title={character.inspiration ? 'Click when you spend it' : 'The DM awards Inspiration'}
              onClick={() => update({ inspiration: !character.inspiration })}
            >
              <Icon name="star" size={16} filled={character.inspiration} />
              <span className={styles.muted}>Inspiration:</span> {character.inspiration ? 'yes' : 'not yet'}
            </button>
          </div>
        </section>

        <nav className={styles.panelButtons} aria-label="Panels">
          {PANEL_BUTTONS.map(({ label, icon, tab, title }) => (
            <button
              key={label}
              type="button"
              className={cx(styles.panelButton, tab && tab === sheetTab && styles.panelOpen)}
              title={title}
              disabled={!tab}
              onClick={() => tab && setSheetTab(sheetTab === tab ? null : tab)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <a className={styles.leave} href={href(`/c/${campaignId}`)}>
          Leave the table
        </a>
        {saveError && <Notice tone="error">{saveError}</Notice>}
        {table.error && <Notice tone="error">{table.error}</Notice>}
      </div>

      <CameraColumn members={members} characters={characters} online={online} myId={me.user_id} />

      {sheetTab && (
        <>
          <div className={styles.shade} aria-hidden="true" onClick={() => setSheetTab(null)} />
          <SheetPanel
            className={styles.sheet}
            character={character}
            canEdit
            editHref={href(`/c/${campaignId}/character/${character.id}/edit`)}
            tab={sheetTab}
            onTab={setSheetTab}
            onClose={() => setSheetTab(null)}
            closeLabel="Back to the table"
            onUpdate={update}
            rolls={rolls}
          />
        </>
      )}

      <div ref={attachTray} className={styles.tray} aria-hidden="true" />
      <RollToasts
        className={styles.toasts}
        rolls={table.shown}
        members={members}
        characters={characters}
        onDismiss={table.dismiss}
      />
    </main>
  )
}

type CameraColumnProps = {
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  myId: string
  className?: string
}

/** The camera column from the designs. Until cameras arrive (milestone 7) each tile shows who's here. */
export function CameraColumn({ members, characters, online, myId, className }: CameraColumnProps) {
  const ordered = [...members.filter((m) => m.role === 'dm'), ...members.filter((m) => m.role === 'player')]
  return (
    <div className={cx(styles.cameras, className)} aria-label="The table">
      {ordered.map((member) => {
        const character = characters.find((c) => c.ownerId === member.user_id)
        const here = online.has(member.user_id)
        const you = member.user_id === myId
        return (
          <div key={member.user_id} className={cx(styles.tile, you && styles.you)}>
            <div className={cx(styles.feed, here && styles.feedHere)}>
              <Icon name="camera" size={14} />
              <span>{here ? 'Here' : 'Not here yet'}</span>
            </div>
            <div className={styles.namePlate}>
              <div className={styles.plateText}>
                <div className={styles.plateName}>
                  {member.role === 'dm' ? member.display_name : (character?.name ?? member.display_name)}
                </div>
                <div className={styles.plateWho}>
                  {member.role === 'dm' ? 'Dungeon Master' : member.display_name}
                  {you && ' · you'}
                </div>
              </div>
              {character && member.role === 'player' && (
                <div className={styles.plateHp}>
                  <span>
                    {character.currentHp}/{character.maxHp}
                  </span>
                  <HpBar current={character.currentHp} max={character.maxHp} temp={character.tempHp} height={4} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
