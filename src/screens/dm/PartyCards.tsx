import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { HpBar } from '../../components/HpBar.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import type { Member } from '../../live/campaigns.ts'
import type { Character } from '../../rules/character.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { findCondition } from '../../rules/srd/index.ts'
import { SheetLink } from '../../components/SheetLink.tsx'
import { ConcentrationChip, SlotPips } from '../fight/SpellParts.tsx'
import type { Combatant } from '../../live/combat.ts'
import type { AskInput } from '../../live/rollRequests.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { spellSummary } from '../../rules/spells.ts'
import type { SrdSpell } from '../../rules/srd/index.ts'
import { attacksPerAction } from '../../rules/turn.ts'
import { TurnPips } from '../fight/TurnParts.tsx'
import { levelWords, srdSpellFor } from '../fight/useCasting.ts'
import { QuickChecks } from './QuickChecks.tsx'
import styles from './PartyCards.module.css'

type PartyCardsProps = {
  campaignId: string
  members: Member[]
  characters: Character[]
  onOpenSheet: (character: Character) => void
  onAsk: (character: Character) => void
  onHitPoints: (character: Character, change: HitPointChange, amount: number) => void
  /** The quick checks along the top: sends a roll to everyone ticked. */
  onQuickCheck?: (input: AskInput) => Promise<boolean>
  quickError?: string | null
  /** The SRD spells, for what each of a caster's spells does. */
  spells?: SrdSpell[] | null
  /** In a fight: who's in it, for what's left of each character's turn. */
  combatants?: Combatant[]
}

export type HitPointChange = 'damage' | 'heal' | 'temp'

