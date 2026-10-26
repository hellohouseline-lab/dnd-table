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
import styles from './PartyCards.module.css'

type PartyCardsProps = {
  campaignId: string
  members: Member[]
  characters: Character[]
  onOpenSheet: (character: Character) => void
  onAsk: (character: Character) => void
  onHitPoints: (character: Character, change: HitPointChange, amount: number) => void
}

export type HitPointChange = 'damage' | 'heal' | 'temp'

/** The Party tab from design 07: a card per character with what the DM glances at most. */
export function PartyCards({ campaignId, members, characters, onOpenSheet, onAsk, onHitPoints }: PartyCardsProps) {
  const [hpFor, setHpFor] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const value = Math.max(0, Math.trunc(Number(amount)) || 0)
  const players = members.filter((member) => member.role === 'player')
  const cards = players.flatMap((member) => {
    const character = characters.find((c) => c.ownerId === member.user_id)
    return character ? [{ member, character }] : []
  })

  if (cards.length === 0) {
    return (
      <p className={styles.empty}>
        No characters yet. Once your players have made theirs on the Join screen, their cards appear here.
      </p>
    )
  }

  return (
    <div className={styles.grid}>
      {cards.map(({ member, character }) => {
        const sheet = deriveSheet(character)
        const slotsMax = character.spellcasting.slotsMax.reduce((sum, n) => sum + n, 0)
        const slotsLeft = slotsMax - character.spellcasting.slotsUsed.reduce((sum, n) => sum + n, 0)
        return (
          <article key={character.id} className={styles.card} aria-label={character.name}>
            <div className={styles.head}>
              <Portrait path={character.portraitPath} size={48} name={character.name} />
              <div className={styles.who}>
                <div className={styles.name}>{character.name}</div>
                <div className={styles.player}>{member.display_name}</div>
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
              {character.exhaustion > 0 && <span className={styles.condition}>Exhaustion {character.exhaustion}</span>}
              {character.currentHp === 0 && (
                <span className={styles.condition}>
                  {character.dead ? 'Dead' : character.stable ? 'Stable' : 'Dying'} · {character.deathSaveSuccesses}{' '}
                  saved, {character.deathSaveFailures} failed
                </span>
              )}
            </div>
            {slotsMax > 0 && <SlotPips spellcasting={character.spellcasting} />}
            <ConcentrationChip character={character} />
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
  )
}
