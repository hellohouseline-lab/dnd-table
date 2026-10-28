import { href } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { Parchment } from '../../components/Parchment.tsx'
import { Portrait } from '../../components/Portrait.tsx'
import { StatBox } from '../../components/StatBox.tsx'
import { describeCharacter, type Character } from '../../rules/character.ts'
import styles from './PlayerChoices.module.css'

type PlayerChoicesProps = { campaignId: string; character?: Character }

/**
 * The player's half of the Join screen: their character card, or the builder to make one, with the
 * plain form beside it for anyone typing in a sheet they already have.
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
          <ButtonLink
            href={href(`/c/${campaignId}/character/${character.id}/edit`)}
            variant="quietInk"
            className={styles.centre}
          >
            Edit character
          </ButtonLink>
        </Parchment>
      ) : (
        <Parchment className={styles.character}>
          <div className={styles.cardTitle}>Your character</div>
          <p className={styles.inkText}>
            Make your character step by step, with a plain-English explanation at every choice. The table works out
            every bonus for you.
          </p>
          <ol className={styles.inkSteps}>
            <li>Race and subrace</li>
            <li>Class</li>
            <li>Background</li>
            <li>Ability scores: standard set, point buy or rolled dice</li>
            <li>Starting equipment, picked as cards</li>
            <li>Spells, if your class casts them</li>
          </ol>
          <ButtonLink href={href(`/c/${campaignId}/character/new`)} variant="ink" className={styles.push}>
            Create your character
          </ButtonLink>
        </Parchment>
      )}

      {!character && (
        <article className={styles.forge}>
          <div className={styles.cardTitle}>Already have a character sheet?</div>
          <p className={styles.darkText}>
            Type it in from paper or another app: pick a race, class and background from the rules, type your scores,
            and the table works out every bonus for you.
          </p>
          <ButtonLink href={href(`/c/${campaignId}/character/new/form`)} variant="outline" className={styles.push}>
            Type in your sheet
          </ButtonLink>
        </article>
      )}
    </div>
  )
}
