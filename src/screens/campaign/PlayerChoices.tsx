import { href } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { Parchment } from '../../components/Parchment.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import { describeCharacter, type Character } from '../../rules/character.ts'
import styles from './PlayerChoices.module.css'

type PlayerChoicesProps = { campaignId: string; character?: Character }

/**
 * The player's half of the Join screen: their character card (or the button to create one), and
 * the character wizard card, which waits for Phase 2.
 */
export function PlayerChoices({ campaignId, character }: PlayerChoicesProps) {
  return (
    <div className={styles.cards}>
      {character ? (
        <Parchment className={styles.character}>
          <div className={styles.who}>
            <Portrait path={character.portraitPath} size={84} tone="parchment" name={character.name} />
            <div>
              <div className={styles.cardTitle}>{character.name}</div>
              <div className={styles.inkText}>{describeCharacter(character)}</div>
              {character.background && <div className={styles.inkNote}>{character.background}</div>}
            </div>
          </div>
          <div className={styles.stats}>
            <StatBox tone="parchment" label="HP" value={`${character.currentHp}/${character.maxHp}`} />
            <StatBox tone="parchment" label="AC" value={character.armourClass} />
            <StatBox tone="parchment" label="Level" value={character.level} />
            <StatBox tone="parchment" label="Speed" value={character.speed} />
          </div>
          <ButtonLink href={href(`/c/${campaignId}/play`)} variant="ink" className={styles.push}>
            Take your seat
          </ButtonLink>
          <ButtonLink href={href(`/c/${campaignId}/character/${character.id}/edit`)} variant="quietInk" className={styles.centre}>
            Edit character
          </ButtonLink>
        </Parchment>
      ) : (
        <Parchment className={styles.character}>
          <div className={styles.cardTitle}>Your character</div>
          <p className={styles.inkText}>
            Type in your character sheet: pick a race, class and background from the rules, type your scores, and the table
            works out every bonus for you.
          </p>
          <ButtonLink href={href(`/c/${campaignId}/character/new`)} variant="ink" className={styles.push}>
            Create your character
          </ButtonLink>
        </Parchment>
      )}

      <article className={styles.forge}>
        <div className={styles.cardTitle}>Forge a new character</div>
        <p className={styles.darkText}>
          A guided wizard with a plain-English explanation at every choice. It arrives after the first sessions; until
          then, use {character ? 'Edit character' : 'Create your character'}.
        </p>
        <ol className={styles.steps}>
          <li>Race and subrace</li>
          <li>Class</li>
          <li>Background</li>
          <li>Ability scores: standard set, point buy or rolled dice</li>
          <li>Starting equipment, picked as cards</li>
          <li>Spells, if your class casts them</li>
        </ol>
        <button type="button" className={buttonClassName('outline', { className: styles.push })} disabled>
          Start the wizard
        </button>
      </article>
    </div>
  )
}
