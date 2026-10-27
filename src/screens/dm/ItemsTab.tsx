import { useEffect, useRef, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { GivingControls, Offer } from '../../live/giving.ts'
import type { ShopControls } from '../../live/shops.ts'
import type { Shop } from '../../rules/shops.ts'
import type { Character, InventoryItem, Wallet } from '../../rules/character.ts'
import { attunedCount, ATTUNE_LIMIT } from '../../rules/magic.ts'
import { coinsFor, coinWords, readCoins } from '../../rules/money.ts'
import type { SrdEquipment, SrdMagicItem } from '../../rules/srd/index.ts'
import { marketValue, priceVerdict, valueWords, type Value } from '../../rules/value.ts'
import party from './PartyCards.module.css'
import styles from './ItemsTab.module.css'

type ItemsTabProps = {
  characters: Character[]
  giving: GivingControls
  onGive: (character: Character | null) => void
  onOpenBox: () => void
  shops: ShopControls
  /** Opens the shop editor: a shop to change, or null to make one. */
  onShop: (shop: Shop | null) => void
  /** For what things are worth (only the DM sees it). */
  equipment: SrdEquipment | null
  magicItems: SrdMagicItem[] | null
}

const VERDICT_WORDS = { cheap: 'that’s cheap', fair: 'that’s fair', pricey: 'that’s pricey' }

const QUICK = [1, 5, 10, 50, 100]

/**
 * Items and loot on Screen 1: every character's purse as coins, with one-click gold to add or take,
 * their pack with Offer to buy anything from them, and Give; then the party stash.
 */
export function ItemsTab({
  characters,
  giving,
  onGive,
  onOpenBox,
  shops,
  onShop,
  equipment,
  magicItems,
}: ItemsTabProps) {
  const { stash } = giving
  const [stashProblem, setStashProblem] = useState<string | null>(null)
  const worth = (item: InventoryItem) => (equipment ? marketValue(item, equipment, magicItems) : null)
  const stashEmpty = stash.items.length === 0 && coinWords(stash.wallet) === 'nothing'
  return (
    <div className={styles.tab}>
      <div className={styles.top}>
        <button type="button" className={styles.openBox} onClick={onOpenBox}>
          Open a box
        </button>
        <span className={styles.topNote}>A chest, a sack, a body, a desk or a hoard: the table fills it for you.</span>
      </div>

      <section className={cx(party.card, styles.stash)} aria-label="Shops">
        <div className={party.head}>
          <div className={party.who}>
            <div className={party.name}>Shops</div>
            <div className={party.player}>Open one and players can buy and sell on their own screens.</div>
          </div>
          <button type="button" className={party.action} onClick={() => onShop(null)}>
            Make a shop
          </button>
        </div>
        {shops.shops.length === 0 ? (
          <p className={styles.nothing}>No shops yet.</p>
        ) : (
          <ul className={styles.shopList}>
            {shops.shops.map((shop) => (
              <li key={shop.id}>
                <span>
                  <strong>{shop.name}</strong>
                  {shop.keeper && <span className={styles.count}> · {shop.keeper}</span>}
                  <span className={styles.count}> · {shop.stock.length} things</span>
                </span>
                <span className={styles.shopButtons}>
                  <button
                    type="button"
                    className={cx(styles.way, shop.open && styles.wayOn)}
                    aria-pressed={shop.open}
                    aria-label={`${shop.open ? 'Close' : 'Open'} ${shop.name}`}
                    onClick={() => void shops.setOpen(shop.id, !shop.open)}
                  >
                    {shop.open ? 'Open' : 'Closed'}
                  </button>
                  <button type="button" className={styles.offer} onClick={() => onShop(shop)}>
                    Change
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {shops.sales.length > 0 && (
          <ul className={styles.sales} aria-label="Sales">
            {shops.sales.slice(0, 8).map((sale) => {
              const who = characters.find((c) => c.id === sale.characterId)?.name ?? 'Someone'
              const what = sale.item
                ? `${sale.item.quantity > 1 ? `${sale.item.quantity} × ` : ''}${sale.item.name}`
                : 'something'
              return (
                <li key={sale.id} className={sale.undone ? styles.undone : undefined}>
                  {who} {sale.kind === 'buy' ? 'bought' : 'sold'} {what} for {coinWords(coinsFor(sale.copper))}
                  {sale.undone ? (
                    <span className={styles.tag}>undone</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => void shops.undo(sale.id).then((problem) => problem && window.alert(problem))}
                    >
                      Undo
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <label className={styles.setting}>
          <input
            type="checkbox"
            checked={shops.playersAddGear}
            onChange={(e) => void shops.setPlayersAddGear(e.target.checked)}
          />
          Players can add gear for free on Change your character
        </label>
      </section>
      <div className={party.grid}>
        {characters.map((character) => (
          <CharacterThings
            key={character.id}
            character={character}
            giving={giving}
            offers={giving.offers.filter((o) => o.characterId === character.id)}
            onGive={() => onGive(character)}
            worth={worth}
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
          {!stashEmpty && (
            <button
              type="button"
              className={party.action}
              onClick={() => {
                if (window.confirm('Clear the party stash? Everything in it, coins too, is gone.'))
                  void giving.clearStash()
              }}
            >
              Clear the stash
            </button>
          )}
        </div>
        <QuickCoins
          label="Gold in the party stash"
          onApply={(gp, take) => giving.stashCoins(take ? -gp * 100 : gp * 100)}
          onProblem={setStashProblem}
        />
        {stashProblem && <p className={styles.problem}>{stashProblem}</p>}
        {stashEmpty ? (
          <p className={party.empty}>Empty.</p>
        ) : (
          <>
            <Purse wallet={stash.wallet} />
            <ul className={styles.things}>
              {stash.items.map((i) => (
                <li key={i.id}>
                  <span className={i.magic ? styles.magic : undefined}>
                    {i.quantity > 1 && <span className={styles.count}>{i.quantity} ×</span>} {i.name}
                    <Worth words={valueWords(worth(i), i.quantity)} />
                  </span>
                  <button
                    type="button"
                    className={styles.offer}
                    aria-label={`Take ${i.name} out of the stash`}
                    onClick={() => void giving.removeFromStash(i.id)}
                  >
                    Take out
                  </button>
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
  worth,
}: {
  character: Character
  giving: GivingControls
  offers: Offer[]
  onGive: () => void
  worth: (item: InventoryItem) => Value | null
}) {
  const weight = character.inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0)
  const attuned = attunedCount(character.inventory)
  const [problem, setProblem] = useState<string | null>(null)
  const [offering, setOffering] = useState<string | null>(null)
  const [takingAway, setTakingAway] = useState<string | null>(null)
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
      <QuickCoins
        label={`Gold for ${character.name}`}
        onApply={(gp, take) =>
          take ? giving.take(character.id, gp * 100) : giving.give(character.id, [], {}, gp * 100)
        }
        onProblem={setProblem}
      />
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
                  <Worth words={valueWords(worth(item), item.quantity)} />
                </span>
                {open ? (
                  <span className={styles.offered}>
                    Offered {coinWords(coinsFor(open.copper))}, waiting{' '}
                    <button type="button" className={styles.link} onClick={() => void giving.withdraw(open.id)}>
                      Take it back
                    </button>
                  </span>
                ) : takingAway === item.id ? (
                  <TakeAwayForm
                    item={item}
                    onTake={async (quantity) => {
                      const result = await giving.takeItem(character.id, item.id, quantity)
                      setProblem(result)
                      if (!result) setTakingAway(null)
                    }}
                    onCancel={() => setTakingAway(null)}
                  />
                ) : offering === item.id ? (
                  <OfferForm
                    item={item}
                    value={worth(item)}
                    onOffer={async (quantity, copper) => {
                      const result = await giving.offer(character.id, item.id, quantity, copper)
                      setProblem(result)
                      if (!result) setOffering(null)
                    }}
                    onCancel={() => setOffering(null)}
                  />
                ) : (
                  <span className={styles.itemButtons}>
                    <button
                      type="button"
                      className={styles.offer}
                      aria-label={`Offer to buy ${item.name}`}
                      onClick={() => setOffering(item.id)}
                    >
                      Offer
                    </button>
                    <button
                      type="button"
                      className={styles.offer}
                      aria-label={`Take ${item.name} away from ${character.name}`}
                      onClick={() => setTakingAway(item.id)}
                    >
                      Take away
                    </button>
                  </span>
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

/** How many to take away (a stack), and Take or Cancel. */
function TakeAwayForm({
  item,
  onTake,
  onCancel,
}: {
  item: InventoryItem
  onTake: (quantity: number) => Promise<void>
  onCancel: () => void
}) {
  const [quantity, setQuantity] = useState(item.quantity)
  return (
    <form
      className={styles.offerForm}
      aria-label={`Take ${item.name} away`}
      onSubmit={(e) => {
        e.preventDefault()
        void onTake(quantity)
      }}
    >
      {item.quantity > 1 && (
        <input
          type="number"
          min={1}
          max={item.quantity}
          value={quantity}
          aria-label="How many to take away"
          onChange={(e) => setQuantity(Math.max(1, Math.min(item.quantity, Math.floor(Number(e.target.value) || 1))))}
        />
      )}
      <button type="submit" className={styles.offer}>
        {item.worn ? 'Take it off them' : 'Take it'}
      </button>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

function OfferForm({
  item,
  value,
  onOffer,
  onCancel,
}: {
  item: InventoryItem
  value: Value | null
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
      {value && (
        <span className={styles.worthNote}>
          Worth {valueWords(value, quantity)}
          {copper !== null &&
            priceVerdict(copper, value, quantity) &&
            `: ${VERDICT_WORDS[priceVerdict(copper, value, quantity)!]}`}
        </span>
      )}
    </form>
  )
}

/**
 * One-click gold: Add or Take, then 1, 5, 10, 50 or 100 gp. Clicks add up for a moment and go as
 * one, so the log isn't flooded.
 */
function QuickCoins({
  label,
  onApply,
  onProblem,
}: {
  label: string
  onApply: (gp: number, take: boolean) => Promise<string | null>
  onProblem: (problem: string | null) => void
}) {
  const [taking, setTaking] = useState(false)
  const [pending, setPending] = useState(0)
  const timer = useRef<number | null>(null)
  const latest = useRef({ pending: 0, taking: false })

  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), [])

  function quick(gp: number) {
    onProblem(null)
    const next = pending + gp
    setPending(next)
    latest.current = { pending: next, taking }
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const { pending: amount, taking: take } = latest.current
      setPending(0)
      latest.current = { pending: 0, taking: take }
      void onApply(amount, take).then(onProblem)
    }, 1200)
  }

  return (
    <div className={styles.quick} role="group" aria-label={label}>
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
  )
}

/** What it's worth, quietly, for the DM. */
function Worth({ words }: { words: string }) {
  return words ? <span className={styles.worth}> · {words}</span> : null
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
