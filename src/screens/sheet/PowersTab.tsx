import { useState } from 'react'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { Pips } from '../../components/Pips.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import type { TrackerPatch } from '../../live/characterRows.ts'
import { useSrd } from '../../live/useSrd.ts'
import { ABILITY_NAME } from '../../rules/abilities.ts'
import type { Character, FeatureEntry, SpellEntry } from '../../rules/character.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { changeSlots, resetSlots, spellCountsFor } from '../../rules/spellbook.ts'
import { spellLevelName } from '../../rules/spellLevels.ts'
import { slotsFor } from '../../rules/srd/defaults.ts'
import { byName, loadClasses, loadSpells, type SrdSpell } from '../../rules/srd/index.ts'
import { Section } from './SheetTab.tsx'
import { Spellbook } from './Spellbook.tsx'
import styles from './sheet.module.css'

type TabProps = { character: Character; canEdit: boolean; onUpdate: (patch: TrackerPatch) => void }

const RECHARGE = { short: 'Back after a short or long rest', long: 'Back after a long rest' }

/** Features with their uses, then spellcasting: slots, concentration and the spell list. */
export function PowersTab({ character, canEdit, onUpdate }: TabProps) {
  const sheet = deriveSheet(character)
  const spells = useSrd(loadSpells)
  const classes = useSrd(loadClasses)
  const cls = classes ? byName(classes, character.className) : undefined
  const [changingSlots, setChangingSlots] = useState(false)
  const { spellcasting } = character
  const edit = canEdit ? onUpdate : undefined
  const counts = cls ? spellCountsFor(character, cls) : []
  const classSlots = cls?.spellcastingAbility ? slotsFor(cls, character.level) : null
  const slotsDiffer = classSlots !== null && classSlots.some((n, i) => n !== spellcasting.slotsMax[i])

  const setFeatureUses = (feature: FeatureEntry, usesLeft: number) =>
    edit?.({ features: character.features.map((f) => (f.id === feature.id ? { ...f, usesLeft } : f)) })

  const setSlotsLeft = (index: number, left: number) =>
    edit?.({
      spellcasting: {
        ...spellcasting,
        slotsUsed: spellcasting.slotsUsed.map((used, i) => (i === index ? spellcasting.slotsMax[i] - left : used)),
      },
    })

  const levels = [...new Set(spellcasting.spells.map((s) => s.level))].sort((a, b) => a - b)
  const findSrd = (spell: SpellEntry) => (spell.index ? spells?.find((s) => s.index === spell.index) : undefined)
  const concentrationSpells = spellcasting.spells.filter((s) => findSrd(s)?.concentration)

  return (
    <div className={styles.powersColumns}>
      <div className={styles.column}>
        <Section title="Features and traits">
          {character.features.length === 0 ? (
            <p className={styles.empty}>
              No features yet. Add your class features and racial traits with Edit character.
            </p>
          ) : (
            <ul className={styles.cards}>
              {character.features.map((feature) => (
                <li key={feature.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardName}>{feature.name}</span>
                    {feature.usesMax !== null && (
                      <Pips
                        label={`${feature.name} uses left`}
                        total={feature.usesMax}
                        filled={feature.usesLeft}
                        onChange={edit && ((left) => setFeatureUses(feature, left))}
                      />
                    )}
                  </div>
                  {feature.recharge && <div className={styles.muted}>{RECHARGE[feature.recharge]}</div>}
                  {feature.description && (
                    <details className={styles.details}>
                      <summary>What it does</summary>
                      <p className={styles.prose}>{feature.description}</p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className={styles.column}>
        <Section title="Spellcasting">
          {sheet.spell ? (
            <div className={styles.statRow}>
              <StatBox label="Ability" value={ABILITY_NAME[sheet.spell.ability].slice(0, 3).toUpperCase()} />
              <StatBox label="Save DC" value={sheet.spell.saveDc} title="Spell save DC" />
              <StatBox label="Attack" value={formatBonus(sheet.spell.attackBonus)} title="Spell attack bonus" />
            </div>
          ) : (
            <p className={styles.empty}>
              No spellcasting. If your character casts spells, set it up with Edit character.
            </p>
          )}
          {(spellcasting.slotsMax.some((max) => max > 0) || changingSlots) && (
            <ul className={styles.rows}>
              {spellcasting.slotsMax.map((max, i) =>
                max > 0 || changingSlots ? (
                  <li key={i} className={styles.row}>
                    <span className={styles.rowName}>{spellLevelName(i + 1)} slots</span>
                    {changingSlots && edit && (
                      <span className={styles.slotSteps}>
                        <button
                          type="button"
                          className={styles.slotStep}
                          aria-label={`One fewer ${spellLevelName(i + 1)} slot`}
                          disabled={max === 0}
                          onClick={() => edit({ spellcasting: changeSlots(spellcasting, i, -1) })}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className={styles.slotStep}
                          aria-label={`One more ${spellLevelName(i + 1)} slot`}
                          disabled={max === 9}
                          onClick={() => edit({ spellcasting: changeSlots(spellcasting, i, 1) })}
                        >
                          +
                        </button>
                      </span>
                    )}
                    {max > 0 ? (
                      <Pips
                        label={`${spellLevelName(i + 1)} slots left`}
                        total={max}
                        filled={max - spellcasting.slotsUsed[i]}
                        onChange={edit && ((left) => setSlotsLeft(i, left))}
                      />
                    ) : (
                      <span className={styles.muted}>None</span>
                    )}
                  </li>
                ) : null,
              )}
            </ul>
          )}
          {edit && (sheet.spell || spellcasting.slotsMax.some((max) => max > 0)) && (
            <div className={styles.slotActions}>
              <button
                type="button"
                className={buttonClassName('quiet')}
                aria-pressed={changingSlots}
                onClick={() => setChangingSlots((on) => !on)}
              >
                {changingSlots ? 'Done changing slots' : 'Change how many slots'}
              </button>
              {slotsDiffer && classSlots && (
                <button
                  type="button"
                  className={buttonClassName('quiet')}
                  title={`Back to a level ${character.level} ${cls?.name}'s slots`}
                  onClick={() => edit({ spellcasting: resetSlots(spellcasting, classSlots) })}
                >
                  Reset to my class
                </button>
              )}
            </div>
          )}
          <div className={styles.concentration}>
            {character.concentration ? (
              <>
                <span>
                  <span className={styles.muted}>Concentrating on</span> <strong>{character.concentration}</strong>
                </span>
                {edit && (
                  <button
                    type="button"
                    className={buttonClassName('quiet')}
                    onClick={() => edit({ concentration: null })}
                  >
                    Stop concentrating
                  </button>
                )}
              </>
            ) : (
              <>
                <span className={styles.muted}>Not concentrating on a spell.</span>
                {edit && concentrationSpells.length > 0 && (
                  <select
                    className={styles.addSelect}
                    aria-label="Start concentrating on a spell"
                    value=""
                    onChange={(event) => event.target.value && edit({ concentration: event.target.value })}
                  >
                    <option value="">Start concentrating on…</option>
                    {concentrationSpells.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        </Section>

        {levels.length > 0 && (
          <Section title="Your spells" note={spells ? undefined : 'Loading spell details…'}>
            {counts.length > 0 && (
              <p className={styles.spellCounts}>
                {counts.map((c) => (
                  <span key={c.label} className={c.over ? styles.over : undefined}>
                    {c.label} {c.have} of {c.of}
                  </span>
                ))}
              </p>
            )}
            {levels.map((level) => (
              <div key={level} className={styles.spellLevel}>
                <h4 className={styles.spellLevelName}>{spellLevelName(level)}</h4>
                <ul className={styles.cards}>
                  {spellcasting.spells
                    .filter((spell) => spell.level === level)
                    .map((spell) => (
                      <SpellCard
                        key={spell.id}
                        spell={spell}
                        srd={findSrd(spell)}
                        onTogglePrepared={
                          edit && level > 0
                            ? () =>
                                edit({
                                  spellcasting: {
                                    ...spellcasting,
                                    spells: spellcasting.spells.map((s) =>
                                      s.id === spell.id ? { ...s, prepared: !s.prepared } : s,
                                    ),
                                  },
                                })
                            : undefined
                        }
                      />
                    ))}
                </ul>
              </div>
            ))}
          </Section>
        )}

        <Spellbook
          character={character}
          cls={cls}
          spells={spells}
          onChange={edit && ((next) => edit({ spellcasting: next }))}
        />
      </div>
    </div>
  )
}

function SpellCard({
  spell,
  srd,
  onTogglePrepared,
}: {
  spell: SpellEntry
  srd?: SrdSpell
  onTogglePrepared?: () => void
}) {
  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardName}>
          {spell.name}
          {srd?.concentration && <span className={styles.tag}>Concentration</span>}
          {srd?.ritual && <span className={styles.tag}>Ritual</span>}
        </span>
        {spell.level > 0 &&
          (onTogglePrepared ? (
            <label className={styles.prepared}>
              <input type="checkbox" checked={spell.prepared} onChange={onTogglePrepared} /> Prepared
            </label>
          ) : (
            spell.prepared && <span className={styles.muted}>Prepared</span>
          ))}
      </div>
      {srd && (
        <details className={styles.details}>
          <summary>
            {srd.castingTime} · {srd.range} · {srd.duration}
          </summary>
          <p className={styles.muted}>
            {srd.school} · Components: {srd.components}
          </p>
          <p className={styles.prose}>{srd.desc}</p>
          {srd.higherLevel && <p className={styles.prose}>{srd.higherLevel}</p>}
        </details>
      )}
    </li>
  )
}
