import { useEffect, useRef, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { GivingControls, Offer } from '../../live/giving.ts'
import type { Character, InventoryItem, Wallet } from '../../rules/character.ts'
import { attunedCount, ATTUNE_LIMIT } from '../../rules/magic.ts'
import { coinsFor, coinWords, readCoins } from '../../rules/money.ts'
import party from './PartyCards.module.css'
import styles from './ItemsTab.module.css'

type ItemsTabProps = {
  characters: Character[]
  giving: GivingControls
  onGive: (character: Character | null) => void
}

const QUICK = [1, 5, 10, 50, 100]

/**
 * Items and loot on Screen 1: every character's purse as coins, with one-click gold to add or take,
 * their pack with Offer to buy anything from them, and Give; then the party stash.
 */
export function ItemsTab({ characters, giving, onGive }: ItemsTabProps) {
  const { stash } = giving
  const stashEmpty = stash.items.length === 0 && coinWords(stash.wallet) === 'nothing'
  return (
    <div className={styles.tab}>
      <div className={party.grid}>
        {characters.map((character) => (
          <CharacterThings
            key={character.id}
            character={character}
            giving={giving}
            offers={giving.offers.filter((o) => o.characterId === character.id)}
            onGive={() => onGive(character)}
          />
        ))}
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
            <Purse wallet={stash.wallet} />
            <ul className={styles.pack}>
              {stash.items.map((i) => (
                <li key={i.id}>
                  {i.quantity > 1 && <span className={styles.count}>{i.quantity} ×</span>} {i.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

function CharacterThings({
  character,
  giving,
  offers,
  onGive,
}: {
  character: Character
  giving: GivingControls
  offers: Offer[]
  onGive: () => void
}) {
  const weight = character.inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0)
  const attuned = attunedCount(character.inventory)
  const [taking, setTaking] = useState(false)
  // Clicks add up for a moment, then go as one gift (or one payment), so the log isn't flooded.
  const [pending, setPending] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [offering, setOffering] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const latest = useRef({ pending: 0, taking: false })

  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), [])

  function quick(gp: number) {
    setProblem(null)
    const next = pending + gp
    setPending(next)
    latest.current = { pending: next, taking }
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const { pending: amount, taking: take } = latest.current
      setPending(0)
      latest.current = { pending: 0, taking: take }
      void (take ? giving.take(character.id, amount * 100) : giving.give(character.id, [], {}, amount * 100)).then(
        setProblem,
      )
    }, 1200)
  }

  const answered = offers.filter((o) => o.status === 'sold' || o.status === 'declined').slice(0, 2)

  return (
    <article className={party.card} aria-label={`${character.name}'s things`}>
      <div className={party.head}>
        <div className={party.who}>
          <div className={party.name}>{character.name}</div>
          <div className={party.player}>
            {weight} lb carried{attuned > 0 && ` · attuned ${attuned} of ${ATTUNE_LIMIT}`}
          </div>
        </div>
        <button type="button" className={party.action} onClick={onGive}>
          Give
        </button>
      </div>

      <Purse wallet={character.wallet} />
      <div className={styles.quick} role="group" aria-label={`Gold for ${character.name}`}>
        <button
          type="button"
          className={cx(styles.way, !taking && styles.wayOn)}
          aria-pressed={!taking}
          disabled={pending > 0}
          onClick={() => setTaking(false)}
        >
          Add
        </button>
        <button
          type="button"
          className={cx(styles.way, taking && styles.wayOn)}
          aria-pressed={taking}
          disabled={pending > 0}
          onClick={() => setTaking(true)}
        >
          Take
        </button>
        {QUICK.map((gp) => (
          <button
            key={gp}
            type="button"
            className={styles.coinButton}
            aria-label={`${taking ? 'Take' : 'Add'} ${gp} gp`}
            onClick={() => quick(gp)}
          >
            {taking ? '−' : '+'}
            {gp}
          </button>
        ))}
        {pending > 0 && (
          <span className={styles.pending} role="status">
            {taking ? 'Taking' : 'Adding'} {pending} gp…
          </span>
        )}
      </div>
      {problem && <p className={styles.problem}>{problem}</p>}

      {character.inventory.length === 0 ? (
        <p className={styles.nothing}>Carrying nothing.</p>
      ) : (
        <ul className={styles.things}>
          {character.inventory.map((item) => {
            const open = offers.find((o) => o.itemId === item.id && o.status === 'open')
            return (
              <li key={item.id}>
                <span className={item.magic ? styles.magic : undefined}>
                  {item.quantity > 1 && <span className={styles.count}>{item.quantity} ×</span>} {item.name}
                  {item.worn && <span className={styles.tag}>worn</span>}
                  {item.attuned && <span className={styles.tag}>attuned</span>}
                </span>
                {open ? (
                  <span className={styles.offered}>
                    Offered {coinWords(coinsFor(open.copper))}, waiting{' '}
                    <button type="button" className={styles.link} onClick={() => void giving.withdraw(open.id)}>
                      Take it back
                    </button>
                  </span>
                ) : offering === item.id ? (
                  <OfferForm
                    item={item}
                    onOffer={async (quantity, copper) => {
                      const result = await giving.offer(character.id, item.id, quantity, copper)
                      setProblem(result)
                      if (!result) setOffering(null)
                    }}
                    onCancel={() => setOffering(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className={styles.offer}
                    aria-label={`Offer to buy ${item.name}`}
                    onClick={() => setOffering(item.id)}
                  >
                    Offer
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {answered.map((o) => (
        <p key={o.id} className={styles.answer}>
          {o.status === 'sold'
            ? `${character.name} sold ${o.quantity > 1 ? `${o.quantity} × ` : ''}${o.itemName} for ${coinWords(coinsFor(o.copper))}.`
            : `${character.name} said no to ${coinWords(coinsFor(o.copper))} for ${o.itemName}.`}
        </p>
      ))}
    </article>
  )
}

function OfferForm({
  item,
  onOffer,
  onCancel,
}: {
  item: InventoryItem
  onOffer: (quantity: number, copper: number) => Promise<void>
  onCancel: () => void
}) {
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState(1)
  const copper = readCoins(price)
  return (
    <form
      className={styles.offerForm}
      aria-label={`Offer for ${item.name}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (copper !== null) void onOffer(quantity, copper)
      }}
    >
      {item.quantity > 1 && (
        <input
          type="number"
          min={1}
          max={item.quantity}
          value={quantity}
          aria-label="How many"
          onChange={(e) => setQuantity(Math.max(1, Math.min(item.quantity, Math.floor(Number(e.target.value) || 1))))}
        />
      )}
      <input
        autoFocus
        value={price}
        placeholder="gp"
        aria-label="How much you'll pay"
        className={styles.price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <button type="submit" className={styles.offer} disabled={copper === null}>
        Offer
      </button>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

const COIN_ORDER: { key: keyof Wallet; name: string }[] = [
  { key: 'pp', name: 'platinum' },
  { key: 'gp', name: 'gold' },
  { key: 'ep', name: 'electrum' },
  { key: 'sp', name: 'silver' },
  { key: 'cp', name: 'copper' },
]

/** A purse drawn as coins, one of each kind held, with how many. */
export function Purse({ wallet }: { wallet: Wallet }) {
  const held = COIN_ORDER.filter((c) => wallet[c.key] > 0)
  return (
    <div className={styles.purse} aria-label={`Coins: ${coinWords(wallet)}`}>
      {held.length === 0 ? (
        <span className={styles.nothing}>No coins</span>
      ) : (
        held.map((c) => (
          <span key={c.key} className={styles.coin} title={`${wallet[c.key]} ${c.name}`}>
            <span className={cx(styles.disc, styles[c.key])} aria-hidden="true">
              {c.key}
            </span>
            <span className={styles.coinCount}>{wallet[c.key]}</span>
          </span>
        ))
      )}
    </div>
  )
}
