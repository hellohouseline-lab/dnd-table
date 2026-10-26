import { cx } from '../../components/cx.ts'
import type { PartyStash } from '../../live/giving.ts'
import type { Character, InventoryItem } from '../../rules/character.ts'
import { attunedCount, ATTUNE_LIMIT } from '../../rules/magic.ts'
import { coinWords } from '../../rules/money.ts'
import party from './PartyCards.module.css'
import styles from './ItemsTab.module.css'

type ItemsTabProps = {
  characters: Character[]
  stash: PartyStash
  onGive: (character: Character | null) => void
}

/**
 * Items and loot on Screen 1: every character's pack and purse side by side (who has the rope?),
 * with Give on each, and the party stash.
 */
export function ItemsTab({ characters, stash, onGive }: ItemsTabProps) {
  const stashEmpty = stash.items.length === 0 && coinWords(stash.wallet) === 'nothing'
  return (
    <div className={styles.tab}>
      <div className={party.grid}>
        {characters.map((character) => {
          const weight = character.inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0)
          const attuned = attunedCount(character.inventory)
          return (
            <article key={character.id} className={party.card} aria-label={`${character.name}'s things`}>
              <div className={party.head}>
                <div className={party.who}>
                  <div className={party.name}>{character.name}</div>
                  <div className={party.player}>
                    {coinWords(character.wallet)} · {weight} lb
                    {attuned > 0 && ` · attuned ${attuned} of ${ATTUNE_LIMIT}`}
                  </div>
                </div>
                <button type="button" className={party.action} onClick={() => onGive(character)}>
                  Give
                </button>
              </div>
              <Pack items={character.inventory} />
            </article>
          )
        })}
        {characters.length === 0 && <p className={party.empty}>Nobody has a character yet.</p>}
      </div>

      <section className={cx(party.card, styles.stash)} aria-label="Party stash">
        <div className={party.head}>
          <div className={party.who}>
            <div className={party.name}>Party stash</div>
            <div className={party.player}>Shared by everyone. Coins that wouldn&rsquo;t split land here.</div>
          </div>
        </div>
        {stashEmpty ? (
          <p className={party.empty}>Empty.</p>
        ) : (
          <>
            <p className={styles.coins}>{coinWords(stash.wallet)}</p>
            <Pack items={stash.items} />
          </>
        )}
      </section>
    </div>
  )
}

function Pack({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) return <p className={styles.nothing}>Carrying nothing.</p>
  return (
    <ul className={styles.pack}>
      {items.map((i) => (
        <li key={i.id} className={i.magic ? styles.magic : undefined}>
          {i.quantity > 1 && <span className={styles.count}>{i.quantity} ×</span>} {i.name}
          {i.worn && <span className={styles.tag}>worn</span>}
          {i.attuned && <span className={styles.tag}>attuned</span>}
        </li>
      ))}
    </ul>
  )
}