/** The Party tab from design 07: a card per character with what the DM glances at most. */
export function PartyCards({
  campaignId,
  members,
  characters,
  onOpenSheet,
  onAsk,
  onHitPoints,
  onQuickCheck,
  quickError = null,
  spells = null,
  combatants = [],
}: PartyCardsProps) {
  const [hpFor, setHpFor] = useState<string | null>(null)
  // Who the quick checks go to: those here tonight, until the DM ticks otherwise.
  const [ticked, setTicked] = useState<string[] | null>(null)
  const [amount, setAmount] = useState('')
  const value = Math.max(0, Math.trunc(Number(amount)) || 0)
  const players = members.filter((member) => member.role === 'player')
  const cards = players.flatMap((member) => {
    const character = characters.find((c) => c.ownerId === member.user_id)
    return character ? [{ member, character }] : []
  })

  const here = cards.filter(({ member }) => member.here_tonight).map(({ character }) => character.id)
  const chosen = (ticked ?? here).filter((id) => cards.some(({ character }) => character.id === id))
  const tick = (id: string) => setTicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])

  if (cards.length === 0) {
    return (
      <p className={styles.empty}>
        No characters yet. Once your players have made theirs on the Join screen, their cards appear here.
      </p>
    )
  }

  return (
    <div className={styles.tab}>
      {onQuickCheck && <QuickChecks characterIds={chosen} onSend={onQuickCheck} error={quickError} />}
      <div className={styles.grid}>
        {cards.map(({ member, character }) => {
          const combatant = combatants.find((c) => c.characterId === character.id)
          const who = [
            [character.className, character.level].filter(Boolean).join(' '),
            // "Hill Dwarf", not "Hill Dwarf Dwarf".
            character.subrace && character.subrace.toLowerCase().includes(character.race.toLowerCase())
              ? character.subrace
              : [character.subrace, character.race].filter(Boolean).join(' '),
            character.background,
          ].filter(Boolean)
          const sheet = deriveSheet(character)
          const slotsMax = character.spellcasting.slotsMax.reduce((sum, n) => sum + n, 0)
          const slotsLeft = slotsMax - character.spellcasting.slotsUsed.reduce((sum, n) => sum + n, 0)
          return (
            <article key={character.id} className={styles.card} aria-label={character.name}>
              <div className={styles.head}>
                {onQuickCheck && (
                  <input
                    type="checkbox"
                    className={styles.tick}
                    checked={chosen.includes(character.id)}
                    aria-label={`${character.name} rolls the quick check`}
                    title="Rolls the quick check"
                    onChange={() => tick(character.id)}
                  />
                )}
                <Portrait path={character.portraitPath} size={48} name={character.name} />
                <div className={styles.who}>
                  <div className={styles.name}>{character.name}</div>
                  <div className={styles.player}>
                    {member.display_name}
                    {who.length > 0 && ` · ${who.join(' · ')}`}
                  </div>
                </div>
                <div className={styles.hp}>
                  {character.currentHp}/{character.maxHp}
                  {character.tempHp > 0 && <span className={styles.temp}> +{character.tempHp}</span>}
                </div>
              </div>
              <HpBar current={character.currentHp} max={character.maxHp} temp={character.tempHp} height={6} />
              <div className={styles.chips}>
                <span className={styles.chip}>AC {character.armourClass}</span>
                <span className={styles.chip} title="Passive Perception: they notice anything this hard or easier">
                  Notices {sheet.passivePerception}+
                </span>
                {slotsMax > 0 && (
                  <span className={styles.chip}>
                    Spells left: {slotsLeft} of {slotsMax}
                  </span>
                )}
                {character.inspiration && <span className={styles.chip}>Inspired</span>}
                {character.conditions.map((condition) => (
                  <span key={condition} className={styles.condition} title={findCondition(condition)?.desc}>
                    {findCondition(condition)?.name ?? condition}
                  </span>
                ))}
                {character.exhaustion > 0 && (
                  <span className={styles.condition}>Exhaustion {character.exhaustion}</span>
                )}
                {character.currentHp === 0 && (
                  <span className={styles.condition}>
                    {character.dead ? 'Dead' : character.stable ? 'Stable' : 'Dying'} · {character.deathSaveSuccesses}{' '}
                    saved, {character.deathSaveFailures} failed
                  </span>
                )}
              </div>
              {character.effects.length > 0 && (
                <div className={styles.chips}>
                  {character.effects.map((effect) => (
                    <span key={effect.key} className={styles.effect}>
                      {effect.name}
                    </span>
                  ))}
                </div>
              )}
              {combatant && (
                <div className={styles.turn}>
                  <TurnPips
                    turn={combatant.turn}
                    perAction={attacksPerAction(character.className, character.level)}
                    speed={character.speed}
                  />
                </div>
              )}
              {slotsMax > 0 && <SlotPips spellcasting={character.spellcasting} />}
              <ConcentrationChip character={character} />
              <MoreAbout character={character} spells={spells} />
              {hpFor === character.id && (
                <form
                  className={styles.hpRow}
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (value > 0) onHitPoints(character, 'damage', value)
                    setAmount('')
                  }}
                >
                  <input
                    className={styles.hpInput}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    aria-label={`Hit points for ${character.name}`}
                    placeholder="0"
                    autoFocus
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <button type="submit" className={cx(styles.action, styles.damage)} disabled={!value}>
                    Damage
                  </button>
                  <button
                    type="button"
                    className={cx(styles.action, styles.heal)}
                    disabled={!value}
                    onClick={() => {
                      onHitPoints(character, 'heal', value)
                      setAmount('')
                    }}
                  >
                    Heal
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    disabled={!value}
                    title="Temporary hit points don't stack: they keep the higher amount"
                    onClick={() => {
                      onHitPoints(character, 'temp', value)
                      setAmount('')
                    }}
                  >
                    Temp
                  </button>
                  <SheetLink
                    campaignId={campaignId}
                    characterId={character.id}
                    className={styles.linkish}
                    onOpen={() => onOpenSheet(character)}
                    title="Cmd or Ctrl click to open it in a new tab"
                  >
                    Sheet
                  </SheetLink>
                </form>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={cx(styles.action, hpFor === character.id && styles.actionOn)}
                  aria-expanded={hpFor === character.id}
                  onClick={() => {
                    setAmount('')
                    setHpFor(hpFor === character.id ? null : character.id)
                  }}
                >
                  Damage or heal
                </button>
                <button type="button" className={styles.action} onClick={() => onAsk(character)}>
                  Ask to roll
                </button>
                <button type="button" className={styles.action} disabled title="Giving items arrives in Phase 2">
                  Give item
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

/** The accordion on a party card: attacks, spells, features, and what else is on the sheet. */
function MoreAbout({ character, spells }: { character: Character; spells: SrdSpell[] | null }) {
  const sheet = deriveSheet(character)
  const known = character.spellcasting.spells
    .flatMap((entry) => {
      const spell = srdSpellFor(entry, spells)
      return entry.prepared || entry.level === 0 ? [{ entry, spell }] : []
    })
    .sort((a, b) => a.entry.level - b.entry.level)
  return (
    <details className={styles.more}>
      <summary>Attacks, spells and features</summary>
      {sheet.attacks.length > 0 && (
        <div className={styles.moreSection}>
          <div className={styles.moreTitle}>Attacks</div>
          {sheet.attacks.map(({ entry, result }) => (
            <div key={entry.id} className={styles.moreLine}>
              <strong>{entry.name || 'Attack'}</strong> {formatBonus(result.toHit)} to hit, {result.damage}{' '}
              {result.damageType.toLowerCase()}
            </div>
          ))}
        </div>
      )}
      {known.length > 0 && (
        <div className={styles.moreSection}>
          <div className={styles.moreTitle}>
            Spells{sheet.spell && ` · save DC ${sheet.spell.saveDc}, ${formatBonus(sheet.spell.attackBonus)} to hit`}
          </div>
          {known.map(({ entry, spell }) => (
            <div key={entry.id} className={styles.moreLine} title={spell?.desc}>
              <strong>{entry.name}</strong> {levelWords(entry.level)}
              {spell && ` · ${spellSummary(spell, character) || spell.castingTime}`}
              {spell?.concentration && ' · concentration'}
            </div>
          ))}
        </div>
      )}
      {character.features.length > 0 && (
        <div className={styles.moreSection}>
          <div className={styles.moreTitle}>Features and traits</div>
          {character.features.map((feature) => (
            <div key={feature.id} className={styles.moreLine} title={feature.description}>
              <strong>{feature.name}</strong>
              {feature.usesMax !== null && ` · ${feature.usesLeft} of ${feature.usesMax} left`}
            </div>
          ))}
        </div>
      )}
      <div className={styles.moreSection}>
        <div className={styles.moreTitle}>Also on the sheet</div>
        {character.languages && <div className={styles.moreLine}>Languages: {character.languages}</div>}
        {character.otherProficiencies && (
          <div className={styles.moreLine}>Proficiencies: {character.otherProficiencies}</div>
        )}
        <div className={styles.moreLine}>
          Speed {character.speed} ft · hit dice {sheet.hitDice.left} of {sheet.hitDice.total} (d{sheet.hitDice.die})
        </div>
        <p className={styles.later}>
          Backstory (age, looks, goals), gear and money arrive with the character builder and items.
        </p>
      </div>
    </details>
  )
}
