import { HpBar } from '../../components/HpBar.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import type { Member } from '../../live/campaigns.ts'
import type { Character } from '../../rules/character.ts'
import { deriveSheet } from '../../rules/sheet.ts'
import { findCondition } from '../../rules/srd/index.ts'
import styles from './PartyCards.module.css'

type PartyCardsProps = {
  members: Member[]
  characters: Character[]
  onOpenSheet: (character: Character) => void
  onAsk: (character: Character) => void
}

/** The Party tab from design 07: a card per character with what the DM glances at most. */
export function PartyCards({ members, characters, onOpenSheet, onAsk }: PartyCardsProps) {
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
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.action} onClick={() => onOpenSheet(character)}>
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
